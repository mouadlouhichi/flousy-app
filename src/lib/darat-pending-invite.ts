/**
 * A Darat invite code that arrived while the visitor could not use it —
 * typically a share link (/dashboard/darat?join=<code>) opened while signed
 * out: the auth-gate proxy bounces them to /login before the Darat screen
 * ever mounts, and the login flow lands them on /dashboard. The code is
 * remembered here so the dashboard widget and the Darat screen can show a
 * "you're invited" banner afterwards, until they join or dismiss it.
 *
 * sessionStorage (not localStorage): the invite is a one-shot handoff, not
 * a preference — it should not resurface in a fresh browser session months
 * later with an expired code.
 */

const PENDING_JOIN_KEY = 'smartjib_darat_pending_join';

export function rememberDaratJoin(code: string): void {
  if (typeof code !== 'string' || code.trim().length === 0) return;
  try {
    window.sessionStorage.setItem(PENDING_JOIN_KEY, code.trim());
  } catch {
    // Private mode / storage disabled — the direct ?join= flow still works.
  }
}

export function readDaratJoin(): string | null {
  try {
    const code = window.sessionStorage.getItem(PENDING_JOIN_KEY);
    return code && code.length > 0 ? code : null;
  } catch {
    return null;
  }
}

export function clearDaratJoin(): void {
  try {
    window.sessionStorage.removeItem(PENDING_JOIN_KEY);
  } catch {
    // Nothing to clean up.
  }
}
