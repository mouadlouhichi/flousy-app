'use client';

import { useEffect, type RefObject } from 'react';

export type CanvasDraw = (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  time: number,
) => void;

/**
 * Shared lifecycle for the decorative canvas animations.
 *
 * - Device-pixel-ratio is capped (retina 3x canvases cost ~4x the pixels for
 *   a barely-visible background).
 * - The loop pauses whenever the canvas is off-screen (IntersectionObserver).
 * - `prefers-reduced-motion` gets a single static frame and no animation
 *   loop at all.
 */
export function useAnimatedCanvas(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  draw: CanvasDraw,
  dprCap = 1.5,
) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    let time = 0;
    let raf = 0;
    let active = false;

    const frame = () => {
      if (!active) return;
      draw(ctx, canvas, time);
      time += 0.02;
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (active || reducedMotion) return;
      active = true;
      raf = requestAnimationFrame(frame);
    };

    const stop = () => {
      active = false;
      cancelAnimationFrame(raf);
    };

    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => (e.isIntersecting ? start() : stop())),
      { rootMargin: '100px' },
    );
    observer.observe(canvas);

    resize();
    if (reducedMotion) draw(ctx, canvas, 0);

    window.addEventListener('resize', resize);
    return () => {
      stop();
      observer.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [canvasRef, draw, dprCap]);
}
