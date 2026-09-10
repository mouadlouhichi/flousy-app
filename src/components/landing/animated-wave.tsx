"use client";

import { useRef } from "react";
import { useAnimatedCanvas } from "./use-animated-canvas";

// Forest ink in light mode, lime in dark mode — read once per frame so the
// canvases follow the theme toggle without a remount.
function ink(): string {
  if (typeof document !== "undefined" && document.documentElement.classList.contains("dark")) return "197, 230, 166";
  return "15, 59, 54";
}

const chars = "·∘○◯◌●◉";

function drawWave(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, time: number) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  ctx.clearRect(0, 0, rect.width, rect.height);
  const INK = ink();

  ctx.font = "14px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const cols = Math.floor(rect.width / 20);
  const rows = Math.floor(rect.height / 20);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const px = (x + 0.5) * (rect.width / cols);
      const py = (y + 0.5) * (rect.height / rows);

      // Multiple wave interference
      const wave1 = Math.sin(x * 0.2 + time * 2) * Math.cos(y * 0.15 + time);
      const wave2 = Math.sin((x + y) * 0.1 + time * 1.5);
      const wave3 = Math.cos(x * 0.1 - y * 0.1 + time * 0.8);

      const combined = (wave1 + wave2 + wave3) / 3;
      const normalized = (combined + 1) / 2;

      const charIndex = Math.floor(normalized * (chars.length - 1));
      const alpha = 0.15 + normalized * 0.5;

      ctx.fillStyle = `rgba(${INK}, ${alpha})`;
      ctx.fillText(chars[charIndex], px, py);
    }
  }
}

/** Decorative ASCII wave (runs via the shared canvas hook). */
export function AnimatedWave() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useAnimatedCanvas(canvasRef, drawWave);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: "block" }}
    />
  );
}
