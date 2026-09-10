'use client';

import { motion, useReducedMotion } from 'motion/react';

/**
 * A pair of rolling dice — the visual identity of the "Random draw"
 * rotation. Rendered next to the rotation label on the detail screen and in
 * the editor when Random draw is selected.
 *
 * The roll is a transform-only keyframe loop (rotate + a small hop), so it
 * stays cheap on low-end phones; `useReducedMotion` collapses it to two
 * static dice. Colors inherit from the surrounding text (`currentColor`)
 * so the same component reads correctly on a primary chip and on a neutral
 * card.
 */

/** Pip layout per face value, as percentages of the die's box. */
const PIP_POSITIONS: Record<number, ReadonlyArray<readonly [number, number]>> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]],
};

function Die({ value, size }: { value: number; size: number }) {
  return (
    <span
      aria-hidden
      className="relative block rounded-[24%] border-[1.5px] border-current/40 bg-surface-container-lowest shadow-sm"
      style={{ width: size, height: size }}
    >
      {(PIP_POSITIONS[value] ?? PIP_POSITIONS[5]).map(([x, y], i) => (
        <span
          key={i}
          className="absolute rounded-full bg-current"
          style={{
            width: '17%',
            height: '17%',
            left: `${x}%`,
            top: `${y}%`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
    </span>
  );
}

export function DaratDice({
  size = 16,
  values = [5, 3],
  className = '',
}: {
  /** Side of one die, in px. */
  size?: number;
  /** The two faces shown ([first, second]). */
  values?: readonly [number, number];
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  // Two dice, each looping a roll: spin a full turn with a hop, pause, roll
  // again. The second die is offset so the pair reads as one throw.
  const roll = (delay: number) =>
    reduceMotion
      ? {}
      : {
          animate: {
            rotate: [0, -14, 170, 335, 360],
            y: [0, 0, -Math.round(size * 0.45), 0, 0],
          },
          transition: {
            duration: 1.05,
            times: [0, 0.18, 0.5, 0.82, 1],
            ease: 'easeInOut' as const,
            repeat: Infinity,
            repeatDelay: 2.6,
            delay,
          },
        };

  return (
    <span className={`inline-flex items-center gap-[18%] ${className}`} aria-hidden>
      <motion.span className="inline-block will-change-transform" {...roll(0)}>
        <Die value={values[0]} size={size} />
      </motion.span>
      <motion.span className="inline-block will-change-transform" {...roll(0.14)}>
        <Die value={values[1]} size={size * 0.82} />
      </motion.span>
    </span>
  );
}
