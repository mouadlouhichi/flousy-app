import { Resend } from 'resend';
import { getEmailConfig, type EmailConfig } from './config';
import { renderHouseholdInvite, type HouseholdInviteInput } from './templates/household-invite';

export type SendResult =
  | { ok: true }
  | { ok: false; code: 'email_not_configured' | 'sandbox_sender' | 'delivery_failed'; error?: unknown };

export async function sendHouseholdInvite(
  input: HouseholdInviteInput,
  config: EmailConfig = getEmailConfig(),
): Promise<SendResult> {
  if (!config.apiKey) return { ok: false, code: 'email_not_configured' };
  if (config.production && config.sandboxSender) return { ok: false, code: 'sandbox_sender' };

  const rendered = renderHouseholdInvite(input);
  const delivery = await new Resend(config.apiKey).emails.send({
    from: config.from,
    to: input.recipient,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });
  if (delivery.error) {
    return {
      ok: false,
      code: config.sandboxSender ? 'sandbox_sender' : 'delivery_failed',
      error: delivery.error,
    };
  }
  return { ok: true };
}
