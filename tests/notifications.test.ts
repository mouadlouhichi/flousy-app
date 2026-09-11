import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  countUnreadNotifications,
  normalizeUserNotification,
  sortUserNotifications,
  unreadNotificationIds,
} from '../src/lib/notifications';

describe('notifications: normalizer', () => {
  it('fills missing fields with safe defaults', () => {
    const notification = normalizeUserNotification('n1', {});
    assert.equal(notification.id, 'n1');
    assert.equal(notification.kind, 'system');
    assert.equal(notification.icon, 'notifications');
    assert.equal(notification.severity, 'info');
    assert.equal(notification.readAt, null);
    assert.equal(notification.createdAt, 0);
  });

  it('keeps stored values and coerces invalid severities', () => {
    const notification = normalizeUserNotification('n2', {
      kind: 'bill',
      title: 'Rent due',
      body: 'Today',
      icon: 'event_upcoming',
      severity: 'loud',
      href: '/dashboard/fixed',
      createdAt: 123,
      readAt: 456,
    });
    assert.equal(notification.kind, 'bill');
    assert.equal(notification.severity, 'info');
    assert.equal(notification.readAt, 456);
    assert.equal(notification.href, '/dashboard/fixed');
  });
});

describe('notifications: ordering and unread math', () => {
  const make = (id: string, createdAt: number, readAt: number | null = null) =>
    normalizeUserNotification(id, { createdAt, readAt });

  it('sorts newest first with a stable id tie-break', () => {
    const list = [make('b', 10), make('a', 10), make('c', 30)];
    assert.deepEqual(sortUserNotifications(list).map((n) => n.id), ['c', 'a', 'b']);
  });

  it('counts and lists only unread rows, capped for batch limits', () => {
    const list = [make('u1', 1), make('r1', 2, 5), make('u2', 3)];
    assert.equal(countUnreadNotifications(list), 2);
    assert.deepEqual(unreadNotificationIds(list), ['u1', 'u2']);
    const many = Array.from({ length: 500 }, (_, i) => make(`n${i}`, i));
    assert.equal(unreadNotificationIds(many).length, 400);
  });
});
