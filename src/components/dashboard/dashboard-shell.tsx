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

/**
 * Instagram-style push transition: the incoming screen slides in from the
 * direction we came from, on top of the outgoing screen, while the outgoing
 * screen stays put and quickly scales/fades underneath. Both run at the same
 * time (AnimatePresence default mode) and the whole thing is short — it
 * starts on click, never waits for a fetch, a spinner or an exit callback.
 *
 * The content is instant because every dashboard route is prerendered and
 * prefetched (see the prefetch effect below), so navigation is a synchronous
 * client-side route change.
 */
const pageVariants: Variants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction * 56,
    scale: 0.985,
  }),
  center: { opacity: 1, x: 0, scale: 1 },
  // Outgoing screen: pinned under the incoming one (absolute), quick scale
  // down + fade — the `position` change is instant to avoid a layout jump.
  exit: (direction: number) => ({
    opacity: 0.4,
    x: direction * -12,
    scale: 0.975,
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    transition: {
      position: { duration: 0 },
      opacity: { duration: 0.14, ease: 'easeOut' },
      x: { duration: 0.16, ease: [0.4, 0, 0.2, 1] },
      scale: { duration: 0.16, ease: [0.4, 0, 0.2, 1] },
    },
  }),
};

function EmailVerificationBanner() {
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
        <span>Please verify your email address to secure your account.</span>
        {verificationSent ? (
          <span className="font-bold underline ml-xs">Verification email sent!</span>
        ) : (
          <button onClick={sendVerification} className="font-bold underline ml-xs hover:opacity-80">
            Resend email
          </button>
        )}
      </div>
      <button
        onClick={() => setDismissVerificationBanner(true)}
        className="p-1 hover:bg-tertiary/20 rounded-full"
        aria-label="Dismiss banner"
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

  // Direction of the horizontal transition, derived from nav order:
  // navigating to a higher-index screen slides in from the right.
  const activeScreen = getScreenIdFromPath(pathname);
  const targetIndex = DASHBOARD_NAV_ITEMS.findIndex((item) => item.id === activeScreen);
  const previousIndexRef = useRef(targetIndex);
  const direction = targetIndex >= previousIndexRef.current ? 1 : -1;

  useEffect(() => {
    previousIndexRef.current = targetIndex;
  }, [targetIndex]);

  return (
    <div className="min-h-screen bg-surface text-on-surface flex font-sans">
      <Sidebar />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-64">
        <EmailVerificationBanner />
        <DashboardHeader />

        <main className="relative flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-6 pb-28 md:pb-12 overflow-x-clip">
          <AnimatePresence initial={false} custom={direction}>
            <motion.div
              key={pathname}
              custom={direction}
              variants={pageVariants}
              initial={reduceMotion ? false : 'enter'}
              animate={reduceMotion ? false : 'center'}
              exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : 'exit'}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              style={{ willChange: 'transform, opacity' }}
            >
              {loading ? <DashboardSkeleton /> : children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <QuickActions />
      <BottomNav />
      <DashboardModals />
    </div>
  );
}
