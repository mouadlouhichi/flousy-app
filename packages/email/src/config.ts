export const SANDBOX_SENDER = '@resend.dev';
export const DEFAULT_FROM = 'SmartJib <onboarding@resend.dev>';

export interface EmailConfig {
  apiKey: string | undefined;
  from: string;
  production: boolean;
  sandboxSender: boolean;
  environment: string;
}

/**
 * `NODE_ENV` is `production` on Vercel preview too, so sandbox-sender checks
 * must use `VERCEL_ENV` when it is present.
 */
export function isProductionDeployment(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.VERCEL_ENV) return env.VERCEL_ENV === 'production';
  return env.NODE_ENV === 'production';
}

export function getEmailConfig(env: NodeJS.ProcessEnv = process.env): EmailConfig {
  const from = env.RESEND_FROM_EMAIL || DEFAULT_FROM;
  const production = isProductionDeployment(env);
  return {
    apiKey: env.RESEND_API_KEY || undefined,
    from,
    production,
    sandboxSender: from.includes(SANDBOX_SENDER),
    environment: production ? 'production' : env.VERCEL_ENV || env.NODE_ENV || 'unknown',
  };
}

export type EmailProbeCode = 'ready' | 'email_not_configured' | 'sandbox_sender';

export function probeEmailConfig(config: EmailConfig = getEmailConfig()): {
  emailConfigured: boolean;
  sandboxSender: boolean;
  environment: string;
  code: EmailProbeCode;
} {
  const configured = Boolean(config.apiKey);
  return {
    emailConfigured: configured,
    sandboxSender: config.sandboxSender,
    environment: config.environment,
    code: !configured
      ? 'email_not_configured'
      : config.production && config.sandboxSender
        ? 'sandbox_sender'
        : 'ready',
  };
}

function vercelUrl(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = env[name];
  return value ? `https://${value.replace(/^https?:\/\//, '')}` : undefined;
}

/** Accept-link origin. Never derived from the request Host header. */
export function resolveAppBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const production = isProductionDeployment(env);
  const candidates = production
    ? [env.APP_URL, env.NEXT_PUBLIC_SITE_URL, vercelUrl(env, 'VERCEL_PROJECT_PRODUCTION_URL')]
    : [vercelUrl(env, 'VERCEL_URL'), vercelUrl(env, 'VERCEL_PROJECT_PRODUCTION_URL'), env.APP_URL, env.NEXT_PUBLIC_SITE_URL];
  for (const candidate of candidates) {
    const value = (candidate || '').trim().replace(/\/+$/, '');
    if (!value) continue;
    try {
      const url = new URL(value.startsWith('http') ? value : `https://${value}`);
      if (url.hostname.includes('.') || url.hostname === 'localhost') return url.origin;
    } catch {
      /* try the next candidate */
    }
  }
  return 'https://flousy.app';
}
