/**
 * User notifications stored in Firestore at `users/{uid}/notifications/{id}`.
 *
 * The server reminder dispatcher (and any future server-side event) writes
 * these rows; the client only READS them and flips `readAt`. That split is
 * enforced by `firestore.rules`: create is shape-checked, update may only
 * touch `readAt`. Keeping the shape + the pure helpers here mirrors the
 * repo's normaliser convention so the reader never crashes on a document
 * that predates a field.
 */

export type UserNotificationSeverity = 'info' | 'warning' | 'error';

export interface UserNotification {
  id: string;
  /** Stable semantic kind, e.g. 'bill' | 'goal' | 'trial' | 'system'. */
  kind: string;
  title: string;
  body: string;
  /** AppIcon identifier rendered in the notification centre. */
  icon: string;
  severity: UserNotificationSeverity;
  /** Deep link inside the dashboard; empty = not tappable. */
  href: string;
  /** ms since epoch. */
  createdAt: number;
  /** ms since epoch once the user read it; null while unread. */
  readAt: number | null;
}

/** Read a stored notification document tolerantly (missing fields default). */
export function normalizeUserNotification(
  id: string,
  raw: Record<string, unknown>,
): UserNotification {
  const severity =
    raw.severity === 'warning' || raw.severity === 'error' ? raw.severity : 'info';
  return {
    id,
    kind: typeof raw.kind === 'string' ? raw.kind : 'system',
    title: typeof raw.title === 'string' ? raw.title : '',
    body: typeof raw.body === 'string' ? raw.body : '',
    icon: typeof raw.icon === 'string' && raw.icon ? raw.icon : 'notifications',
    severity,
    href: typeof raw.href === 'string' ? raw.href : '',
    createdAt: typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt) ? raw.createdAt : 0,
    readAt: typeof raw.readAt === 'number' && Number.isFinite(raw.readAt) ? raw.readAt : null,
  };
}

/** Newest first; stable for equal timestamps via id. */
export function sortUserNotifications(list: UserNotification[]): UserNotification[] {
  return [...list].sort((a, b) => (b.createdAt - a.createdAt) || a.id.localeCompare(b.id));
}

export function countUnreadNotifications(list: UserNotification[]): number {
  return list.filter((notification) => notification.readAt == null).length;
}

/**
 * The ids a "mark all as read" action must flip: only the currently unread
 * ones, capped so a single batch stays within Firestore's 500-write limit.
 */
export function unreadNotificationIds(list: UserNotification[], cap = 400): string[] {
  return list
    .filter((notification) => notification.readAt == null)
    .map((notification) => notification.id)
    .slice(0, cap);
}
