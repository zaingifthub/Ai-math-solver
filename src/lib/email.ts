import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { siteConfig } from "./site";

let transporter: Transporter | null = null;

export function emailEnabled() {
  return Boolean(process.env.SMTP_URL);
}

/** Sends an email via SMTP_URL (e.g. smtps://user:pass@smtp.hostinger.com:465). Returns false if email is not configured. */
export async function sendMail(msg: { to: string; subject: string; text: string; html: string }): Promise<boolean> {
  if (!process.env.SMTP_URL) {
    if (process.env.NODE_ENV !== "production") console.info(`[email:dev] To: ${msg.to}\nSubject: ${msg.subject}\n${msg.text}`);
    else console.warn("[email] SMTP_URL not configured — email not sent:", msg.subject);
    return false;
  }
  transporter ??= nodemailer.createTransport(process.env.SMTP_URL);
  await transporter.sendMail({ from: process.env.EMAIL_FROM || `${siteConfig.name} <no-reply@${new URL(siteConfig.url).hostname}>`, ...msg });
  return true;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function resetEmail(link: string) {
  return {
    subject: `Reset your ${siteConfig.name} password`,
    text: `Someone (hopefully you) asked to reset your ${siteConfig.name} password.\n\nReset it here (valid for 1 hour):\n${link}\n\nIf you didn't request this, you can ignore this email.`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#1e1b4b">
<h2 style="margin:0 0 12px">Reset your password</h2>
<p>Someone (hopefully you) asked to reset your ${esc(siteConfig.name)} password. This link is valid for 1 hour.</p>
<p style="margin:24px 0"><a href="${esc(link)}" style="background:#4f46e5;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Reset password</a></p>
<p style="color:#64748b;font-size:13px">If you didn't request this, you can safely ignore this email.</p></div>`,
  };
}
