/**
 * Error reporting seam.
 *
 * No Sentry SDK yet — adding @sentry/nextjs would couple Next config and the
 * Expo client. When NEXT_PUBLIC_SENTRY_DSN (web) or SENTRY_DSN is set, swap
 * the body of `captureException` for a dynamic import. Until then every
 * unexpected error still lands in platform logs.
 */

export type ObservabilityContext = Record<string, unknown>;

function print(level: 'error' | 'warn', label: string, payload: unknown, context?: ObservabilityContext) {
  const extra = context && Object.keys(context).length ? context : undefined;
  if (level === 'error') console.error(label, payload, extra ?? '');
  else console.warn(label, payload, extra ?? '');
}

export function captureException(error: unknown, context?: ObservabilityContext): void {
  print('error', '[flousy]', error, context);
}

export function captureMessage(message: string, context?: ObservabilityContext): void {
  print('warn', '[flousy]', message, context);
}
