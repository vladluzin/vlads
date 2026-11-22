import nodemailer from "nodemailer";
import { marked } from "marked";
import { BRAND } from "../brand";

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransport() {
  if (!process.env.SMTP_URL) return null;
  transport ??= nodemailer.createTransport(process.env.SMTP_URL);
  return transport;
}

/** Model-written Markdown must not smuggle raw HTML into emails. */
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export interface Mail {
  to: string;
  subject: string;
  /** Markdown body; rendered to HTML with a plain-text alternative. */
  markdown: string;
}

/** Sends an email via SMTP_URL. Without SMTP configured (local dev) the message is logged. */
export async function sendEmail(mail: Mail): Promise<void> {
  const t = getTransport();
  if (!t) {
    console.log(`[email:dev] to=${mail.to} subject="${mail.subject}"\n${mail.markdown}\n`);
    return;
  }
  const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;line-height:1.55;color:#1d1b2e">${await marked.parse(escapeHtml(mail.markdown))}<hr style="border:none;border-top:1px solid #ddd"><p style="color:#888;font-size:12px">${BRAND.name}</p></div>`;
  await t.sendMail({
    from: process.env.MAIL_FROM ?? `${BRAND.name} <no-reply@example.com>`,
    to: mail.to,
    subject: mail.subject,
    text: mail.markdown,
    html,
  });
}
