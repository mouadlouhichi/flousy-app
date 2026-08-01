'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { AppIcon } from '@/components/ui/app-icon';
import { useDashboard } from './dashboard-provider';
import { getScreenIdFromPath, getVisibleNavItems } from './nav-items';
import { useHousehold } from '@/lib/household-context';
import { isProFeatureUnlocked } from '@/lib/household';

interface PillRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Floating glass bottom navigation (mobile only).
 *
 * Instagram-style scroll behavior: scrolling down compacts the bar a bit
 * (like the landing navbar reacting to scroll); scrolling back up — or
 * reaching the top — springs it back to full size.
 *
 * The active item is highlighted by a single background pill positioned in
 * the bar's LAYOUT space (measured from the active button's offset* values)
 * rather than a viewport-measured shared `layoutId`. Layout offsets do not
 * change when the whole bar zooms (compact state) or while the page content
 * transitions, so the pill always glides in one straight horizontal line
 * and stays glued to its button — never an "up, then left" diagonal drift.
 */
export function BottomNav() {
  const pathname = usePathname();
  const { isPro } = useDashboard();
  const { workspace } = useHousehold();
  const proUnlocked = isProFeatureUnlocked(isPro, workspace);
  const activeScreen = getScreenIdFromPath(pathname);
  const items = getVisibleNavItems(proUnlocked);
  const [isCompact, setIsCompact] = useState(false);
  // With 6 destinations (PRO) the icons need to shrink a touch to keep
  // comfortable tap targets without overflowing narrow viewports.
  const isCompactLayout = items.length > 5;

  const navRef = useRef<HTMLElement | null>(null);
  const [pillRect, setPillRect] = useState<PillRect | null>(null);

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

  // Measure the active button in nav-local layout space (transform-immune).
  useEffect(() => {
    const measure = () => {
      const activeBtn = navRef.current?.querySelector<HTMLElement>(
        `[data-nav-item="${activeScreen}"]`,
      );
      if (activeBtn) {
        setPillRect({
          x: activeBtn.offsetLeft,
          y: activeBtn.offsetTop,
          width: activeBtn.offsetWidth,
          height: activeBtn.offsetHeight,
        });
      }
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [activeScreen, items.length]);

  return (
    <motion.nav
      ref={navRef}
      initial={false}
      animate={{
        x: '-50%',
        scale: isCompact ? 0.88 : 1,
        y: isCompact ? 6 : 0,
      }}
      transition={{ type: 'spring', stiffness: 380, damping: 32, mass: 0.9 }}
      style={{ transformOrigin: 'bottom center' }}
      className="md:hidden fixed bottom-4 left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-md bg-surface/70 backdrop-blur-2xl border border-surface-variant/50 shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-full px-1.5 py-1.5 flex justify-between items-center gap-0.5"
    >
      {/* Active pill — glides horizontally behind the buttons (same spring
          language as the old layoutId pill / SegmentedControl). */}
      {pillRect && (
        <motion.span
          aria-hidden
          initial={false}
          animate={{
            x: pillRect.x,
            y: pillRect.y,
            width: pillRect.width,
            height: pillRect.height,
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 34, mass: 0.9 }}
          className="absolute left-0 top-0 rounded-full bg-primary shadow-sm"
        />
      )}

      {items.map((item) => {
        const isActive = activeScreen === item.id;
        return (
          <Link
            key={item.id}
            href={item.href}
            prefetch={false}
            data-nav-item={item.id}
            aria-label={item.label}
            title={item.label}
            // `flex-1` + `min-w-0` lets the bar share its width evenly, so the
            // 6th item PRO users get never pushes the pill off screen on
            // narrow phones (fixed horizontal padding used to overflow).
            className={`relative flex-1 min-w-0 py-3 rounded-full flex items-center justify-center transition-colors duration-300 ease-out ${
              isActive
                ? ''
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/40 active:scale-95'
            }`}
          >
            <AppIcon
              name={item.mobileIcon}
              className={`relative z-10 shrink-0 transition-transform duration-300 ${
                isCompactLayout ? 'text-[21px]' : 'text-[24px]'
              } ${
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
