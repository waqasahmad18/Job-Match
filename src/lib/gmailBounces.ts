import { createConnection } from "tls";
import { getSmtpConfig } from "@/lib/email";
import { rememberBouncedEmail } from "@/lib/verifyEmail";
import { Application, Job } from "@/models";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const BOUNCE_HINT =
  /address not found|550[- ]5\.1\.1|user unknown|does not exist|undeliverable|invalid recipient|mailbox unavailable|no such user|Delivery Status Notification/i;

function extractBouncedRecipients(raw: string) {
  const found = new Set<string>();
  const failed = raw.match(/X-Failed-Recipients:\s*([^\r\n]+)/gi) || [];
  for (const line of failed) {
    for (const email of line.match(EMAIL_RE) || []) found.add(email.toLowerCase());
  }
  const finals = raw.match(/(?:Final|Original)-Recipient:\s*rfc822;\s*([^\s;]+)/gi) || [];
  for (const line of finals) {
    for (const email of line.match(EMAIL_RE) || []) found.add(email.toLowerCase());
  }
  if (!found.size && BOUNCE_HINT.test(raw)) {
    for (const email of raw.match(EMAIL_RE) || []) {
      if (!/googlemail|mailer-daemon|postmaster@gmail/.test(email)) found.add(email.toLowerCase());
    }
  }
  return [...found];
}

function imapSince(value: Date) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(value.getUTCDate()).padStart(2, "0")}-${months[value.getUTCMonth()]}-${value.getUTCFullYear()}`;
}

class ImapSession {
  private socket;
  private buffer = "";
  private tag = 1;
  private queued: string[] = [];
  private waiters: Array<(line: string) => void> = [];

  constructor(socket: import("tls").TLSSocket) {
    this.socket = socket;
    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => {
      this.buffer += chunk;
      let index;
      while ((index = this.buffer.indexOf("\r\n")) >= 0) {
        const line = this.buffer.slice(0, index);
        this.buffer = this.buffer.slice(index + 2);
        const waiter = this.waiters.shift();
        if (waiter) waiter(line);
        else this.queued.push(line);
      }
    });
  }

  private nextLine() {
    if (this.queued.length) return Promise.resolve(this.queued.shift() as string);
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Gmail IMAP timed out")), 12_000);
      this.waiters.push((line) => {
        clearTimeout(timer);
        resolve(line);
      });
    });
  }

  async readUntil(tag: string) {
    const lines: string[] = [];
    while (true) {
      const line = await this.nextLine();
      lines.push(line);
      if (line.startsWith(`${tag} `)) return lines;
    }
  }

  async command(command: string) {
    const tag = `A${this.tag++}`;
    this.socket.write(`${tag} ${command}\r\n`);
    return this.readUntil(tag);
  }

  close() {
    this.socket.end();
  }
}

export async function fetchGmailBounceRecipients(since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)) {
  const config = getSmtpConfig();
  if (!config.user || !config.pass) return [];

  const socket = await new Promise<import("tls").TLSSocket>((resolve, reject) => {
    const connection = createConnection(
      { host: "imap.gmail.com", port: 993, servername: "imap.gmail.com", timeout: 12_000 },
      () => resolve(connection),
    );
    connection.once("error", reject);
    connection.once("timeout", () => reject(new Error("Gmail IMAP connect timed out")));
  });

  const imap = new ImapSession(socket);
  await imap.readUntil("*");
  const user = config.user.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const pass = config.pass.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const login = await imap.command(`LOGIN "${user}" "${pass}"`);
  if (login.some((line) => line.includes("NO") || line.includes("BAD"))) {
    imap.close();
    throw new Error("Gmail IMAP login failed. Enable IMAP and use the App Password.");
  }

  await imap.command("SELECT INBOX");
  const search = await imap.command(
    `SEARCH SINCE ${imapSince(since)} FROM "mailer-daemon@googlemail.com"`,
  );
  const ids = (search.find((line) => line.startsWith("* SEARCH")) || "")
    .replace("* SEARCH", "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(-20);

  const recipients = new Set<string>();
  for (const id of ids) {
    const fetched = await imap.command(`FETCH ${id} (BODY.PEEK[HEADER])`);
    const raw = fetched.join("\n");
    for (const email of extractBouncedRecipients(raw)) recipients.add(email);
  }

  await imap.command("LOGOUT").catch(() => undefined);
  imap.close();
  return [...recipients];
}

export async function syncGmailBounces() {
  let bounced: string[] = [];
  try {
    bounced = await Promise.race([
      fetchGmailBounceRecipients(),
      new Promise<string[]>((_, reject) => {
        setTimeout(() => reject(new Error("Gmail bounce check timed out")), 20_000);
      }),
    ]);
  } catch (error) {
    return {
      checked: false,
      bounced: 0,
      released: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  for (const email of bounced) {
    await rememberBouncedEmail(email, "Gmail bounce: invalid address");
  }

  if (!bounced.length) return { checked: true, bounced: 0, released: 0 };

  const apps = await Application.find({
    status: { $in: ["sent", "ready"] },
    emailTo: { $in: bounced },
  });

  let released = 0;
  for (const app of apps) {
    app.status = "failed";
    app.reason = "Gmail bounce: invalid address. Will confirm another hiring email and resend.";
    await app.save();
    if (app.jobId) {
      await Job.findByIdAndUpdate(app.jobId, { status: "matched" });
    }
    released += 1;
  }

  return { checked: true, bounced: bounced.length, released };
}
