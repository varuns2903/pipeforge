import nodemailer from 'nodemailer';
import type { Logger } from 'pino';

export interface MailerConfig {
  smtpHost?: string;
  smtpPort: number;
  smtpUser?: string;
  smtpPass?: string;
  mailFrom: string;
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Without smtpHost configured, the returned sendMail logs the email instead
 * of sending it — keeps verification/reset/notification flows fully
 * runnable (and testable) without requiring real email credentials. Set
 * SMTP_HOST/SMTP_USER/SMTP_PASS in .env to send for real (any standard SMTP
 * provider — SES, SendGrid, Postmark, etc. all expose an SMTP endpoint).
 *
 * Both apps/api (verification/reset emails) and apps/worker (execution
 * notifications) call this with their own env values — each process reads
 * its own env, this just avoids duplicating the transporter logic.
 */
export function createMailer(config: MailerConfig, logger: Logger) {
  const transporter = config.smtpHost
    ? nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpPort === 465,
        auth: config.smtpUser ? { user: config.smtpUser, pass: config.smtpPass } : undefined
      })
    : null;

  return async function sendMail(message: MailMessage): Promise<void> {
    if (!transporter) {
      logger.info({ mail: message }, 'SMTP not configured — logging email instead of sending');
      return;
    }

    await transporter.sendMail({
      from: config.mailFrom,
      to: message.to,
      subject: message.subject,
      text: message.text
    });
  };
}
