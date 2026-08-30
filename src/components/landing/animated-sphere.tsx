"use client";

import { useRef } from "react";
import { useAnimatedCanvas } from "./use-animated-canvas";

const chars = "░▒▓█▀▄▌▐│─┤├┴┬╭╮╰╯";

function drawSphere(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, time: number) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  ctx.clearRect(0, 0, rect.width, rect.height);

  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const radius = Math.min(rect.width, rect.height) * 0.525;

  ctx.font = "12px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const step = 0.18;
  const points: { x: number; y: number; z: number; char: string }[] = [];

  for (let phi = 0; phi < Math.PI * 2; phi += step) {
    for (let theta = 0; theta < Math.PI; theta += step) {
      const x = Math.sin(theta) * Math.cos(phi + time * 0.5);
      const y = Math.sin(theta) * Math.sin(phi + time * 0.5);
      const z = Math.cos(theta);

      // Rotate around Y axis
      const rotY = time * 0.3;
      const newX = x * Math.cos(rotY) - z * Math.sin(rotY);
      const newZ = x * Math.sin(rotY) + z * Math.cos(rotY);

      // Rotate around X axis
      const rotX = time * 0.2;
      const newY = y * Math.cos(rotX) - newZ * Math.sin(rotX);
      const finalZ = y * Math.sin(rotX) + newZ * Math.cos(rotX);

      const depth = (finalZ + 1) / 2;
      const charIndex = Math.floor(depth * (chars.length - 1));

      points.push({
        x: centerX + newX * radius,
        y: centerY + newY * radius,
        z: finalZ,
        char: chars[charIndex],
      });
    }
  }

  // Sort by z for depth
  points.sort((a, b) => a.z - b.z);

  points.forEach((point) => {
    const alpha = 0.2 + (point.z + 1) * 0.4;
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.fillText(point.char, point.x, point.y);
  });
}

/**
 * Decorative ASCII sphere — runs through the shared canvas hook so it
 * respects reduced motion, pauses off-screen and caps the DPR.
 */
export function AnimatedSphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useAnimatedCanvas(canvasRef, drawSphere);

  return <canvas ref={canvasRef} className="w-full h-full" style={{ display: "block" }} />;
}
