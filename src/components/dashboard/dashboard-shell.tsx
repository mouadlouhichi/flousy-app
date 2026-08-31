'use client';

import React, { useEffect, useRef } from 'react';
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
        className="p-1 hover:bg-tertiary/20 rounded-full"
        aria-label={m.notifications.dismissBanner}
      >
        <AppIcon name="close" className=" text-[18px]" />
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
        <EmailVerificationBanner />
        <DashboardHeader />

        <main className="relative flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-6 pb-28 md:pb-12 overflow-x-clip">
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
