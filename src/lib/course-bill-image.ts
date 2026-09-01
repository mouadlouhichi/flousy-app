import { formatCurrency } from './currency';
import { sessionUnits } from './course-session';
import type { CourseSession } from './store';

export interface CourseBillImageLabels {
  /** Localized heading shown on the receipt. */
  title: string;
  items: string;
  total: string;
  paidFrom: string;
  place: string;
  /** A locale-formatted session date. */
  date?: string;
  /** Fallback for an item with no name. */
  unnamedItem?: string;
  /** Used for locale-aware currency formatting. */
  locale?: string;
  direction?: 'ltr' | 'rtl';
  appName?: string;
  /** Data URL for the app mark (same as the dashboard header logo). */ 
  logoHref?: string;
  /** Footer line under the receipt (e.g. "Thank you for your visit"). */
  thanks?: string;
}

// --- Paper receipt geometry ---------------------------------------------------

const IMAGE_WIDTH = 1080;
const PAPER_X0 = 96; // paper left edge
const PAPER_X1 = IMAGE_WIDTH - 96; // paper right edge (984)
const INNER = 56; // text inset from the paper edges
const PAPER_TOP = 56;
const ROW_HEIGHT = 98;
const RULE1_Y = 356;
const ITEMS_TOP = RULE1_Y + 44;
const NOTCH = 22; // torn-edge depth
const SEG = 44; // torn-edge segment width

// Ink-on-paper palette (monochrome + one brand accent).
const INK = '#171d1c';
const MUTED = '#6b7571';
const RULE = '#c9d1ce';
const ACCENT = '#00685f';
const BACKDROP = '#efece4';
const MONO = "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace";

function escapeSvgText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function compactText(value: string, maxLength: number): string {
  const chars = Array.from(value.replace(/\s+/g, ' ').trim());
  if (chars.length <= maxLength) return chars.join('');
  return `${chars.slice(0, Math.max(0, maxLength - 1)).join('')}…`;
}

/** A deterministic PRNG so the faux barcode is stable per bill. */
function seededRandom(seed: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h >>> 13;
    h = Math.imul(h, 2246822507);
    h ^= h >>> 16;
    return ((h >>> 0) % 100000) / 100000;
  };
}

/** A short, stable "receipt number" derived from the session id/date. */
function receiptNumber(session: CourseSession): string {
  const digits = (session.id || '').replace(/\D/g, '') || (session.date || '').replace(/\D/g, '');
  return (digits + '000000000000').slice(0, 12);
}

/** A predictable filename that makes a shared/downloaded image easy to find. */
export function courseBillImageFilename(session: Pick<CourseSession, 'date'>): string {
  return `smartjib-course-${session.date}.png`;
}

/**
 * Renders the course bill as a self-contained SVG in the style of a paper
 * receipt: white paper with a torn bottom edge, monospace line items with
 * dotted leaders, dashed separators and a faux barcode footer. Keeping the
 * layout as a pure string makes it testable and lets the browser convert the
 * same visual receipt to a PNG for the native share sheet.
 */
export function renderCourseBillImageSvg(
  session: CourseSession,
  labels: CourseBillImageLabels,
): string {
  const direction = labels.direction === 'rtl' ? 'rtl' : 'ltr';
  const isRtl = direction === 'rtl';
  const locale = labels.locale;

  const startX = isRtl ? PAPER_X1 - INNER : PAPER_X0 + INNER;
  const endX = isRtl ? PAPER_X0 + INNER : PAPER_X1 - INNER;
  const startAnchor = isRtl ? 'end' : 'start';
  const endAnchor = isRtl ? 'start' : 'end';
  const ruleFrom = PAPER_X0 + INNER;
  const ruleTo = PAPER_X1 - INNER;

  const totalItems = sessionUnits(session);
  const brand = labels.appName || 'SmartJib';
  const logoHref = labels.logoHref || '/logo.png';
  const meta = `${labels.date ?? session.date}  •  ${new Intl.NumberFormat(locale).format(totalItems)} ${labels.items}  •  ${session.currency}`;

  // Vertical layout, derived from the item count so the paper always fits.
  const itemsBottom = ITEMS_TOP + session.items.length * ROW_HEIGHT;
  const rule2Y = itemsBottom + 12;
  const totalsTop = rule2Y + 44;
  const rule3Y = totalsTop + 132;
  const footerTop = rule3Y + 40;
  const paperBottom = footerTop + 178;
  const imageHeight = paperBottom + 40;

  const dashedRule = (y: number): string =>
    `<line x1="${ruleFrom}" y1="${y}" x2="${ruleTo}" y2="${y}" stroke="${RULE}" stroke-width="2" stroke-dasharray="3 7" stroke-linecap="round" />`;

  const header = `
  <image href="${escapeSvgText(logoHref)}" x="${IMAGE_WIDTH / 2 - 92}" y="108" width="52" height="56" preserveAspectRatio="xMidYMid meet" />
  <text x="${IMAGE_WIDTH / 2 + 28}" y="148" text-anchor="start" font-family="Arial, sans-serif" font-size="36" font-weight="800" fill="${ACCENT}">${escapeSvgText(brand)}</text>
  <text x="${IMAGE_WIDTH / 2}" y="206" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="600" fill="${MUTED}">${escapeSvgText(labels.title)}</text>
  <text x="${IMAGE_WIDTH / 2}" y="242" text-anchor="middle" font-family="${MONO}" font-size="20" font-weight="500" fill="${MUTED}">${escapeSvgText(meta)}</text>`;

  // Dotted leaders run from just past the (truncated) name to just before
  // the amount column, echoing a real till receipt.
  const leaderFrom = isRtl ? startX - 470 : startX + 470;
  const leaderTo = isRtl ? endX + 210 : endX - 210;

  const rows = session.items
    .map((line, index) => {
      const top = ITEMS_TOP + index * ROW_HEIGHT;
      const name = compactText(line.name || labels.unnamedItem || 'Unnamed item', 26);
      const detail = `${line.qty} × ${formatCurrency(line.unitPrice, session.currency, locale)}`;
      const amount = formatCurrency(line.lineTotal, session.currency, locale);

      return `
  <text x="${startX}" y="${top + 40}" text-anchor="${startAnchor}" font-family="${MONO}" font-size="28" font-weight="700" fill="${INK}">${escapeSvgText(name)}</text>
  <text x="${endX}" y="${top + 44}" text-anchor="${endAnchor}" font-family="${MONO}" font-size="30" font-weight="700" fill="${INK}">${escapeSvgText(amount)}</text>
  <line x1="${leaderFrom}" y1="${top + 30}" x2="${leaderTo}" y2="${top + 30}" stroke="${RULE}" stroke-width="2" stroke-dasharray="3 7" stroke-linecap="round" />
  <text x="${startX}" y="${top + 74}" text-anchor="${startAnchor}" font-family="${MONO}" font-size="20" font-weight="500" fill="${MUTED}">${escapeSvgText(detail)}</text>`;
    })
    .join('');

  const totals = `
  ${dashedRule(rule2Y)}
  <text x="${startX}" y="${totalsTop + 46}" text-anchor="${startAnchor}" font-family="Arial, sans-serif" font-size="20" font-weight="800" letter-spacing="3" fill="${MUTED}">${escapeSvgText(labels.total.toUpperCase())}</text>
  <text x="${endX}" y="${totalsTop + 54}" text-anchor="${endAnchor}" font-family="Arial, sans-serif" font-size="44" font-weight="800" fill="${ACCENT}">${escapeSvgText(formatCurrency(session.total, session.currency, locale))}</text>
  <text x="${startX}" y="${totalsTop + 94}" text-anchor="${startAnchor}" font-family="Arial, sans-serif" font-size="22" font-weight="600" fill="${MUTED}">${escapeSvgText(`${labels.paidFrom}: ${labels.place}`)}</text>
  ${dashedRule(rule3Y)}`;

  // Faux barcode — deterministic stripes so the receipt reads as "printed".
  const barcodeTop = footerTop + 66;
  const rng = seededRandom(`${session.id}|${session.date}|${session.total}`);
  let bars = '';
  let barX = IMAGE_WIDTH / 2 - 170;
  const barEnd = IMAGE_WIDTH / 2 + 170;
  while (barX < barEnd - 4) {
    const width = 3 + Math.floor(rng() * 7);
    const gap = 2 + Math.floor(rng() * 5);
    bars += `<rect x="${Math.round(barX)}" y="${barcodeTop}" width="${width}" height="52" fill="${INK}" />`;
    barX += width + gap;
  }

  const footer = `
  <text x="${IMAGE_WIDTH / 2}" y="${footerTop + 40}" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="${INK}">${escapeSvgText(labels.thanks ?? '')}</text>
  ${bars}
  <text x="${IMAGE_WIDTH / 2}" y="${footerTop + 148}" text-anchor="middle" font-family="${MONO}" font-size="18" font-weight="500" fill="${MUTED}">No. ${receiptNumber(session)}</text>`;

  // Paper shape: square top corners, straight bottom (the torn edge is cut
  // by the notch triangles below).
  const paperPath = [
    `M ${PAPER_X0 + 18} ${PAPER_TOP}`,
    `H ${PAPER_X1 - 18}`,
    `Q ${PAPER_X1} ${PAPER_TOP} ${PAPER_X1} ${PAPER_TOP + 18}`,
    `V ${paperBottom}`,
    `H ${PAPER_X0}`,
    `V ${PAPER_TOP + 18}`,
    `Q ${PAPER_X0} ${PAPER_TOP} ${PAPER_X0 + 18} ${PAPER_TOP}`,
    'Z',
  ].join(' ');

  let notches = '';
  for (let x = PAPER_X0; x < PAPER_X1 - 1; x += SEG) {
    const x2 = Math.min(x + SEG, PAPER_X1);
    const mid = x + (x2 - x) / 2;
    notches += `<path d="M ${x} ${paperBottom} L ${x2} ${paperBottom} L ${mid} ${paperBottom - NOTCH} Z" fill="${BACKDROP}" />`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE_WIDTH}" height="${imageHeight}" viewBox="0 0 ${IMAGE_WIDTH} ${imageHeight}" role="img" aria-label="${escapeSvgText(labels.title)}" direction="${direction}">
  <defs>
    <filter id="paperShadow" x="-20%" y="-20%" width="140%" height="160%">
      <feDropShadow dx="0" dy="6" stdDeviation="14" flood-color="#0b1c19" flood-opacity="0.16" />
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="${BACKDROP}" />
  <path d="${paperPath}" fill="#ffffff" filter="url(#paperShadow)" />
  ${header}
  ${dashedRule(RULE1_Y)}
  ${rows}
  ${totals}
  ${footer}
  ${notches}
</svg>`;
}

/**
 * Encode an SVG string as a data URL for `<img>`.
 *
 * A data URL is required here, not a blob URL: the app's CSP
 * (`img-src 'self' data: https:`) does not allow `blob:`, so a blob URL
 * image is silently blocked and the share path fails. `data:` is allowed.
 */
export function svgToImageDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function loadSvgImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The bill image could not be prepared.'));
    image.src = source;
  });
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The bill image could not be created.'));
    }, 'image/png');
  });
}

/**
 * Converts the visual receipt into a portable PNG File for Web Share. This
 * intentionally never builds a `text` share payload: Copy remains the only
 * action that places the bill's plain text on the clipboard.
 */
export async function createCourseBillImageFile(
  session: CourseSession,
  labels: CourseBillImageLabels,
): Promise<File> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    throw new Error('Course bill images can only be created in a browser.');
  }

  let logoHref = labels.logoHref;
  try {
    const response = await fetch('/logo.png');
    if (response.ok) {
      const blob = await response.blob();
      logoHref = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('logo'));
        reader.readAsDataURL(blob);
      });
    }
  } catch {
    /* keep relative /logo.png */
  }

  const svg = renderCourseBillImageSvg(session, { ...labels, logoHref, appName: labels.appName || 'SmartJib' });
  const image = await loadSvgImage(svgToImageDataUrl(svg));
  try {
    // Force full rasterization before drawing — drawing straight after
    // `onload` can yield a blank canvas in some browsers (Safari).
    await image.decode();
  } catch {
    /* decode() unsupported — onload already resolved; drawImage still runs */
  }
  const canvas = document.createElement('canvas');
  canvas.width = IMAGE_WIDTH;
  canvas.height = image.naturalHeight || IMAGE_WIDTH;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Your browser could not prepare this bill image.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const png = await canvasToPng(canvas);
  return new File([png], courseBillImageFilename(session), { type: 'image/png' });
}
