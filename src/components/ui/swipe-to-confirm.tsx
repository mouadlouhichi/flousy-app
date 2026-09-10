'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { AppIcon } from '@/components/ui/app-icon';
import { cn } from '@/lib/utils';

interface SwipeToConfirmProps {
  /** Visible label on the track; also the accessible name of the control. */
  label: string;
  /** Short caption announced/shown once the swipe completes. */
  successLabel: string;
  /**
   * Called once the knob is released past the threshold (after the success
   * animation). Return `false` to reject: the knob springs back and the track
   * shakes — use this for validation that can only run on submit.
   */
  onConfirm: () => boolean | void;
  /** Disable dragging (e.g. while a previous confirm is in flight). */
  disabled?: boolean;
  /** Mirror the direction for right-to-left layouts. */
  rtl?: boolean;
  className?: string;
}

const TRACK = 56; // px — matches the h-14 track
const KNOB = 44; // px — matches the h-11 knob
const INSET = (TRACK - KNOB) / 2; // px — track padding around the knob
const THRESHOLD = 0.85; // share of the travel that counts as "swiped"

/**
 * "Swipe to confirm" pill from the reference converter screen. The white
 * chevron knob drags horizontally along the forest track; lime fills in
 * behind it and the label fades as it travels. Past 85 % the knob snaps to the
 * end, turns into a check and the track flashes before `onConfirm` fires;
 * released earlier it springs back to the start.
 *
 * Keyboard and assistive-tech users get a regular button: Enter/Space on the
 * focused control runs the same success animation and confirms. Reduced
 * motion skips the travel and confirms immediately.
 */
export function SwipeToConfirm({ label, successLabel, onConfirm, disabled = false, rtl = false, className }: SwipeToConfirmProps) {
  const reduceMotion = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const [travel, setTravel] = useState(0);
  const [state, setState] = useState<'idle' | 'dragging' | 'success' | 'rejected'>('idle');
  const x = useMotionValue(0);
  const dir = rtl ? -1 : 1;

  // Travel = track width − knob − padding; re-measured on resize so the
  // threshold stays correct when the sheet changes width.
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => setTravel(Math.max(0, el.clientWidth - KNOB - INSET * 2));
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(el);
    return () => observer?.disconnect();
  }, []);

  // Progress 0–1 along the travel, direction-agnostic.
  const progress = useTransform(x, (value) => (travel > 0 ? Math.min(1, Math.max(0, (value * dir) / travel)) : 0));
  // The fill ends under the knob's centre so its rounded tip stays hidden
  // behind the knob, and it only appears once the knob actually moves — at
  // rest the knob sits on the plain track with no halo around it.
  const fillWidth = useTransform(progress, (p) => `${TRACK / 2 + p * travel}px`);
  const fillOpacity = useTransform(progress, [0, 0.05], [0, 1]);
  const labelOpacity = useTransform(progress, [0, 0.75], [1, 0]);
  const labelShift = useTransform(progress, (p) => p * 12 * dir);
  const hintOpacity = useTransform(progress, [0, 0.35], [1, 0]);

  const resetKnob = () => {
    setState('idle');
    animate(x, 0, { type: 'spring', stiffness: 520, damping: 34 });
  };

  const complete = () => {
    if (disabled || state === 'success') return;
    const finish = () => {
      const result = onConfirm();
      if (result === false) {
        setState('rejected');
        // Snap back + a short shake on the track so the rejection is visible
        // even when the validation error is rendered far above.
        animate(x, 0, { type: 'spring', stiffness: 520, damping: 34 });
        window.setTimeout(() => setState('idle'), 450);
      }
    };
    if (reduceMotion) {
      setState('success');
      x.set(travel * dir);
      finish();
      return;
    }
    setState('success');
    animate(x, travel * dir, { type: 'spring', stiffness: 420, damping: 30 });
    // Let the check + flash play before handing over (the caller usually
    // closes the sheet, so this is the whole "it worked" moment).
    window.setTimeout(finish, 520);
  };

  // If the parent rejects synchronously we already reset; if it confirms and
  // the component stays mounted (no close), allow another swipe after a beat.
  useEffect(() => {
    if (state !== 'success') return;
    const timer = window.setTimeout(() => {
      setState((current) => (current === 'success' ? 'idle' : current));
      x.set(0);
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [state, x]);

  const isSuccess = state === 'success';

  return (
    <div className={cn('relative', className)}>
      <motion.div
        ref={trackRef}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        aria-label={label}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            complete();
          }
        }}
        animate={
          state === 'rejected' && !reduceMotion
            ? { x: [0, -6, 6, -4, 4, 0] }
            : isSuccess && !reduceMotion
              ? { scale: [1, 1.015, 1] }
              : { x: 0, scale: 1 }
        }
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className={cn(
          'relative h-14 w-full select-none overflow-hidden rounded-full bg-forest text-[15px] font-semibold text-white shadow-forest outline-none transition-colors',
          'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
          'dark:bg-lime dark:text-forest-deep',
          // Disabled: the track goes muted but the knob stays crisp white so the
          // control still reads as the swipe pill from the reference.
          disabled && 'cursor-not-allowed bg-forest/45 text-white/90 shadow-none dark:bg-lime/40 dark:text-forest-deep/80',
        )}
        style={{ touchAction: 'pan-y' }}
      >
        {/* Lime fill trailing the knob */}
        <motion.div
          aria-hidden
          className={cn('absolute inset-y-0 rounded-full bg-lime dark:bg-forest', rtl ? 'right-0' : 'left-0')}
          style={{ width: fillWidth, opacity: fillOpacity }}
        />

        {/* Full fill once the swipe completes */}
        <motion.div
          aria-hidden
          className="absolute inset-0 bg-lime dark:bg-forest"
          initial={false}
          animate={{ opacity: isSuccess ? 1 : 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.25 }}
        />

        {/* Label */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          style={{ opacity: isSuccess ? 0 : labelOpacity, x: labelShift }}
        >
          {label}
        </motion.span>

        {/* Success caption */}
        <motion.span
          className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-forest-deep dark:text-lime"
          initial={false}
          animate={{ opacity: isSuccess ? 1 : 0, y: isSuccess ? 0 : 6 }}
          transition={{ duration: 0.25, delay: isSuccess ? 0.15 : 0 }}
          aria-live="polite"
        >
          {isSuccess && (
            <>
              <AppIcon name="check_circle" strokeWidth={2.4} className="text-[18px]" />
              {successLabel}
            </>
          )}
        </motion.span>

        {/* Faint end-of-track chevrons */}
        <motion.span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-y-0 flex w-11 items-center justify-center text-white/35 dark:text-forest-deep/40',
            rtl ? 'left-1.5' : 'right-1.5',
          )}
          style={{ opacity: hintOpacity }}
        >
          <AppIcon name="chevrons_right" strokeWidth={2.4} className={cn('text-[20px]', rtl && '-scale-x-100')} />
        </motion.span>

        {/* Knob */}
        <motion.div
          aria-hidden
          drag={disabled || isSuccess ? false : 'x'}
          dragConstraints={rtl ? { left: -travel, right: 0 } : { left: 0, right: travel }}
          dragElastic={0.04}
          dragMomentum={false}
          onDragStart={() => setState('dragging')}
          onDragEnd={() => {
            const p = travel > 0 ? (x.get() * dir) / travel : 0;
            if (p >= THRESHOLD) complete();
            else resetKnob();
          }}
          whileDrag={{ scale: 1.04 }}
          style={{ x, top: INSET, [rtl ? 'right' : 'left']: INSET, width: KNOB, height: KNOB }}
          className={cn(
            'absolute flex cursor-grab items-center justify-center rounded-full bg-white text-forest shadow-[0_6px_16px_-6px_rgba(0,0,0,0.5)] ring-1 ring-black/5 transition-colors duration-300 active:cursor-grabbing',
            disabled && 'cursor-not-allowed text-forest/60 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.35)]',
            isSuccess && 'bg-forest-deep text-lime dark:bg-lime dark:text-forest-deep',
          )}
        >
          <motion.span
            key={isSuccess ? 'check' : 'chevrons'}
            initial={reduceMotion ? false : { scale: 0.6, rotate: isSuccess ? -90 : 0, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 26 }}
            className="flex"
          >
            <AppIcon
              name={isSuccess ? 'check' : 'chevrons_right'}
              strokeWidth={2.6}
              className={cn('text-[20px]', rtl && !isSuccess && '-scale-x-100')}
            />
          </motion.span>
        </motion.div>
      </motion.div>
    </div>
  );
}
