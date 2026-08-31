import { formatCurrency } from './currency';
import { sessionUnits } from './course-session';
import type { CourseSession } from './store';

export interface CourseBillImageLabels {
  /** Localized heading shown on the image. */
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
}

const IMAGE_WIDTH = 1080;
const IMAGE_PADDING = 72;
const ROW_HEIGHT = 102;
const HEADER_HEIGHT = 244;
const FOOTER_HEIGHT = 184;

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

/** A predictable filename that makes a shared/downloaded image easy to find. */
export function courseBillImageFilename(session: Pick<CourseSession, 'date'>): string {
  return `smartjib-course-${session.date}.png`;
}

/**
 * Renders the course bill as a self-contained SVG receipt. Keeping the layout
 * as a pure string makes it testable and lets the browser convert the same
 * visual receipt to a PNG for the native share sheet.
 */
export function renderCourseBillImageSvg(
  session: CourseSession,
  labels: CourseBillImageLabels,
): string {
  const direction = labels.direction === 'rtl' ? 'rtl' : 'ltr';
  const isRtl = direction === 'rtl';
  const startX = isRtl ? IMAGE_WIDTH - IMAGE_PADDING : IMAGE_PADDING;
  const endX = isRtl ? IMAGE_PADDING : IMAGE_WIDTH - IMAGE_PADDING;
  const primaryAnchor = isRtl ? 'end' : 'start';
  const amountAnchor = isRtl ? 'start' : 'end';
  const totalItems = sessionUnits(session);
  const imageHeight = HEADER_HEIGHT + session.items.length * ROW_HEIGHT + FOOTER_HEIGHT;
  const cardHeight = imageHeight - 72;
  const locale = labels.locale;
  const metadata = `${labels.date ?? session.date}  •  ${new Intl.NumberFormat(locale).format(totalItems)} ${labels.items}  •  ${session.currency}`;
  const rows = session.items
    .map((line, index) => {
      const top = HEADER_HEIGHT + index * ROW_HEIGHT;
      const name = compactText(line.name || labels.unnamedItem || 'Unnamed item', 42);
      const detail = `${line.qty} × ${formatCurrency(line.unitPrice, session.currency, locale)}`;
      const lineTotal = formatCurrency(line.lineTotal, session.currency, locale);
      const divider = index < session.items.length - 1
        ? `<line x1="${IMAGE_PADDING}" x2="${IMAGE_WIDTH - IMAGE_PADDING}" y1="${top + ROW_HEIGHT - 12}" y2="${top + ROW_HEIGHT - 12}" stroke="#d9e4e0" stroke-width="2" stroke-dasharray="5 9" />`
        : '';

      return `
        <text x="${startX}" y="${top + 36}" text-anchor="${primaryAnchor}" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#171d1c">${escapeSvgText(name)}</text>
        <text x="${startX}" y="${top + 69}" text-anchor="${primaryAnchor}" font-family="Arial, sans-serif" font-size="21" font-weight="500" fill="#52615e">${escapeSvgText(detail)}</text>
        <text x="${endX}" y="${top + 48}" text-anchor="${amountAnchor}" font-family="Arial, sans-serif" font-size="27" font-weight="700" fill="#171d1c">${escapeSvgText(lineTotal)}</text>
        ${divider}`;
    })
    .join('');

  const footerTop = HEADER_HEIGHT + session.items.length * ROW_HEIGHT + 18;
  const appName = labels.appName || 'SMARTJIB';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE_WIDTH}" height="${imageHeight}" viewBox="0 0 ${IMAGE_WIDTH} ${imageHeight}" role="img" aria-label="${escapeSvgText(labels.title)}" direction="${direction}">
  <rect width="100%" height="100%" fill="#edf5f2" />
  <rect x="36" y="36" width="1008" height="${cardHeight}" rx="42" fill="#ffffff" />
  <rect x="36" y="36" width="1008" height="${cardHeight}" rx="42" fill="none" stroke="#d9e4e0" stroke-width="2" />
  <circle cx="${isRtl ? 952 : 128}" cy="124" r="46" fill="#00685f" />
  <path d="M${isRtl ? 930 : 106} 124h44M${isRtl ? 930 : 106} 124l14-14M${isRtl ? 930 : 106} 124l14 14" stroke="#ffffff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
  <text x="${isRtl ? 878 : 202}" y="106" text-anchor="${isRtl ? 'end' : 'start'}" font-family="Arial, sans-serif" font-size="20" font-weight="800" letter-spacing="3" fill="#00685f">${escapeSvgText(appName.toUpperCase())}</text>
  <text x="${isRtl ? 878 : 202}" y="151" text-anchor="${isRtl ? 'end' : 'start'}" font-family="Arial, sans-serif" font-size="40" font-weight="800" fill="#171d1c">${escapeSvgText(labels.title)}</text>
  <text x="${startX}" y="206" text-anchor="${primaryAnchor}" font-family="Arial, sans-serif" font-size="20" font-weight="600" fill="#52615e">${escapeSvgText(metadata)}</text>
  <line x1="${IMAGE_PADDING}" x2="${IMAGE_WIDTH - IMAGE_PADDING}" y1="232" y2="232" stroke="#b9cbc5" stroke-width="2" />
  ${rows}
  <rect x="${IMAGE_PADDING}" y="${footerTop}" width="${IMAGE_WIDTH - IMAGE_PADDING * 2}" height="${FOOTER_HEIGHT - 54}" rx="24" fill="#e0eeeb" />
  <text x="${startX}" y="${footerTop + 48}" text-anchor="${primaryAnchor}" font-family="Arial, sans-serif" font-size="19" font-weight="800" letter-spacing="2" fill="#52615e">${escapeSvgText(labels.total.toUpperCase())}</text>
  <text x="${endX}" y="${footerTop + 57}" text-anchor="${amountAnchor}" font-family="Arial, sans-serif" font-size="40" font-weight="800" fill="#00685f">${escapeSvgText(formatCurrency(session.total, session.currency, locale))}</text>
  <text x="${startX}" y="${footerTop + 103}" text-anchor="${primaryAnchor}" font-family="Arial, sans-serif" font-size="20" font-weight="600" fill="#52615e">${escapeSvgText(`${labels.paidFrom}: ${labels.place}`)}</text>
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

  const svg = renderCourseBillImageSvg(session, labels);
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
  canvas.height = image.naturalHeight || HEADER_HEIGHT + session.items.length * ROW_HEIGHT + FOOTER_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Your browser could not prepare this bill image.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const png = await canvasToPng(canvas);
  return new File([png], courseBillImageFilename(session), { type: 'image/png' });
}
