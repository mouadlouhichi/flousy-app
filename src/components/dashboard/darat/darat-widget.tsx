'use client';

/**
 * Compact "Your Darat circles" widget for the dashboard overview.
 *
 * Self-contained: subscribes to `users/{uid}/circles` and renders the next
 * upcoming payment / payout. Clicking opens the full Darat screen.
 *
 * Pro gate: if the user is not Pro, the widget collapses to a single
 * "Darat is a Pro feature" CTA. This matches the pattern used by the rest
 * of the Pro-gated widgets in the app.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  collection,
  doc,
  getDoc,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/i18n-context';
import { isProUser } from '@/lib/pro-features';
import { formatCurrency } from '@/lib/currency';
import {
  normalizeDaratCircle,
  type DaratCircle,
} from '@/lib/darat';
import { AppIcon } from '@/components/ui/app-icon';

export function DaratWidget() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { messages: m, t, intlLocale } = useLanguage();
  const db = getFirestore();
  const [circles, setCircles] = useState<DaratCircle[] | null>(null);

  // Pointer-based subscription. Same source the screen uses, so a user that
  // creates a circle on the Darat page will see it here immediately.
  useEffect(() => {
    if (!user) {
      setCircles([]);
      return;
    }
    const pointerRef = collection(db, 'users', user.uid, 'circles');
    const unsub = onSnapshot(pointerRef, async (snap) => {
      const ids = snap.docs.map((d) => d.id);
      if (ids.length === 0) {
        setCircles([]);
        return;
      }
      const fetched = await Promise.all(
        ids.map((id) => getDoc(doc(db, 'circles', id))),
      );
      const out: DaratCircle[] = [];
      for (const s of fetched) {
        if (s.exists()) {
          // Snapshot id after the spread: legacy circles store `id: ''` and
          // must not clobber the real id (see the Darat screen's mergeDoc).
          out.push(normalizeDaratCircle({ ...(s.data() as Record<string, unknown>), id: s.id }));
        }
      }
      out.sort((a, b) => b.createdAt - a.createdAt);
      setCircles(out);
    });
    return () => unsub();
  }, [db, user]);

  const isPro = isProUser(profile);
  const today = new Date().toISOString().slice(0, 10);

  const myCircles = useMemo(() => circles ?? [], [circles]);

  // The next event for me: first round in any circle where I'm a member and
  // the date is today or later. Falls back to "all caught up".
  const nextEvent = useMemo(() => {
    let best: { circle: DaratCircle; date: string; pot: number; isRecipient: boolean } | null = null;
    for (const c of myCircles) {
      if (c.status === 'closed') continue;
      for (const r of c.rounds) {
        if (r.date < today) continue;
        if (r.status === 'closed') continue;
        if (!best || r.date < best.date) {
          best = {
            circle: c,
            date: r.date,
            pot: r.pot,
            isRecipient: r.recipientId === user?.uid,
          };
        }
      }
    }
    return best;
  }, [myCircles, today, user]);

  // Pro gate: show a "learn more" CTA instead of the widget body.
  if (!isPro) {
    return (
      <button
        type="button"
        onClick={() => router.push('/dashboard/darat')}
        className="group flex w-full items-center gap-3 rounded-2xl border border-dashed border-outline-variant bg-surface-container p-4 text-left transition hover:border-primary/40"
      >
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <AppIcon name="groups" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-on-surface">
            {m.darat.title}
          </span>
          <span className="block text-xs text-on-surface-variant">
            {m.darat.proGate.perk1}
          </span>
        </span>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
          Pro
        </span>
      </button>
    );
  }

  if (myCircles.length === 0) {
    return (
      <button
        type="button"
        onClick={() => router.push('/dashboard/darat')}
        className="group flex w-full items-center gap-3 rounded-2xl border border-dashed border-outline-variant bg-surface-container p-4 text-left transition hover:border-primary/40"
      >
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <AppIcon name="groups" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-on-surface">
            {m.darat.monthlyHook.widgetTitle}
          </span>
          <span className="block text-xs text-on-surface-variant">
            {m.darat.list.emptyHint}
          </span>
        </span>
        <AppIcon name="arrow_forward" className="text-on-surface-variant" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => router.push('/dashboard/darat')}
      className="group flex w-full flex-col gap-2 rounded-2xl border border-outline-variant bg-surface-container p-4 text-left transition hover:border-primary/40"
    >
      <div className="flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <AppIcon name="groups" />
        </span>
        <h3 className="text-sm font-bold text-on-surface">
          {m.darat.monthlyHook.widgetTitle}
        </h3>
        <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
          {t(m.darat.monthlyHook.activeIn, { count: myCircles.length })}
        </span>
      </div>
      {nextEvent && (
        <p className="text-sm text-on-surface">
          {nextEvent.isRecipient
            ? m.darat.monthlyHook.payoutNext
                .replace('{amount}', formatCurrency(nextEvent.pot, nextEvent.circle.currency, intlLocale))
                .replace('{date}', nextEvent.date)
            : m.darat.monthlyHook.contributeNext
                .replace('{amount}', formatCurrency(nextEvent.circle.contribution, nextEvent.circle.currency, intlLocale))
                .replace('{date}', nextEvent.date)}
        </p>
      )}
      <p className="text-xs text-on-surface-variant">
        {nextEvent ? nextEvent.circle.name : ''}
      </p>
    </button>
  );
}
