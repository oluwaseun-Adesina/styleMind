import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

// Sends transactional email through the Resend HTTP API when RESEND_API_KEY is
// configured. Without a key (local dev) the message is logged to the console
// instead, so the reset flow stays testable end-to-end.

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export const sendEmail = async (message: EmailMessage): Promise<void> => {
  if (!env.RESEND_API_KEY) {
    // Dev: print the message (incl. reset codes) so the flow stays testable.
    // Prod: never print secrets — record that the email could not be sent.
    logger.info(`[Email:dev] To: ${message.to} | Subject: ${message.subject}\n${message.text}`);
    logger.warn(`Email not sent (RESEND_API_KEY missing): "${message.subject}" to ${message.to}`);
    return;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Email send failed (${response.status}): ${body}`);
  }
};

export const sendPasswordResetEmail = async (to: string, code: string): Promise<void> => {
  await sendEmail({
    to,
    subject: 'Your FitPick password reset code',
    text: `Your FitPick password reset code is: ${code}\n\nIt expires in 15 minutes. If you didn't request this, you can safely ignore this email.`,
    html: `<p>Your FitPick password reset code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p><p>It expires in 15 minutes. If you didn't request this, you can safely ignore this email.</p>`,
  });
};
