'use client';

import React, { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, type Variants } from 'motion/react';
import { AppIcon } from '@/components/ui/app-icon';
import { useDashboard } from './dashboard-provider';
import { DASHBOARD_NAV_ITEMS, getScreenIdFromPath } from './nav-items';
import { Sidebar } from './sidebar';
import { BottomNav } from './bottom-nav';
import { DashboardHeader } from './dashboard-header';
import { QuickActions } from './quick-actions';
import { DashboardModals } from './dashboard-modals';
import { DashboardSkeleton } from './dashboard-skeleton';

/**
 * Horizontal page transition: the outgoing screen slides away towards the
 * direction we came from while the incoming screen scrolls in from the
 * direction of the target page (based on nav order).
 */
const pageVariants: Variants = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 64 }),
  center: { opacity: 1, x: 0 },
  // The outgoing page is pulled out of layout flow while it fades away so it
  // cannot stack above/below the incoming one during the crossfade. Its
  // `position` is applied instantly (no easing) to avoid a layout jump.
  exit: (direction: number) => ({
    opacity: 0,
    x: direction * -64,
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    transition: { position: { duration: 0 } },
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
  const { loading } = useDashboard();

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

        {/* Routed screen content with a horizontal scroll transition.
            `mode="wait"` is deliberately NOT used: it defers the incoming
            page's enter animation until the outgoing page reports its exit as
            complete, and in this tree (whose screens mount Firestore
            subscriptions as they render) that callback can fail to fire. The
            new page then stays parked at its `enter` state — opacity 0 — so
            the route looked blank until any resize forced a repaint.
            Cross-fading instead keeps the animation self-contained: the
            incoming page animates in on its own, independently of the
            outgoing one, so content can never get stuck invisible. */}
        <main className="relative flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-6 pb-28 md:pb-12 overflow-x-clip">
          <AnimatePresence initial={false} custom={direction}>
            <motion.div
              key={pathname}
              custom={direction}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
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
