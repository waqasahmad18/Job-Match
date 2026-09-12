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
  const name = input.settings.applicantName || "the applicant";
  const skills = input.matchedSkills.slice(0, 5).join(", ") || "full-stack development";
  const subject = `Application for ${input.job.title} at ${input.job.company}`;
  const body = `Hello ${input.job.company} hiring team,

I am applying for the ${input.job.title} role. My background covers ${skills}, and I am a strong match for this position based on the job description.

I have attached the most relevant CV. I would welcome the chance to discuss how I can contribute.

Best regards,
${name}`;

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
