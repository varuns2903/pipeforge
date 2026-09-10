import { createMailer } from '@pipeforge/shared';
import { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM } from '../config/env';
import { logger } from '../logger';

export const sendMail = createMailer(
  { smtpHost: SMTP_HOST, smtpPort: SMTP_PORT, smtpUser: SMTP_USER, smtpPass: SMTP_PASS, mailFrom: MAIL_FROM },
  logger
);
