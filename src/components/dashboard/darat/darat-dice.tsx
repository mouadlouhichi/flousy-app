'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useLanguage } from '@/lib/i18n-context';

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

/**
 * The one-shot draw roll: the "Random draw" is resolved exactly once, when
 * the circle is created — this component plays that single roll and settles
 * on the faces `faces` lands it on. Pips cycle while the dice are in the
 * air, which reads as a real draw rather than a decorative loop.
 *
 * `onDone` fires when the dice come to rest (immediately when the user has
 * reduced motion) — the reveal of the drawn order hangs off that callback.
 */
export function DaratDiceDraw({
  size = 26,
  faces = [5, 3],
  onDone,
  className = '',
}: {
  /** Side of one die, in px. */
  size?: number;
  /** The two faces the roll settles on. */
  faces?: readonly [number, number];
  /** Called once, when the roll has finished (immediately if motion is reduced). */
  onDone?: () => void;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const [faceA, setFaceA] = useState(faces[0]);
  const [faceB, setFaceB] = useState(faces[1]);
  const finishedRef = useRef(false);

  useEffect(() => {
    const finish = () => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      setFaceA(faces[0]);
      setFaceB(faces[1]);
      onDone?.();
    };
    if (reduceMotion) {
      finish();
      return;
    }
    // While the dice are in the air the pips keep cycling, so the roll does
    // not look like two dice spinning around a fixed face.
    let tick = 0;
    const pipTimer = setInterval(() => {
      tick += 1;
      setFaceA(1 + ((tick * 7 + 2) % 6));
      setFaceB(1 + ((tick * 5 + 4) % 6));
    }, 110);
    // The spin keyframes run 1.05s (the second die starts 0.14s late); let
    // the last bit of settle breathe before the pips lock to the result.
    const restTimer = setTimeout(finish, 1300);
    return () => {
      clearInterval(pipTimer);
      clearTimeout(restTimer);
    };
    // One draw per mount: the component is mounted once for the circle that
    // was just created, and a re-roll would describe a different circle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            delay,
          },
        };

  return (
    <span className={`inline-flex items-center gap-[18%] ${className}`} aria-hidden>
      <motion.span className="inline-block will-change-transform" {...roll(0)}>
        <Die value={faceA} size={size} />
      </motion.span>
      <motion.span className="inline-block will-change-transform" {...roll(0.14)}>
        <Die value={faceB} size={size * 0.82} />
      </motion.span>
    </span>
  );
}

/**
 * The post-create "Random draw" panel: plays the one-shot roll, then reveals
 * the drawn payout order (round 1 → seat, round 2 → seat, …). The landing
 * faces are derived from the circle id, so the same draw always lands on the
 * same faces — a re-render or refresh of the summary never shows a different
 * result for the same circle.
 */
export function DaratDrawPanel({
  circleId,
  seats,
  seatLabel,
}: {
  /** The circle that was just created (stable per draw). */
  circleId: string;
  /** Seat ids (uid or phone placeholder) in the drawn payout order. */
  seats: string[];
  /** Resolves a seat id to the name the organizer knows for it. */
  seatLabel: (seatId: string) => string;
}) {
  const { messages: m } = useLanguage();
  const [revealed, setRevealed] = useState(false);

  // Deterministic in the circle id (31-rolling hash, same family the app
  // uses elsewhere): two faces in 1..6.
  const faces = useMemo<[number, number]>(() => {
    let h = 0;
    for (let i = 0; i < circleId.length; i++) {
      h = (Math.imul(h, 31) + circleId.charCodeAt(i)) >>> 0;
    }
    return [1 + (h % 6), 1 + ((h >>> 3) % 6)];
  }, [circleId]);

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-lime-deep/40 bg-lime/10 p-3.5 dark:border-lime/30 dark:bg-lime/5">
      <div className="flex items-center gap-3">
        <DaratDiceDraw size={24} faces={faces} onDone={() => setRevealed(true)} className="shrink-0 text-forest-deep dark:text-lime" />
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-on-surface">{m.darat.create.drawTitle}</p>
          <p className="text-[11px] leading-relaxed text-on-surface-variant">{m.darat.create.drawHint}</p>
        </div>
      </div>
      {revealed ? (
        <ol className="flex flex-col gap-1.5 pt-0.5">
          {seats.map((seatId, i) => (
            <motion.li
              key={seatId}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.08, ease: 'easeOut' }}
              className="flex list-none items-center gap-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-forest text-[11px] font-semibold text-lime">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-on-surface">{seatLabel(seatId)}</span>
            </motion.li>
          ))}
        </ol>
      ) : (
        <p className="animate-pulse text-[12px] font-medium text-on-surface-variant">{m.darat.create.drawRolling}</p>
      )}
    </div>
  );
}
