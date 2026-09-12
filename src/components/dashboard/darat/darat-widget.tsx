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
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { useAuth } from '@/lib/auth-context';
import { db as firestoreDb } from '@/lib/firebase-db';
import { useLanguage } from '@/lib/i18n-context';
import { isProUser } from '@/lib/pro-features';
import { formatCurrency } from '@/lib/currency';
import {
  daratCircleFromSnapshot,
  type DaratCircle,
} from '@/lib/darat';
import { clearDaratJoin, readDaratJoin } from '@/lib/darat-pending-invite';
import { AppIcon } from '@/components/ui/app-icon';

export function DaratWidget() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { messages: m, intlLocale } = useLanguage();
  const db = firestoreDb;
  const [circles, setCircles] = useState<DaratCircle[] | null>(null);
  // An invite remembered from a share link opened before sign-in — read
  // after mount (sessionStorage is client-only, and hydration must not
  // depend on it).
  const [pendingInvite, setPendingInvite] = useState<string | null>(null);

  // A remembered invite surfaces as a banner the moment the user is signed
  // in — this is the screen they land on after login.
  useEffect(() => {
    if (user) setPendingInvite(readDaratJoin());
  }, [user]);

  // Pointer-based subscription. Same source the screen uses, so a user that
  // creates a circle on the Darat page will see it here immediately.
  useEffect(() => {
    if (!user || !db) {
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
          out.push(daratCircleFromSnapshot(s.id, s.data() as Record<string, unknown>));
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
      // An owner who opted out of the rotation has no seat — no payment
      // of theirs is ever scheduled in that circle.
      if (user?.uid && !c.memberOrder.includes(user.uid)) continue;
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

  // A remembered invite outranks everything else on this widget — including
  // the Pro gate: an invitee who is not Pro still needs to see that a spot
  // was saved for them (joining and reading their circle is part of the
  // invitation, not something to upsell mid-handoff).
  if (pendingInvite && user) {
    return (
      <div className="flex flex-col gap-3 rounded-[1.75rem] border border-lime-deep/40 bg-lime/10 p-4 dark:border-lime/30 dark:bg-lime/5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-lime text-forest-deep">
            <AppIcon name="group_add" strokeWidth={2} className="text-[18px]" />
          </span>
          <div className="min-w-0">
            <h3 className="text-[14px] font-semibold text-on-surface">{m.darat.inviteBanner.title}</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-on-surface-variant">{m.darat.inviteBanner.body}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.push(`/dashboard/darat?join=${encodeURIComponent(pendingInvite)}`)}
            className="inline-flex items-center gap-1.5 rounded-full bg-forest px-4 py-2 text-xs font-bold text-lime transition-all hover:bg-forest-deep"
          >
            <AppIcon name="group_add" className="text-[14px]" />
            {m.darat.inviteBanner.cta}
          </button>
          <button
            type="button"
            onClick={() => {
              clearDaratJoin();
              setPendingInvite(null);
            }}
            className="inline-flex items-center rounded-full border border-outline-variant px-3 py-2 text-xs font-bold text-on-surface-variant transition-colors hover:bg-surface-container-high"
          >
            {m.darat.inviteBanner.dismiss}
          </button>
        </div>
      </div>
    );
  }

  // Pro gate: show a "learn more" CTA instead of the widget body.
  if (!isPro) {
    return (
      <button
        type="button"
        onClick={() => router.push('/dashboard/darat')}
        className="group flex w-full items-center gap-3 rounded-[1.75rem] border border-dashed border-outline-variant bg-surface-container-lowest p-4 text-start transition-all hover:-translate-y-0.5 hover:shadow-ambient"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-mint text-forest dark:text-lime">
          <AppIcon name="groups" strokeWidth={2} className="text-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-on-surface">
            {m.darat.title}
          </span>
          <span className="block truncate text-[12px] font-medium text-on-surface-variant">
            {m.darat.proGate.perk1}
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-lime px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-forest-deep">
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
        className="group flex w-full items-center gap-3 rounded-[1.75rem] border border-dashed border-outline-variant bg-surface-container-lowest p-4 text-start transition-all hover:-translate-y-0.5 hover:shadow-ambient"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-mint text-forest dark:text-lime">
          <AppIcon name="groups" strokeWidth={2} className="text-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-on-surface">
            {m.darat.monthlyHook.widgetTitle}
          </span>
          <span className="block text-[12px] font-medium text-on-surface-variant">
            {m.darat.list.emptyHint}
          </span>
        </span>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-on-surface transition-colors group-hover:bg-lime group-hover:text-forest-deep">
          <AppIcon name="arrow_outward" strokeWidth={2} className="text-[16px] rtl:-scale-x-100" />
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => router.push('/dashboard/darat')}
      className="surface-forest group relative flex w-full flex-col gap-3 overflow-hidden rounded-[1.75rem] p-4 text-start shadow-forest transition-transform hover:-translate-y-0.5"
    >
      <div aria-hidden className="dot-matrix-forest pointer-events-none absolute inset-y-0 end-0 w-1/3 opacity-40 [mask-image:linear-gradient(to_left,black,transparent)]" />
      <div className="relative flex w-full items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-lime text-forest-deep">
          <AppIcon name="groups" strokeWidth={2} className="text-[17px]" />
        </span>
        <h3 className="min-w-0 flex-1 truncate text-[14px] font-semibold text-white">
          {m.darat.monthlyHook.widgetTitle}
        </h3>
        <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-white/80">
          {m.darat.monthlyHook.activeIn.replace('{count}', String(myCircles.length))}
        </span>
      </div>
      {nextEvent && (
        <p className="relative text-[15px] font-semibold leading-snug text-white">
          {nextEvent.isRecipient
            ? m.darat.monthlyHook.payoutNext
                .replace('{amount}', formatCurrency(nextEvent.pot, nextEvent.circle.currency, intlLocale))
                .replace('{date}', nextEvent.date)
            : m.darat.monthlyHook.contributeNext
                .replace('{amount}', formatCurrency(nextEvent.circle.contribution, nextEvent.circle.currency, intlLocale))
                .replace('{date}', nextEvent.date)}
        </p>
      )}
      <p className="relative flex w-full items-center justify-between gap-2 text-[12px] font-medium text-white/60">
        <span className="truncate">{nextEvent ? nextEvent.circle.name : ''}</span>
        <AppIcon name="arrow_outward" strokeWidth={2} className="shrink-0 text-[16px] text-lime rtl:-scale-x-100" />
      </p>
    </button>
  );
}
