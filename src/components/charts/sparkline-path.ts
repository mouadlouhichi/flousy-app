/**
 * Tiny SVG helpers shared by the balance rings: normalised values in, a
 * smooth Catmull-Rom → Bézier path out. Kept dependency-free so the rings
 * never have to load the Recharts bundle.
 */

export function sparkPoint(values: number[], i: number, w: number, h: number) {
  const x = (i / (values.length - 1)) * w;
  const y = h - Math.min(1, Math.max(0, values[i])) * (h - 8) - 4;
  return { x, y };
}

/** Smooth Catmull-Rom → Bézier path through normalised (0–1) points. */
export function buildSparkPath(values: number[], w: number, h: number): string {
  const pts = values.map((_, i) => sparkPoint(values, i, w, h));
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

/**
 * Squash an arbitrary series into the 0.12–0.88 band the sparkline draws in.
 * A flat series sits on the midline instead of collapsing to the baseline.
 */
export function normalizeSeries(values: number[]): number[] {
  if (values.length === 0) return [];
  const finite = values.map((v) => (Number.isFinite(v) ? v : 0));
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  if (max - min < 1e-9) return finite.map(() => 0.5);
  return finite.map((v) => 0.12 + ((v - min) / (max - min)) * 0.76);
}
