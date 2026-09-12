import nodemailer from "nodemailer";
import type { UserSettings } from "@/types";

export type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
};

export function getSmtpConfig(settings?: Pick<UserSettings, "smtpUser" | "smtpPassword" | "smtpFrom" | "applicantEmail">) {
  const user =
    settings?.smtpUser ||
    process.env.SMTP_USER ||
    settings?.applicantEmail ||
    process.env.APPLICANT_EMAIL ||
    "";
  const pass = (settings?.smtpPassword || process.env.SMTP_PASSWORD || "").replace(/\s+/g, "");
  const from =
    settings?.smtpFrom ||
    process.env.EMAIL_FROM ||
    (user ? `Waqas Rafique <${user}>` : "");

  return {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 587),
    user,
    pass,
    from,
  };
}

export function smtpConfigured(settings?: Pick<UserSettings, "smtpUser" | "smtpPassword" | "smtpFrom" | "applicantEmail">) {
  const config = getSmtpConfig(settings);
  return Boolean(config.user && config.pass);
}

function createTransport(config: SmtpConfig) {
  const gmail = config.host.includes("gmail.com") || config.user.endsWith("@gmail.com");
  if (gmail) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
  }

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    requireTLS: config.port === 587,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
}

export function generateApplicationEmail(input: {
  settings: UserSettings;
  job: { title: string; company: string };
  matchedSkills: string[];
}) {
  const name = input.settings.applicantName || "Waqas Rafique";
  const email = input.settings.applicantEmail || "vickyksr2218@gmail.com";
  const skills = input.matchedSkills.slice(0, 6).join(", ") || "React, Next.js, TypeScript, Node.js and Laravel";
  const subject = `Application for ${input.job.title} — ${name}, Full Stack Developer`;
  const body = `Dear Hiring Team at ${input.job.company},

I hope you are well.

I am writing to apply for the ${input.job.title} role. I am a Full Stack Web Developer with more than four years of experience building production web applications.

My recent work covers React.js, Next.js, TypeScript, Node.js, Laravel, MySQL and MongoDB, including SaaS, healthcare and HR platforms. This position appears to be a strong match with my experience in ${skills}.

Please find my CV attached for your review. I would be grateful for the opportunity to discuss how I can support your team.

I look forward to hearing from you. You are also welcome to reach me on WhatsApp at 0322-4188759.

Kind regards,
${name}
Full Stack Web Developer
Johar Town, Lahore, Pakistan
${email}
0322-4188759
https://github.com/waqasahmad18`;

  return { subject, body };
}

export async function sendApplicationEmail(input: {
  to: string;
  subject: string;
  body: string;
  from?: string;
  replyTo?: string;
  attachment?: { filename: string; path: string };
  settings?: UserSettings;
}) {
  const config = getSmtpConfig(input.settings);
  if (!config.user || !config.pass) {
    return { sent: false, error: "Gmail SMTP is not configured. Add an App Password." };
  }

  const transporter = createTransport(config);
  await transporter.sendMail({
    from: input.from || config.from || config.user,
    to: input.to,
    replyTo: input.replyTo || config.user,
    subject: input.subject,
    text: input.body,
    attachments: input.attachment ? [input.attachment] : [],
  });

  return { sent: true as const };
}

export async function verifySmtp(settings?: UserSettings) {
  const config = getSmtpConfig(settings);
  if (!config.user || !config.pass) {
    throw new Error("Add your Gmail App Password first.");
  }
  const transporter = createTransport(config);
  await transporter.verify();
  return config.user;
}
