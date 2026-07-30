'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { AppIcon } from '@/components/ui/app-icon';
import { useDashboard } from './dashboard-provider';
import { getScreenIdFromPath, getVisibleNavItems } from './nav-items';

/**
 * Floating glass bottom navigation (mobile only).
 *
 * Instagram-style scroll behavior: scrolling down compacts the bar a bit
 * (like the landing navbar reacting to scroll); scrolling back up — or
 * reaching the top — springs it back to full size.
 *
 * The active item is highlighted by a single background pill that slides
 * horizontally from the current page's button to the target page's button
 * whenever the route changes (shared `layoutId` animation).
 */
export function BottomNav() {
  const pathname = usePathname();
  const { isPro } = useDashboard();
  const activeScreen = getScreenIdFromPath(pathname);
  const items = getVisibleNavItems(isPro);
  const [isCompact, setIsCompact] = useState(false);

  // Track scroll direction with a small dead zone to avoid jitter.
  useEffect(() => {
    let lastY = window.scrollY;

    const handleScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY;
      if (y <= 24) {
        setIsCompact(false); // near the top: always full size
      } else if (delta > 6) {
        setIsCompact(true); // scrolling down: compact
      } else if (delta < -6) {
        setIsCompact(false); // scrolling up: restore
      }
      lastY = y;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <motion.nav
      initial={false}
      animate={{
        x: '-50%',
        scale: isCompact ? 0.88 : 1,
        y: isCompact ? 6 : 0,
      }}
      transition={{ type: 'spring', stiffness: 380, damping: 32, mass: 0.9 }}
      style={{ transformOrigin: 'bottom center' }}
      className="md:hidden fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-md bg-surface/70 backdrop-blur-2xl border border-surface-variant/50 shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-full px-2 py-1.5 flex justify-around items-center"
    >
      {items.map((item) => {
        const isActive = activeScreen === item.id;
        return (
          <Link
            key={item.id}
            href={item.href}
            prefetch={false}
            aria-label={item.label}
            title={item.label}
            className={`relative px-5 py-3 rounded-full flex items-center justify-center transition-colors duration-300 ease-out ${
              isActive
                ? ''
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/40 active:scale-95'
            }`}
          >
            {/* Sliding active background — scrolls horizontally from the
                previously active item to this one on navigation. */}
            {isActive && (
              <motion.span
                layoutId="dashboard-active-nav-bg"
                className="absolute inset-0 rounded-full bg-primary shadow-sm"
                transition={{ type: 'spring', stiffness: 400, damping: 34, mass: 0.9 }}
              />
            )}
            <AppIcon
              name={item.mobileIcon}
              className={`relative z-10 text-[24px] transition-transform duration-300 ${
                isActive
                  ? 'text-on-primary filled animate-bounce-subtle'
                  : 'text-on-surface-variant'
              }`}
            />
          </Link>
        );
      })}
    </motion.nav>
  );
}
