'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { AppIcon } from '@/components/ui/app-icon';
import { useDashboard } from './dashboard-provider';
import { getLocalizedNavLabel, getScreenIdFromPath, getVisibleNavItems } from './nav-items';
import { useHousehold } from '@/lib/household-context';
import { isProFeatureUnlocked } from '@/lib/household';
import { useLanguage } from '@/lib/i18n-context';

interface PillRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Floating forest-green bottom navigation (mobile only) — the dark pill
 * dock from the reference design. The active destination gets a white
 * circular puck that glides horizontally between buttons.
 *
 * Instagram-style scroll behavior: scrolling down compacts the bar a bit;
 * scrolling back up — or reaching the top — springs it back to full size.
 *
 * The puck is positioned in the bar's LAYOUT space (measured from the active
 * button's offset* values) rather than a viewport-measured shared `layoutId`.
 * Layout offsets do not change when the whole bar zooms (compact state) or
 * while the page content transitions, so the puck always glides in one
 * straight horizontal line and stays glued to its button.
 */
export function BottomNav() {
  const pathname = usePathname();
  const { messages: m } = useLanguage();
  const { isPro } = useDashboard();
  const { workspace, household } = useHousehold();
  const proUnlocked = isProFeatureUnlocked(isPro, workspace, household);
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
  // Profile (and any other screen missing from the bar) must clear the puck —
  // otherwise the last destination stays highlighted while you're elsewhere.
  useEffect(() => {
    const measure = () => {
      const activeBtn = navRef.current?.querySelector<HTMLElement>(
        `[data-nav-item="${activeScreen}"]`,
      );
      if (activeBtn) {
        // The puck is a circle centred in the button: as wide as the button
        // is tall so it never stretches into a lozenge.
        const size = activeBtn.offsetHeight;
        setPillRect({
          x: activeBtn.offsetLeft + (activeBtn.offsetWidth - size) / 2,
          y: activeBtn.offsetTop,
          width: size,
          height: size,
        });
      } else {
        setPillRect(null);
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
        scale: isCompact ? 0.9 : 1,
        y: isCompact ? 6 : 0,
      }}
      transition={{ type: 'spring', stiffness: 380, damping: 32, mass: 0.9 }}
      style={{ transformOrigin: 'bottom center' }}
      className="md:hidden fixed bottom-4 left-1/2 z-40 w-[calc(100%-2.5rem)] max-w-sm surface-forest border border-white/10 shadow-forest rounded-full dark:border-lime/20 px-2 py-2 flex justify-between items-center gap-0.5"
    >
      {/* Active puck — glides horizontally behind the buttons. */}
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
          className="absolute left-0 top-0 rounded-full bg-white shadow-[0_6px_18px_-6px_rgba(0,0,0,0.5)] dark:bg-lime"
        />
      )}

      {items.map((item) => {
        const isActive = activeScreen === item.id;
        return (
          <Link
            key={item.id}
            href={item.href}
            prefetch={true}
            data-nav-item={item.id}
            aria-label={getLocalizedNavLabel(item, m)}
            aria-current={isActive ? 'page' : undefined}
            title={getLocalizedNavLabel(item, m)}
            // `flex-1` + `min-w-0` lets the bar share its width evenly, so the
            // 6th item PRO users get never pushes the puck off screen on
            // narrow phones (fixed horizontal padding used to overflow).
            className={`relative flex-1 min-w-0 h-12 rounded-full flex items-center justify-center transition-colors duration-300 ease-out ${
              isActive ? '' : 'text-white/70 hover:text-white active:scale-95'
            }`}
          >
            <AppIcon
              name={item.mobileIcon}
              strokeWidth={isActive ? 2.2 : 1.8}
              className={`relative z-10 shrink-0 transition-transform duration-300 ${
                isCompactLayout ? 'text-[20px]' : 'text-[22px]'
              } ${isActive ? 'text-forest dark:text-forest-deep animate-bounce-subtle' : ''}`}
            />
          </Link>
        );
      })}
    </motion.nav>
  );
}
