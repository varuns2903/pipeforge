import nodemailer from 'nodemailer';
import { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM } from '../config/env';
import { logger } from '../logger';

interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

// Without SMTP_HOST configured, mail is logged instead of sent — this keeps
// verification/reset flows fully runnable (and testable) without requiring
// real email credentials. Set SMTP_HOST/SMTP_USER/SMTP_PASS in .env to send
// for real (any standard SMTP provider — SES, SendGrid, Postmark, etc. all
// expose an SMTP endpoint).
const transporter = SMTP_HOST
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined
    })
  : null;

export async function sendMail(message: MailMessage): Promise<void> {
  if (!transporter) {
    logger.info({ mail: message }, 'SMTP not configured — logging email instead of sending');
    return;
  }

  await transporter.sendMail({
    from: MAIL_FROM,
    to: message.to,
    subject: message.subject,
    text: message.text
  });
}
