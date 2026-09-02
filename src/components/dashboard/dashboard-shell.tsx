'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react';
import { AppIcon } from '@/components/ui/app-icon';
import { useDashboard } from './dashboard-provider';
import { DASHBOARD_NAV_ITEMS, DASHBOARD_NAV_HREFS, getScreenIdFromPath } from './nav-items';
import { Sidebar } from './sidebar';
import { BottomNav } from './bottom-nav';
import { DashboardHeader } from './dashboard-header';
import { QuickActions } from './quick-actions';
import { DashboardModals } from './dashboard-modals';
import { DashboardSkeleton } from './dashboard-skeleton';
import { useLanguage } from '@/lib/i18n-context';
import { exitDemoMode, isDemoMode } from '@/lib/demo-mode';
import { hasAnsweredAnalyticsConsent, setAnalyticsConsent } from '@/lib/analytics';
import { useAuth } from '@/lib/auth-context';
import { useHousehold } from '@/lib/household-context';

/**
 * Instagram-style push transition: the incoming screen slides in from the
 * direction we came from, ON TOP of the outgoing screen; the outgoing screen
 * stays exactly where it is (no movement) and simply fades underneath.
 *
 * Glitch-avoidance notes (previous page flashing on top of the new one):
 * - The transition lives inside an inner `relative` wrapper so the exiting
 *   screen is positioned against the CONTENT box (same size as the incoming
 *   screen) — positioning it against <main>'s padding box made the old page
 *   wider than the new one, so its edges peeked out beside the content.
 * - The incoming screen is `position: relative; z-index: 1`; the exiting one
 *   is `position: absolute; z-index: 0`, so no matter the DOM order
 *   (AnimatePresence appends exiting elements AFTER the new one) the old page
 *   can never paint on top of the new page.
 * - The exiting screen does not move or scale — only fades — so there is no
 *   "old page slides back over the new one" artifact.
 * - `pointer-events: none` on the exiting screen so the fading old page never
 *   swallows a click.
 *
 * Both run simultaneously (AnimatePresence default mode) and are short; the
 * transition starts on click and never waits for a fetch, a spinner or an
 * exit callback. Content is instant because every dashboard route is
 * prerendered and prefetched (see the prefetch effect below).
 */
const pageVariants: Variants = {
  // New screen slides over the old one, fully opaque (Instagram-style push).
  enter: (direction: number) => ({
    x: direction * 64,
  }),
  center: { x: 0 },
  // Old screen: pinned exactly behind the incoming one, only fades out.
  exit: () => ({
    opacity: 0,
    position: 'absolute' as const,
    inset: 0,
    zIndex: 0,
    pointerEvents: 'none' as const,
    transition: {
      position: { duration: 0 },
      opacity: { duration: 0.18, ease: 'easeOut' },
    },
  }),
};

function EmailVerificationBanner() {
  const { messages: m } = useLanguage();
  const {
    user,
    verificationSent,
    sendVerification,
    dismissVerificationBanner,
    setDismissVerificationBanner,
  } = useDashboard();

  if (!user || user.emailVerified || dismissVerificationBanner) return null;

  return (
    <div className="bg-tertiary-container text-on-tertiary-container px-margin-mobile py-2.5 flex items-center justify-between font-label-md text-label-md">
      <div className="flex items-center gap-xs">
        <AppIcon name="mark_email_unread" className=" text-[20px]" />
        <span>{m.notifications.emailVerificationPrompt}</span>
        {verificationSent ? (
          <span className="font-bold underline ms-xs">{m.notifications.verificationSent}</span>
        ) : (
          <button onClick={sendVerification} className="font-bold underline ms-xs hover:opacity-80">
            {m.notifications.resendEmail}
          </button>
        )}
      </div>
      <button
        onClick={() => setDismissVerificationBanner(true)}
        className="tap-target p-1 hover:bg-tertiary/20 rounded-full"
        aria-label={m.notifications.dismissBanner}
      >
        <AppIcon name="close" className=" text-[18px]" />
      </button>
    </div>
  );
}

/**
 * Demo mode used to be announced only on /login: once a visitor tapped through
 * to the dashboard they browsed invented expenses with no reminder that nothing
 * they typed belonged to an account — and no way out except the login page.
 *
 * `isDemoMode()` reads localStorage, so the value is unknown during prerender;
 * showing it from the first client render would hydrate a banner the server
 * never emitted. It is therefore applied after mount.
 */
function SyncIssueBanner() {
  const { messages: m } = useLanguage();
  const { syncState, syncError, pendingMutations, retrySync, discardPendingChanges } = useDashboard();
  const [discarding, setDiscarding] = useState(false);
  if (syncState !== 'failed' && syncState !== 'conflict') return null;

  return (
    <div role="alert" className="flex flex-col gap-2 bg-error/10 px-margin-mobile py-3 text-error sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2">
        <AppIcon name={syncState === 'conflict' ? 'sync_problem' : 'cloud_off'} className="mt-0.5 shrink-0 text-[20px]" />
        <div>
          <p className="text-sm font-bold">{m.sync[syncState]}</p>
          <p className="text-xs">
            {syncError || (syncState === 'conflict' ? m.sync.conflictDetail : m.sync.queuedLocally)}
            {pendingMutations > 0 ? ` (${pendingMutations})` : ''}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        {syncState === 'failed' && (
          <button type="button" onClick={retrySync} className="rounded-full bg-error px-3 py-1.5 text-xs font-bold text-on-error">
            {m.sync.retry}
          </button>
        )}
        <button
          type="button"
          disabled={discarding}
          onClick={() => {
            setDiscarding(true);
            void discardPendingChanges().catch(() => {}).finally(() => setDiscarding(false));
          }}
          className="rounded-full border border-error px-3 py-1.5 text-xs font-bold disabled:opacity-50"
        >
          {m.sync.useCloudCopy}
        </button>
      </div>
    </div>
  );
}

function ClosedMonthBanner() {
  const { messages: m } = useLanguage();
  const { month, reopenCurrentMonth } = useDashboard();
  const { workspace, isOwner } = useHousehold();
  if (month.periodStatus !== 'closed') return null;
  const mayReopen = workspace === 'personal' || isOwner;

  return (
    <div role="status" className="flex items-center justify-between gap-3 bg-tertiary-container px-margin-mobile py-2.5 text-on-tertiary-container">
      <div className="flex min-w-0 items-center gap-2">
        <AppIcon name="lock" className="shrink-0 text-[18px]" />
        <div className="min-w-0">
          <p className="text-sm font-bold">{m.monthLock.closed}</p>
          <p className="truncate text-xs">{m.monthLock.closedDetail}</p>
        </div>
      </div>
      {mayReopen && (
        <button
          type="button"
          onClick={() => {
            if (window.confirm(m.monthLock.reopenConfirm)) reopenCurrentMonth();
          }}
          className="shrink-0 rounded-full border border-current px-3 py-1.5 text-xs font-bold hover:bg-on-tertiary-container/10"
        >
          {m.monthLock.reopen}
        </button>
      )}
    </div>
  );
}

function DemoModeBanner() {
  const { messages: m } = useLanguage();
  const router = useRouter();
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    setDemo(isDemoMode());
  }, []);

  if (!demo) return null;

  return (
    <div className="bg-surface-container-highest text-on-surface px-margin-mobile py-2.5 flex items-center justify-between gap-3 font-label-md text-label-md">
      <div className="flex min-w-0 items-center gap-xs">
        <AppIcon name="science" className="text-[20px] shrink-0" />
        <span className="truncate">{m.auth.demoActiveHint}</span>
      </div>
      <button
        type="button"
        onClick={() => {
          exitDemoMode();
          router.replace('/login');
        }}
        className="font-bold underline ms-xs shrink-0 hover:opacity-80"
      >
        {m.auth.demoExit}
      </button>
    </div>
  );
}

/**
 * Firebase Analytics used to initialise on the first tracked event, i.e. before
 * anyone had been asked — while /cookies promises analytics are "off unless
 * you've agreed to them". The choice is now collected here, remembered on the
 * device, and `trackEvent` refuses to load or send anything until it says
 * "granted". Unanswered means unanswered: nothing is measured.
 */
function AnalyticsConsentPrompt() {
  const { messages: m } = useLanguage();
  const [answered, setAnswered] = useState(true);

  useEffect(() => {
    setAnswered(hasAnsweredAnalyticsConsent());
  }, []);

  if (answered) return null;

  const choose = (granted: boolean) => {
    setAnalyticsConsent(granted);
    setAnswered(true);
  };

  return (
    <div
      role="region"
      aria-label={m.consent.title}
      className="bg-surface-container-high text-on-surface px-margin-mobile py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <p className="font-label-md text-label-md font-bold">{m.consent.title}</p>
        <p className="mt-0.5 text-xs leading-5 text-on-surface-variant">{m.consent.body}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => choose(false)}
          className="rounded-full border border-outline-variant px-3 py-1.5 text-xs font-bold hover:bg-surface-variant"
        >
          {m.consent.decline}
        </button>
        <button
          type="button"
          onClick={() => choose(true)}
          className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-on-primary hover:bg-primary/90"
        >
          {m.consent.accept}
        </button>
      </div>
    </div>
  );
}

/**
 * A profile read that fails (offline, permission, quota) used to leave the app
 * on a fabricated "already onboarded, free plan" profile with no indication
 * anything went wrong. `auth-context` now reports the failure instead, and this
 * is where the user gets to retry it rather than silently running on defaults.
 */
function ProfileSyncBanner() {
  const { profileUnavailable, retryProfileSync } = useAuth();
  const { messages: m } = useLanguage();
  if (!profileUnavailable) return null;
  return (
    <div
      role="alert"
      className="bg-error-container text-on-error-container px-margin-mobile py-2.5 flex items-center justify-between gap-3 font-label-md text-label-md"
    >
      <span className="min-w-0 truncate">{m.auth.networkError}</span>
      <button
        type="button"
        onClick={() => void retryProfileSync()}
        className="font-bold underline shrink-0 hover:opacity-80"
      >
        {m.common.retry}
      </button>
    </div>
  );
}

/**
 * Persistent dashboard chrome (sidebar, header, bottom nav, quick actions,
 * modals) wrapping the routed page content. Keeping this mounted across
 * routes is what allows the active-background pill to slide between nav
 * items and the content to transition horizontally on navigation.
 */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isRTL } = useLanguage();
  const { loading } = useDashboard();
  const reduceMotion = useReducedMotion();

  // Prefetch every dashboard screen (main nav + profile subpages) once the
  // user is idle. Routes are static, so this caches the RSC payload and JS
  // chunk client-side — a later click is instant (like a native app), with
  // zero server round-trip.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      for (const href of DASHBOARD_NAV_HREFS) {
        router.prefetch(href);
      }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [router]);

  // Snap to the top of the new screen on navigation. Without this the browser
  // keeps the previous route's scroll offset (and `scroll-behavior: smooth`
  // can add vertical drift while the height changes), which reads as a
  // "previous page glitch". Instagram-style tabs start each screen at top.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);

  // Direction of the horizontal transition, derived from nav order. In RTL,
  // a later destination enters from the logical start (the left/right motion
  // is mirrored to keep navigation feeling natural).
  const activeScreen = getScreenIdFromPath(pathname);
  const targetIndex = DASHBOARD_NAV_ITEMS.findIndex((item) => item.id === activeScreen);
  const previousIndexRef = useRef(targetIndex);
  const direction = (targetIndex >= previousIndexRef.current ? 1 : -1) * (isRTL ? -1 : 1);

  useEffect(() => {
    previousIndexRef.current = targetIndex;
  }, [targetIndex]);

  return (
    <div className="min-h-screen bg-surface text-on-surface flex font-sans">
      <Sidebar />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 md:ms-64">
        <DemoModeBanner />
        <ProfileSyncBanner />
        <AnalyticsConsentPrompt />
        <EmailVerificationBanner />
        <SyncIssueBanner />
        <ClosedMonthBanner />
        <DashboardHeader />

        <main id="main-content" className="relative flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-6 pb-28 md:pb-12 overflow-x-clip">
          {/* Inner positioning context: the exiting screen is absolutely
              positioned against the CONTENT box (not the padded <main>), so
              it overlays the incoming screen exactly — no edge slivers. */}
          <div className="relative w-full">
            <AnimatePresence initial={false} custom={direction}>
              <motion.div
                key={pathname}
                custom={direction}
                variants={pageVariants}
                initial={reduceMotion ? false : 'enter'}
                animate={reduceMotion ? false : 'center'}
                exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : 'exit'}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                style={{ position: 'relative', zIndex: 1, willChange: 'transform, opacity' }}
              >
                {loading ? <DashboardSkeleton /> : children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      <QuickActions />
      <BottomNav />
      <DashboardModals />
    </div>
  );
}
