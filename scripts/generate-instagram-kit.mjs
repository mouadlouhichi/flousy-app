#!/usr/bin/env node
/**
 * Build SmartJib's Morocco-first Instagram launch kit.
 *
 * The checked-in PNGs under marketing/instagram are the upload-ready files.
 * This script recreates them using only ImageMagick plus the licensed local
 * Plus Jakarta Sans, Cairo, and IBM Plex Sans Arabic files stored with
 * the launch kit.
 *
 * Run: node scripts/generate-instagram-kit.mjs
 */

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ArabicReshaper from 'arabic-reshaper';
import bidiFactory from 'bidi-js';
import {
  ArrowUpRight,
  CalendarDays,
  CircleCheck,
  Coins,
  Heart,
  House,
  Landmark,
  Languages,
  MapPin,
  MessageCircleQuestion,
  Moon,
  PiggyBank,
  Play,
  ShieldCheck,
  Sparkles,
  Target,
  WalletCards,
} from 'lucide-react';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const kitRoot = join(repoRoot, 'marketing', 'instagram');
const logo = join(repoRoot, 'public', 'logo.png');
const generatedFlatlay = join(kitRoot, 'source', 'morocco-budget-flatlay-ai.png');
const modernBudgetIllustration = join(kitRoot, 'source', 'modern-budget-desk-illustration.png');
const savingsIllustration = join(kitRoot, 'source', 'savings-goal-editorial-illustration.png');
const moneyPlacesIllustration = join(kitRoot, 'source', 'money-places-editorial-illustration.png');
const fontRoot = join(kitRoot, 'fonts');

const colors = {
  // Canonical light-theme tokens from DESIGN.md / src/index.css.
  background: '#F3F7F3',
  surfaceSoft: '#FBFDFB',
  white: '#FFFFFF',
  ink: '#0E1A17',
  muted: '#5B6B63',
  line: '#DBE5DC',
  forest: '#0F3B36',
  forestSoft: '#1A4F48',
  forestDeep: '#0A2C28',
  lime: '#C5E6A6',
  limeBright: '#D6F0BD',
  limeDeep: '#A9D383',
  mint: '#E3F0E6',
  sage: '#C9DCCB',
  secondary: '#4F7F5B',
  shadow: '#C9DCCB',
};

function contrastOn(hex) {
  const channels = hex.match(/[0-9a-f]{2}/gi)?.map((part) => Number.parseInt(part, 16) / 255) ?? [1, 1, 1];
  const [red, green, blue] = channels.map((value) => (
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  ));
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  const whiteContrast = 1.05 / (luminance + 0.05);
  const inkLuminance = 0.008;
  const inkContrast = (luminance + 0.05) / (inkLuminance + 0.05);
  return inkContrast >= whiteContrast ? colors.forestDeep : colors.white;
}

const font = {
  // Forest & Lime uses Plus Jakarta Sans across Latin display and body.
  // Arabic keeps Cairo / IBM Plex Sans Arabic for reliable exported shaping.
  display: join(fontRoot, 'PlusJakartaSans-ExtraBold.ttf'),
  body: join(fontRoot, 'PlusJakartaSans-Variable.ttf'),
  bodyStrong: join(fontRoot, 'PlusJakartaSans-Variable.ttf'),
  arabicDisplay: join(fontRoot, 'Cairo-ExtraBold.ttf'),
  arabicBody: join(fontRoot, 'IBMPlexSansArabic-Regular.ttf'),
  arabicBodyStrong: join(fontRoot, 'IBMPlexSansArabic-SemiBold.ttf'),
};

const bidi = bidiFactory();

// Cairo's OpenType layout is deliberately optimised for normal Arabic code
// points. ImageMagick cannot run that layout engine, so ArabicReshaper supplies
// presentation forms instead. Cairo includes final/medial forms in its cmap but
// omits several isolated entries; map those missing glyphs to their visually
// equivalent final form before rendering so letters such as د, ر, و, and the
// category labels never disappear from a raster export.
const cairoPresentationFallbacks = new Map([
  [0xFE81, 0xFE82], [0xFE83, 0xFE84], [0xFE85, 0xFE86], [0xFE87, 0xFE88],
  [0xFE89, 0xFE8A], [0xFE8D, 0xFE8E], [0xFE8F, 0xFE90], [0xFE93, 0xFE94],
  [0xFE95, 0xFE96], [0xFE99, 0xFE9A], [0xFE9D, 0xFE9E], [0xFEA1, 0xFEA2],
  [0xFEA5, 0xFEA6], [0xFEA9, 0xFEAA], [0xFEAB, 0xFEAC], [0xFEAD, 0xFEAE],
  [0xFEAF, 0xFEB0], [0xFEB1, 0xFEB2], [0xFEB5, 0xFEB6], [0xFEB9, 0xFEBA],
  [0xFEBD, 0xFEBE], [0xFEC1, 0xFEC2], [0xFEC5, 0xFEC6], [0xFEC9, 0xFECA],
  [0xFECD, 0xFECE], [0xFED1, 0xFED2], [0xFED5, 0xFED6], [0xFED9, 0xFEDA],
  [0xFEDD, 0xFEDE], [0xFEE1, 0xFEE2], [0xFEE5, 0xFEE6], [0xFEE9, 0xFEEA],
  [0xFEED, 0xFEEE], [0xFEEF, 0xFEF0], [0xFEF1, 0xFEF2],
]);

// ImageMagick's annotate operation has no Arabic shaping or bidi pass. Shape
// glyphs, replace the otherwise missing Cairo presentation forms, and resolve
// visual ordering before rasterisation so Arabic/Darija text stays complete,
// connected, and right-to-left.
function prepareArabic(text) {
  const shaped = ArabicReshaper.convertArabic(text);
  const cairoSafe = Array.from(shaped, (character) => {
    const replacement = cairoPresentationFallbacks.get(character.codePointAt(0));
    return replacement ? String.fromCodePoint(replacement) : character;
  }).join('');
  return bidi.getReorderedString(cairoSafe, bidi.getEmbeddingLevels(cairoSafe, 'rtl'));
}

function directory(path) {
  mkdirSync(path, { recursive: true });
}

function pngPath(...segments) {
  const output = join(kitRoot, ...segments);
  directory(dirname(output));
  return output;
}

function im(output, args) {
  directory(dirname(output));
  execFileSync(
    'convert',
    [...args, '-strip', '-depth', '8', '-units', 'PixelsPerInch', '-density', '72', output],
    { stdio: 'inherit' },
  );
}

function montage(output, inputs, extraArgs = []) {
  directory(dirname(output));
  execFileSync('montage', [...inputs, ...extraArgs, '-strip', '-depth', '8', output], {
    stdio: 'inherit',
  });
}

function canvas(width, height, background = colors.background) {
  return ['-size', `${width}x${height}`, `xc:${background}`];
}

function draw(args, instruction, options = {}) {
  const { fill, stroke = 'none', width = 1 } = options;
  if (fill) args.push('-fill', fill);
  // IM6 requires SVG-like path data to be quoted inside its draw mini-language.
  const drawable = instruction.startsWith('path ')
    ? `path '${instruction.slice('path '.length)}'`
    : instruction;
  args.push('-stroke', stroke, '-strokewidth', String(width), '-draw', drawable);
}

function circle(args, cx, cy, radius, fill, stroke = 'none', width = 1) {
  draw(args, `circle ${cx},${cy} ${cx + radius},${cy}`, { fill, stroke, width });
}

function roundedRect(args, x1, y1, x2, y2, radius, fill, stroke = 'none', width = 1) {
  draw(args, `roundrectangle ${x1},${y1} ${x2},${y2} ${radius},${radius}`, {
    fill,
    stroke,
    width,
  });
}

function line(args, x1, y1, x2, y2, stroke, width = 4) {
  draw(args, `line ${x1},${y1} ${x2},${y2}`, { stroke, width });
}

function label(args, text, x, y, options = {}) {
  const {
    size = 26,
    color = colors.muted,
    family = font.body,
    gravity = 'NorthWest',
    weight = 500,
    kerning,
  } = options;
  // Resolve strong labels through the explicitly checked-in face so font
  // selection and mobile legibility stay consistent on every export host.
  const resolvedFamily = family === font.body && weight >= 650
    ? font.bodyStrong
    : family === font.arabicBody && weight >= 650
      ? font.arabicBodyStrong
      : family;
  args.push(
    '-font',
    resolvedFamily,
    '-pointsize',
    String(size),
    '-fill',
    color,
    '-weight',
    String(weight),
    '-stroke',
    'none',
    '-strokewidth',
    '0',
    '-gravity',
    gravity,
  );
  if (kerning !== undefined) args.push('-kerning', String(kerning));
  args.push('-annotate', `+${x}+${y}`, text);
}

/**
 * The previous kit used a generous 1.18 leading. Explicit 0.91–1.03 leading
 * creates a more compact editorial display while preserving clear counters.
 */
function headline(args, lines, x, y, options = {}) {
  const {
    size = 102,
    color = colors.ink,
    family = font.display,
    weight = 800,
    leading = 0.94,
  } = options;
  // Campaign headlines must carry at a small grid size. Do not let an older
  // caller silently fall back to a book weight.
  const displayWeight = Math.max(weight, 700);
  lines.forEach((text, index) => label(args, text, x, Math.round(y + index * size * leading), {
    size,
    color,
    family,
    weight: displayWeight,
  }));
}

function arabicHeadline(args, lines, right, y, options = {}) {
  const {
    size = 100,
    color = colors.ink,
    weight = 850,
    leading = 1.25,
  } = options;
  // Cairo needs a little more leading but the same visual confidence as the
  // Latin display face. Keep it markedly bold without closing counters.
  const displayWeight = Math.max(weight, 850);
  lines.forEach((text, index) => arabicLabel(args, text, right, Math.round(y + index * size * leading), {
    size,
    color,
    family: font.arabicDisplay,
    weight: displayWeight,
  }));
}

/**
 * `-gravity NorthEast` takes an inset from the *right* edge, whereas the rest
 * of this generator works in absolute canvas coordinates. Keep Arabic callers
 * ergonomic by accepting an absolute right edge (e.g. 998 on a 1080 px artboard)
 * and convert it to ImageMagick's inset internally.
 */
function arabicLabel(args, text, right, y, options = {}) {
  label(args, prepareArabic(text), 1080 - right, y, {
    family: font.arabicBody,
    gravity: 'NorthEast',
    weight: 600,
    ...options,
  });
}

function rightLabel(args, text, right, y, options = {}) {
  label(args, text, 1080 - right, y, {
    gravity: 'NorthEast',
    ...options,
  });
}

function centeredLabel(args, text, cx, cy, options = {}) {
  const { width = 1080, height = 1350, ...labelOptions } = options;
  label(args, text, cx - width / 2, cy - height / 2, {
    gravity: 'Center',
    ...labelOptions,
  });
}

function elevatedCard(args, x1, y1, x2, y2, radius, fill, options = {}) {
  const { shadow = colors.shadow, stroke = 'none', width = 1, offset = 12 } = options;
  roundedRect(args, x1 + offset, y1 + offset, x2 + offset, y2 + offset, radius, shadow);
  roundedRect(args, x1, y1, x2, y2, radius, fill, stroke, width);
}

function footer(args, background = colors.background) {
  const darkSurface = [colors.forest, colors.forestDeep, colors.forestSoft, colors.secondary].includes(background);
  const limeSurface = [colors.lime, colors.limeBright, colors.limeDeep].includes(background);
  const color = darkSurface ? colors.mint : limeSurface ? colors.forestSoft : colors.muted;
  label(args, 'smartjib.app', 82, 70, {
    size: 22,
    color,
    weight: 720,
    gravity: 'SouthWest',
    kerning: 0.3,
  });
}

function sparkle(args, cx, cy, size, fill) {
  const h = size / 2;
  draw(args, `polygon ${cx},${cy - h} ${cx + h * 0.34},${cy - h * 0.34} ${cx + h},${cy} ${cx + h * 0.34},${cy + h * 0.34} ${cx},${cy + h} ${cx - h * 0.34},${cy + h * 0.34} ${cx - h},${cy} ${cx - h * 0.34},${cy - h * 0.34}`, { fill });
}

function arch(args, cx, cy, width, height, fill) {
  const x1 = Math.round(cx - width / 2);
  const x2 = Math.round(cx + width / 2);
  const y1 = Math.round(cy - height / 2);
  const y2 = Math.round(cy + height / 2);
  roundedRect(args, x1, y1, x2, y2, Math.round(width / 2), fill);
  roundedRect(args, x1, cy, x2, y2 + 10, 0, fill);
}

function postSignature(args, index, background = colors.background, kicker = 'MOROCCO · MAD') {
  const inverted = [colors.forest, colors.forestDeep, colors.forestSoft, colors.secondary].includes(background);
  const limeSurface = [colors.lime, colors.limeBright, colors.limeDeep].includes(background);
  label(args, 'SMARTJIB', 82, 78, {
    size: 25,
    color: inverted ? colors.lime : colors.forest,
    weight: 820,
    kerning: 1.3,
  });
  roundedRect(args, 252, 78, 336, 112, 17, inverted ? colors.forestSoft : colors.mint);
  label(args, String(index).padStart(2, '0'), 273, 83, {
    size: 18,
    color: inverted ? colors.lime : colors.forest,
    weight: 800,
    kerning: 0.8,
  });
  label(args, kicker, 82, 123, {
    size: 16,
    color: inverted ? colors.limeBright : limeSurface ? colors.forestSoft : colors.muted,
    weight: 680,
    kerning: 0.6,
  });
}

function storySignature(args, index, background = colors.background, kicker = 'SMARTJIB · MAROC') {
  const inverted = [colors.forest, colors.forestDeep, colors.forestSoft, colors.secondary].includes(background);
  const limeSurface = [colors.lime, colors.limeBright, colors.limeDeep].includes(background);
  label(args, 'SMARTJIB', 82, 98, {
    size: 28,
    color: inverted ? colors.lime : colors.forest,
    weight: 820,
    kerning: 1.5,
  });
  roundedRect(args, 291, 96, 390, 134, 19, inverted ? colors.forestSoft : colors.mint);
  label(args, String(index).padStart(2, '0'), 315, 101, {
    size: 20,
    color: inverted ? colors.lime : colors.forest,
    weight: 800,
  });
  label(args, kicker, 82, 148, {
    size: 18,
    color: inverted ? colors.limeBright : limeSurface ? colors.forestSoft : colors.muted,
    weight: 680,
    kerning: 0.7,
  });
}

function logoOverlay(args, size, gravity = 'SouthEast', geometry = '+88+96') {
  args.push(
    '(',
    logo,
    '-resize',
    `${size}x${size}`,
    ')',
    '-gravity',
    gravity,
    '-geometry',
    geometry,
    '-compose',
    'over',
    '-composite',
  );
}

function logoAt(args, x, y, size) {
  args.push(
    '(',
    logo,
    '-resize',
    `${size}x${size}`,
    ')',
    '-gravity',
    'NorthWest',
    '-geometry',
    `+${x}+${y}`,
    '-compose',
    'over',
    '-composite',
  );
}

/**
 * Marketing iconography is deliberately rendered from the official Lucide React
 * package that the product already ships with. Rendering the supplied SVG nodes
 * through ImageMagick keeps the exported PNG workflow dependency-light while
 * preserving Lucide's familiar 24 × 24 geometry (https://lucide.dev/icons/).
 */
const lucideIcons = {
  wallet: WalletCards,
  target: Target,
  location: MapPin,
  shield: ShieldCheck,
  calendar: CalendarDays,
  coins: Coins,
  chat: MessageCircleQuestion,
  language: Languages,
  heart: Heart,
  moon: Moon,
  spark: Sparkles,
  arrow: ArrowUpRight,
  check: CircleCheck,
  play: Play,
  bank: Landmark,
  home: House,
  piggy: PiggyBank,
};

function svgAttributes(input) {
  return Object.fromEntries([...input.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
}

function lucideIcon(args, name, cx, cy, size, options = {}) {
  const Icon = lucideIcons[name] || Sparkles;
  const stroke = options.stroke || colors.forest;
  const strokeWidth = options.strokeWidth || 1.85;
  const rendered = renderToStaticMarkup(createElement(Icon, { size: 24, strokeWidth: 2 }));
  const scale = size / 24;
  const left = cx - size / 2;
  const top = cy - size / 2;
  const prefix = `translate ${left},${top} scale ${scale},${scale}`;
  const childTag = /<(path|circle|rect|line|polyline|polygon)\s+([^>]*?)(?:\/)?>/g;

  for (const match of rendered.matchAll(childTag)) {
    const [, tag, rawAttributes] = match;
    const attr = svgAttributes(rawAttributes);
    args.push('-fill', 'none', '-stroke', stroke, '-strokewidth', String(strokeWidth));

    if (tag === 'path') {
      args.push('-draw', `${prefix} path '${attr.d}'`);
    } else if (tag === 'circle') {
      const x = Number(attr.cx);
      const y = Number(attr.cy);
      const r = Number(attr.r);
      args.push('-draw', `${prefix} circle ${x},${y} ${x + r},${y}`);
    } else if (tag === 'rect') {
      const x = Number(attr.x || 0);
      const y = Number(attr.y || 0);
      const w = Number(attr.width);
      const h = Number(attr.height);
      const r = Number(attr.rx || 0);
      args.push('-draw', `${prefix} roundrectangle ${x},${y} ${x + w},${y + h} ${r},${r}`);
    } else if (tag === 'line') {
      args.push('-draw', `${prefix} line ${attr.x1},${attr.y1} ${attr.x2},${attr.y2}`);
    } else if (tag === 'polyline') {
      args.push('-draw', `${prefix} polyline ${attr.points}`);
    } else if (tag === 'polygon') {
      args.push('-draw', `${prefix} polygon ${attr.points}`);
    }
  }
}

function walletIcon(args, cx, cy, size, options = {}) {
  lucideIcon(args, 'wallet', cx, cy, size, options);
}

function targetIcon(args, cx, cy, size, options = {}) {
  lucideIcon(args, 'target', cx, cy, size, options);
}

function coinsIcon(args, cx, cy, size, options = {}) {
  lucideIcon(args, 'coins', cx, cy, size, options);
}

function locationIcon(args, cx, cy, size, options = {}) {
  lucideIcon(args, 'location', cx, cy, size, options);
}

function shieldIcon(args, cx, cy, size, options = {}) {
  lucideIcon(args, 'shield', cx, cy, size, options);
}

function calendarIcon(args, cx, cy, size, options = {}) {
  lucideIcon(args, 'calendar', cx, cy, size, options);
}

function chatIcon(args, cx, cy, size, options = {}) {
  lucideIcon(args, 'chat', cx, cy, size, options);
}

function languageIcon(args, cx, cy, size, options = {}) {
  lucideIcon(args, 'language', cx, cy, size, options);
}

function heartIcon(args, cx, cy, size, options = {}) {
  lucideIcon(args, 'heart', cx, cy, size, { stroke: options.fill || colors.secondary });
}

function moonIcon(args, cx, cy, size, options = {}) {
  lucideIcon(args, 'moon', cx, cy, size, { stroke: options.fill || colors.limeDeep });
}

function iconByName(args, name, cx, cy, size, options = {}) {
  lucideIcon(args, name, cx, cy, size, options);
}

function miniTag(args, text, x, y, width, fill, textColor = colors.ink) {
  roundedRect(args, x, y, x + width, y + 48, 24, fill);
  label(args, text, x + 20, y + 12, {
    size: 17,
    color: textColor,
    weight: 760,
    kerning: 0.3,
  });
}

function photoCard(args, imagePath, x, y, width, height, radius = 48, gravity = 'Center') {
  // Crop an editorial source image to an exact social-artboard card and apply
  // a real transparent rounded mask so it sits cleanly in the layout.
  args.push(
    '(',
    '(', imagePath, '-resize', `${width}x${height}^`, '-gravity', gravity, '-crop', `${width}x${height}+0+0`, '+repage',
    '-colorspace', 'gray', '+level-colors', `${colors.forestDeep},${colors.limeBright}`, ')',
    '(', '-size', `${width}x${height}`, 'xc:none', '-fill', 'white', '-stroke', 'none', '-draw', `roundrectangle 0,0 ${width - 1},${height - 1} ${radius},${radius}`, ')',
    '-alpha', 'off', '-compose', 'CopyOpacity', '-composite',
    ')',
    '-gravity', 'NorthWest', '-geometry', `+${x}+${y}`, '-compose', 'over', '-composite',
  );
}

function createBrandAssets() {
  const brand = join(kitRoot, 'brand');
  directory(brand);
  cpSync(logo, join(brand, 'smartjib-logo-mark-transparent.png'));

  // Forest & Lime avatar: a highly legible mark with enough quiet space for
  // Instagram's small circular crop.
  {
    const args = canvas(1080, 1080, colors.background);
    circle(args, 540, 540, 514, colors.mint);
    circle(args, 540, 540, 430, colors.forest);
    circle(args, 540, 540, 346, colors.forestSoft);
    circle(args, 540, 540, 278, colors.lime);
    circle(args, 540, 540, 236, colors.background);
    sparkle(args, 240, 308, 74, colors.limeDeep);
    sparkle(args, 833, 760, 64, colors.secondary);
    logoOverlay(args, 525, 'Center', '+0+16');
    im(pngPath('brand', 'smartjib-instagram-avatar-1080.png'), args);
  }

  // Transparent wordmark for Stories, partnerships, and future social edits.
  {
    const args = canvas(1800, 600, 'none');
    circle(args, 282, 302, 238, colors.mint);
    circle(args, 282, 302, 192, colors.forest);
    logoAt(args, 107, 127, 350);
    label(args, 'SmartJib', 570, 177, {
      size: 152,
      color: colors.forest,
      weight: 800,
    });
    label(args, 'BUDGET SIMPLE · VRAIE VIE', 580, 385, {
      size: 34,
      color: colors.muted,
      weight: 690,
      kerning: 1.5,
    });
    sparkle(args, 1573, 205, 54, colors.limeDeep);
    im(pngPath('brand', 'smartjib-horizontal-wordmark.png'), args);
  }

  {
    const args = canvas(1600, 900, colors.background);
    elevatedCard(args, 48, 48, 1552, 852, 54, colors.white, { shadow: '#DBE5DC', offset: 7 });
    label(args, 'SMARTJIB / PALETTE MAROC', 100, 108, {
      size: 27,
      color: colors.forest,
      weight: 760,
      kerning: 1.2,
    });
    const swatches = [
      ['Forest', colors.forest],
      ['Lime', colors.lime],
      ['Background', colors.background],
      ['Secondary', colors.secondary],
      ['Lime deep', colors.limeDeep],
      ['Ink', colors.ink],
    ];
    swatches.forEach(([name, color], index) => {
      const x = 100 + (index % 3) * 490;
      const y = 220 + Math.floor(index / 3) * 300;
      roundedRect(args, x, y, x + 410, y + 166, 32, color);
      label(args, name, x, y + 205, { size: 30, color: colors.ink, weight: 760 });
      label(args, color, x, y + 248, { size: 22, color: colors.muted, weight: 560, kerning: 0.8 });
    });
    im(pngPath('brand', 'smartjib-social-palette.png'), args);
  }
}

function createHighlightCovers() {
  const covers = [
    { file: '01-start', title: 'START', color: colors.secondary, icon: 'spark' },
    { file: '02-budget', title: 'BUDGET', color: colors.limeDeep, icon: 'wallet' },
    { file: '03-places', title: 'PLACES', color: colors.forestSoft, icon: 'location' },
    { file: '04-goals', title: 'GOALS', color: '#7FB069', icon: 'target' },
    { file: '05-private', title: 'PRIVATE', color: '#5B6B63', icon: 'shield' },
    { file: '06-tour', title: 'TOUR', color: '#A9D383', icon: 'calendar' },
    { file: '07-tips', title: 'TIPS', color: '#C5E6A6', icon: 'coins' },
    { file: '08-faq', title: 'FAQ', color: '#7FB069', icon: 'chat' },
  ];

  covers.forEach(({ file, title, color, icon }, index) => {
    const args = canvas(1080, 1920, colors.background);
    circle(args, 540, 960, 468, '#F3F7F3');
    circle(args, 540, 960, 380, color);
    circle(args, 540, 960, 320, '#FFFFFF', '#FFFFFF', 8);
    circle(args, 540, 960, 276, color);
    sparkle(args, 258, 637, 50, colors.limeDeep);
    sparkle(args, 826, 1280, 42, colors.secondary);
    iconByName(args, icon, 540, 960, 180, { stroke: contrastOn(color), accent: colors.lime });
    label(args, `SMARTJIB / ${String(index + 1).padStart(2, '0')}`, 0, 194, {
      size: 23,
      color: colors.forest,
      weight: 730,
      gravity: 'North',
      kerning: 1,
    });
    label(args, title, 0, 1656, {
      size: 34,
      color: colors.forest,
      weight: 820,
      gravity: 'North',
      kerning: 1.2,
    });
    im(pngPath('highlights', `${file}-cover.png`), args);
  });
}

function createPosts() {
  // 01 — calm welcome: friendly French opener for a Moroccan audience.
  {
    const args = canvas(1080, 1350, colors.background);
    circle(args, 962, 174, 250, colors.mint);
    sparkle(args, 863, 220, 54, colors.limeDeep);
    postSignature(args, 1, colors.background, 'BIENVENUE · MAROC');
    headline(args, ['Ton budget.', 'Ton rythme.'], 78, 214, {
      size: 112,
      color: colors.ink,
      leading: 0.91,
    });
    label(args, 'Une façon plus douce de planifier en MAD.', 82, 452, {
      size: 31,
      color: colors.muted,
      weight: 520,
    });
    // A tactile anchor image gives the launch grid a real-life moment rather
    // than another abstract dashboard. It was generated as an original,
    // text-free editorial still life, then framed here with SmartJib UI cues.
    elevatedCard(args, 72, 580, 1008, 1120, 54, colors.forest, { shadow: '#C9DCCB', offset: 14 });
    photoCard(args, generatedFlatlay, 542, 614, 422, 458, 42);
    roundedRect(args, 542, 614, 964, 1072, 42, 'none', colors.lime, 4);
    label(args, 'PLAN DU MOIS', 126, 666, { size: 19, color: colors.lime, weight: 760, kerning: 1.1 });
    label(args, 'Prévoir.', 126, 727, { size: 51, color: colors.white, weight: 800 });
    label(args, 'Puis vivre.', 126, 787, { size: 51, color: colors.white, weight: 800 });
    roundedRect(args, 126, 880, 470, 955, 37, '#1A4F48');
    lucideIcon(args, 'wallet', 166, 918, 32, { stroke: colors.lime });
    label(args, 'EN MAD · À TON RYTHME', 196, 901, { size: 17, color: colors.white, weight: 680, kerning: 0.55 });
    label(args, 'Des petits choix.', 126, 997, { size: 24, color: colors.mint, weight: 580 });
    label(args, 'Plus de clarté au quotidien.', 126, 1032, { size: 21, color: colors.mint, weight: 520 });
    footer(args, colors.background);
    im(pngPath('posts', '01-your-money-on-purpose.png'), args);
  }

  // 02 — core monthly-planning idea, localized around the dirham.
  {
    const args = canvas(1080, 1350, colors.surfaceSoft);
    arch(args, 907, 201, 380, 320, colors.mint);
    circle(args, 860, 175, 62, colors.limeDeep);
    postSignature(args, 2, colors.surfaceSoft, 'PLAN DU MOIS · MAD');
    headline(args, ['Donne un rôle', 'à chaque dirham.'], 78, 212, {
      size: 96,
      color: colors.ink,
      leading: 0.94,
    });
    elevatedCard(args, 72, 512, 1008, 1064, 54, colors.white, {
      shadow: '#DBE5DC', stroke: colors.line, width: 2, offset: 11,
    });
    label(args, 'EXEMPLE POUR COMMENCER', 122, 573, {
      size: 18,
      color: colors.forest,
      weight: 740,
      kerning: 1,
    });
    label(args, '10 000 MAD', 122, 641, { size: 43, color: colors.ink, weight: 790 });
    const rows = [
      ['BESOINS', '50%', colors.forest],
      ['ENVIES', '30%', colors.secondary],
      ['ÉPARGNE', '20%', colors.limeDeep],
    ];
    rows.forEach(([name, value, color], index) => {
      const y = 740 + index * 104;
      circle(args, 138, y + 16, 12, color);
      label(args, name, 166, y, { size: 24, color: colors.ink, weight: 700 });
      rightLabel(args, value, 904, y, { size: 26, color: colors.ink, weight: 780 });
      roundedRect(args, 166, y + 47, 816, y + 66, 10, '#E3F0E6');
      const length = [326, 196, 130][index];
      roundedRect(args, 166, y + 47, 166 + length, y + 66, 10, color);
    });
    label(args, 'C’est un départ, pas une règle à subir.', 82, 1140, {
      size: 28,
      color: colors.muted,
      weight: 530,
    });
    footer(args, colors.surfaceSoft);
    im(pngPath('posts', '02-give-your-money-a-plan.png'), args);
  }

  // 03 — Arabic/Darija hero post, set entirely in Cairo.
  {
    const args = canvas(1080, 1350, colors.forest);
    circle(args, 171, 197, 160, colors.forestSoft);
    sparkle(args, 844, 188, 74, colors.limeDeep);
    postSignature(args, 3, colors.forest, 'MAD · BUDGET SIMPLE');
    arabicHeadline(args, ['كل درهم', 'عندو دور.'], 998, 190, {
      size: 88,
      color: colors.white,
      leading: 1.25,
      weight: 780,
    });
    arabicLabel(args, 'خطّط بشوية وعلى قدّك.', 998, 480, {
      size: 27,
      color: colors.mint,
      weight: 550,
    });
    elevatedCard(args, 72, 585, 1008, 1102, 56, colors.background, { shadow: '#0A2C28', offset: 14 });
    const items = [
      ['ضروريات', colors.lime, 'ضروري'],
      ['رغبات', colors.mint, 'اختيارك'],
      ['توفير', colors.sage, 'للي جاي'],
    ];
    items.forEach(([title, fill, note], index) => {
      const x = 116 + index * 295;
      roundedRect(args, x, 691, x + 245, 963, 35, fill);
      circle(args, x + 122, 762, 54, colors.white);
      if (index === 0) walletIcon(args, x + 122, 762, 62, { stroke: colors.forest, accent: colors.secondary });
      if (index === 1) heartIcon(args, x + 122, 760, 57, { fill: colors.secondary });
      if (index === 2) targetIcon(args, x + 122, 762, 61, { stroke: colors.forest, accent: colors.secondary });
      arabicLabel(args, title, x + 210, 842, { size: 28, color: colors.ink, weight: 750 });
      arabicLabel(args, note, x + 210, 884, { size: 20, color: colors.muted, weight: 560 });
    });
    arabicLabel(args, 'ما خاصكش تكون كامل، غير بدا.', 998, 1172, {
      size: 32,
      color: colors.lime,
      weight: 600,
    });
    footer(args, colors.forest);
    im(pngPath('posts', '03-three-buckets-one-clear-view.png'), args);
  }

  // 04 — SmartJib's product distinction with friendly, tactile icons.
  {
    const args = canvas(1080, 1350, colors.mint);
    photoCard(args, moneyPlacesIllustration, 746, 76, 268, 374, 42, 'South');
    roundedRect(args, 746, 76, 1014, 450, 42, 'none', colors.white, 4);
    postSignature(args, 4, colors.mint, 'CLARTÉ · SANS PRESSION');
    headline(args, ['Pour quoi ?', 'Et où ?'], 78, 214, {
      size: 111,
      color: colors.ink,
      leading: 0.93,
    });
    label(args, 'Deux questions. Un budget plus clair.', 82, 452, {
      size: 31,
      color: colors.muted,
      weight: 540,
    });
    elevatedCard(args, 72, 558, 1008, 770, 48, colors.white, { shadow: '#C9DCCB', offset: 11 });
    circle(args, 184, 665, 66, colors.secondary);
    targetIcon(args, 184, 665, 78, { stroke: colors.white, accent: colors.sage });
    label(args, 'POUR QUOI ?', 292, 606, { size: 19, color: colors.forest, weight: 730, kerning: 1 });
    label(args, 'Le rôle de ton argent.', 292, 656, { size: 35, color: colors.ink, weight: 750 });
    elevatedCard(args, 72, 820, 1008, 1032, 48, colors.white, { shadow: '#C9DCCB', offset: 11 });
    circle(args, 184, 927, 66, colors.forestSoft);
    locationIcon(args, 184, 927, 78, { stroke: colors.white, accent: colors.lime });
    label(args, 'OÙ ?', 292, 868, { size: 19, color: colors.forest, weight: 730, kerning: 1 });
    label(args, 'L’endroit où il est.', 292, 918, { size: 35, color: colors.ink, weight: 750 });
    miniTag(args, 'BANQUE', 82, 1102, 142, colors.white, colors.forest);
    miniTag(args, 'MAISON', 240, 1102, 146, colors.white, colors.forest);
    miniTag(args, 'PORTEFEUILLE', 402, 1102, 196, colors.white, colors.forest);
    footer(args, colors.mint);
    im(pngPath('posts', '04-purpose-and-place.png'), args);
  }

  // 05 — Darija money-location explainer.
  {
    const args = canvas(1080, 1350, colors.surfaceSoft);
    arch(args, 903, 194, 380, 330, colors.sage);
    sparkle(args, 824, 247, 50, colors.secondary);
    postSignature(args, 5, colors.surfaceSoft, 'MONEY PLACES · MAROC');
    arabicHeadline(args, ['فين كاينة', 'فلوسك؟'], 998, 190, {
      size: 88,
      color: colors.ink,
      leading: 1.25,
      weight: 780,
    });
    arabicLabel(args, 'فالبنك، فالدار، ولا فالمحفظة.', 998, 480, {
      size: 27,
      color: colors.muted,
      weight: 560,
    });
    const places = [
      ['البنك', 'Bank', colors.forest, 'location'],
      ['فالدار', 'À la maison', colors.secondary, 'wallet'],
      ['المحفظة', 'Dans ta poche', colors.limeDeep, 'coins'],
    ];
    places.forEach(([arabic, french, fill, icon], index) => {
      const y = 556 + index * 174;
      elevatedCard(args, 72, y, 1008, y + 138, 42, colors.white, { shadow: '#DBE5DC', offset: 8 });
      circle(args, 168, y + 69, 46, fill);
      iconByName(args, icon, 168, y + 69, 48, { stroke: contrastOn(fill), accent: colors.lime });
      arabicLabel(args, arabic, 924, y + 29, { size: 31, color: colors.ink, weight: 760 });
      label(args, french, 258, y + 80, { size: 22, color: colors.muted, weight: 560 });
    });
    label(args, 'Voir l’endroit sans perdre le plan.', 82, 1118, { size: 29, color: colors.forest, weight: 650 });
    footer(args, colors.surfaceSoft);
    im(pngPath('posts', '05-money-places.png'), args);
  }

  // 06 — privacy-friendly product promise.
  {
    const args = canvas(1080, 1350, colors.forestDeep);
    circle(args, 920, 206, 248, '#1A4F48');
    sparkle(args, 812, 249, 56, colors.limeDeep);
    postSignature(args, 6, colors.forestDeep, 'PRIVÉ · À TON RYTHME');
    headline(args, ['Sans connexion', 'bancaire.'], 78, 218, {
      size: 103,
      color: colors.white,
      leading: 0.94,
    });
    label(args, 'Tu choisis ce que tu veux suivre.', 82, 450, {
      size: 31,
      color: colors.mint,
      weight: 520,
    });
    elevatedCard(args, 72, 568, 1008, 1009, 58, '#112825', { shadow: '#071D1A', stroke: '#4F7F5B', width: 2, offset: 12 });
    circle(args, 540, 739, 136, colors.forestSoft);
    shieldIcon(args, 540, 739, 166, { stroke: colors.white, accent: colors.lime });
    label(args, 'Tes choix. Tes données.', 0, 908, { size: 43, color: colors.white, weight: 780, gravity: 'North' });
    label(args, 'Pas de mots de passe bancaires à partager.', 0, 963, { size: 25, color: colors.mint, weight: 520, gravity: 'North' });
    miniTag(args, 'MANUEL', 82, 1085, 138, '#1A4F48', colors.lime);
    miniTag(args, 'PRIVÉ', 240, 1085, 122, '#1A4F48', colors.lime);
    miniTag(args, 'SIMPLE', 382, 1085, 127, '#1A4F48', colors.lime);
    footer(args, colors.forestDeep);
    im(pngPath('posts', '06-private-by-design.png'), args);
  }

  // 07 — low-pressure planning habit in a friendly visual rhythm.
  {
    const args = canvas(1080, 1350, colors.background);
    photoCard(args, savingsIllustration, 768, 72, 246, 388, 42, 'South');
    roundedRect(args, 768, 72, 1014, 460, 42, 'none', colors.white, 4);
    postSignature(args, 7, colors.background, 'RESET DU MOIS · MAD');
    headline(args, ['Planifier.', 'Ajuster.', 'Respirer.'], 78, 205, {
      size: 103,
      color: colors.ink,
      leading: 0.88,
    });
    elevatedCard(args, 72, 570, 1008, 1053, 56, colors.white, { shadow: '#DBE5DC', stroke: '#DBE5DC', width: 2, offset: 10 });
    label(args, 'TON PLAN CE MOIS-CI', 122, 628, { size: 18, color: colors.forest, weight: 740, kerning: 1 });
    label(args, '10 000 MAD', 122, 694, { size: 42, color: colors.ink, weight: 790 });
    const plan = [
      ['1', 'Prévoir', 'ce qui entre', colors.forest],
      ['2', 'Répartir', 'besoins, envies, épargne', colors.secondary],
      ['3', 'Ajuster', 'quand la vie change', colors.limeDeep],
    ];
    plan.forEach(([number, title, note, color], index) => {
      const y = 793 + index * 75;
      circle(args, 143, y + 17, 20, color);
      centeredLabel(args, number, 143, y + 17, { size: 19, color: contrastOn(color), weight: 780 });
      label(args, title, 190, y, { size: 26, color: colors.ink, weight: 740 });
      label(args, note, 345, y + 4, { size: 21, color: colors.muted, weight: 530 });
    });
    label(args, 'Pas besoin d’un budget parfait.', 82, 1125, { size: 30, color: colors.forest, weight: 680 });
    footer(args, colors.background);
    im(pngPath('posts', '07-give-every-dirham-a-job.png'), args);
  }

  // 08 — Arabic savings message with an actual visual goal.
  {
    const args = canvas(1080, 1350, colors.mint);
    circle(args, 927, 190, 254, colors.surfaceSoft);
    sparkle(args, 805, 237, 60, colors.limeDeep);
    postSignature(args, 8, colors.mint, 'ÉPARGNE · OBJECTIF');
    arabicHeadline(args, ['وفّر للي', 'كيهمّك.'], 998, 190, {
      size: 88,
      color: colors.ink,
      leading: 1.25,
      weight: 780,
    });
    arabicLabel(args, 'هدف صغير اليوم، راحة كبيرة غدا.', 998, 480, {
      size: 27,
      color: colors.muted,
      weight: 560,
    });
    elevatedCard(args, 72, 568, 1008, 1026, 58, colors.forest, { shadow: '#C9DCCB', offset: 13 });
    label(args, 'GOAL IN PROGRESS', 122, 630, { size: 19, color: colors.lime, weight: 720, kerning: 1 });
    arabicLabel(args, 'الهدف الجاي', 610, 696, { size: 30, color: colors.white, weight: 760 });
    label(args, '68% financé', 122, 762, { size: 27, color: colors.mint, weight: 560 });
    circle(args, 799, 774, 112, 'none', '#4F7F5B', 19);
    draw(args, 'path M 799,662 A 112,112 0 0,1 905,809', { fill: 'none', stroke: colors.lime, width: 19 });
    centeredLabel(args, '68%', 799, 774, { size: 38, color: colors.white, weight: 800 });
    roundedRect(args, 122, 872, 700, 898, 13, '#4F7F5B');
    roundedRect(args, 122, 872, 515, 898, 13, colors.lime);
    miniTag(args, 'MÊME PETIT, ÇA COMPTE', 82, 1105, 278, colors.white, colors.forest);
    footer(args, colors.mint);
    im(pngPath('posts', '08-save-for-what-matters.png'), args);
  }

  // 09 — Arabic-first language inclusion post in Cairo; an explicit response
  // to Moroccan Arabic, French, and English user needs.
  {
    const args = canvas(1080, 1350, colors.lime);
    circle(args, 934, 188, 260, colors.limeDeep);
    circle(args, 934, 188, 192, colors.limeBright);
    sparkle(args, 790, 279, 58, colors.forestDeep);
    postSignature(args, 9, colors.lime, 'ARABIC · FRANÇAIS · ENGLISH');
    arabicHeadline(args, ['ميزانيتك', 'بلغتك.'], 998, 190, {
      size: 92,
      color: colors.ink,
      leading: 1.24,
      weight: 790,
    });
    arabicLabel(args, 'باش تنظيم فلوسك يكون أسهل وأقرب ليك.', 998, 480, {
      size: 27,
      color: '#0A2C28',
      weight: 570,
    });
    elevatedCard(args, 72, 568, 1008, 1014, 58, colors.background, { shadow: colors.limeDeep, offset: 13 });
    label(args, 'CHOISIS TA LANGUE', 122, 633, { size: 19, color: colors.forest, weight: 740, kerning: 1 });
    const languages = [
      ['العربية', colors.forest, font.arabicBody, 650],
      ['Français', colors.lime, font.bodyStrong, 600],
      ['English', colors.sage, font.bodyStrong, 600],
    ];
    languages.forEach(([text, fill, family, weight], index) => {
      const y = 709 + index * 91;
      roundedRect(args, 122, y, 958, y + 62, 31, fill);
      if (family === font.arabicBody) {
        arabicLabel(args, text, 887, y + 7, { size: 28, color: colors.white, weight, gravity: 'NorthEast' });
      } else {
        label(args, text, 158, y + 13, { size: 27, color: colors.ink, family, weight });
      }
      circle(args, 907, y + 31, 10, family === font.arabicBody ? colors.lime : colors.forest);
    });
    label(args, '12 monnaies, dont le MAD.', 82, 1114, { size: 31, color: colors.ink, weight: 700 });
    footer(args, colors.lime);
    im(pngPath('posts', '09-budget-in-your-language.png'), args);
  }
}

function createStories() {
  // 01 — Welcome.
  {
    const args = canvas(1080, 1920, colors.background);
    circle(args, 925, 326, 292, colors.mint);
    sparkle(args, 826, 319, 66, colors.limeDeep);
    storySignature(args, 1, colors.background, 'BIENVENUE · SMARTJIB');
    headline(args, ['Ton budget', 'peut être', 'plus doux.'], 80, 292, { size: 116, color: colors.ink, leading: 0.91 });
    label(args, 'Planifie en MAD, à ton rythme.', 84, 650, { size: 34, color: colors.muted, weight: 530 });
    elevatedCard(args, 72, 835, 1008, 1438, 62, colors.forest, { shadow: '#C9DCCB', offset: 14 });
    photoCard(args, generatedFlatlay, 116, 881, 848, 360, 46);
    roundedRect(args, 116, 881, 964, 1241, 46, 'none', colors.lime, 4);
    roundedRect(args, 144, 1296, 936, 1371, 37, '#1A4F48');
    lucideIcon(args, 'wallet', 189, 1333, 34, { stroke: colors.lime });
    label(args, 'BESOINS · ENVIES · ÉPARGNE', 232, 1312, { size: 22, color: colors.white, weight: 720, kerning: 0.5 });
    label(args, 'Bienvenue. On commence simple. ✦', 0, 1552, { size: 33, color: colors.forest, weight: 680, gravity: 'North' });
    footer(args, colors.background);
    im(pngPath('stories', '01-welcome-to-smartjib.png'), args);
  }

  // 02 — Budget framework.
  {
    const args = canvas(1080, 1920, colors.surfaceSoft);
    arch(args, 900, 310, 420, 370, colors.mint);
    sparkle(args, 823, 338, 62, colors.limeDeep);
    storySignature(args, 2, colors.surfaceSoft, 'PLAN DU MOIS · MAD');
    headline(args, ['Commence avec', 'ton vrai', 'montant.'], 80, 298, { size: 108, color: colors.ink, leading: 0.91 });
    elevatedCard(args, 72, 822, 1008, 1434, 62, colors.white, { shadow: '#DBE5DC', stroke: colors.line, width: 2, offset: 12 });
    label(args, 'EXEMPLE', 125, 888, { size: 19, color: colors.forest, weight: 740, kerning: 1 });
    label(args, '10 000 MAD', 125, 960, { size: 50, color: colors.ink, weight: 790 });
    [['Besoins', '50%', colors.forest], ['Envies', '30%', colors.secondary], ['Épargne', '20%', colors.limeDeep]].forEach(([name, value, color], index) => {
      const y = 1080 + index * 108;
      circle(args, 143, y + 18, 13, color);
      label(args, name, 174, y, { size: 30, color: colors.ink, weight: 700 });
      rightLabel(args, value, 899, y, { size: 30, color: colors.ink, weight: 760 });
      roundedRect(args, 174, y + 53, 850, y + 75, 11, '#E3F0E6');
      roundedRect(args, 174, y + 53, [512, 379, 304][index], y + 75, 11, color);
    });
    label(args, 'Le meilleur budget est celui qui respecte ta vraie vie.', 0, 1546, { size: 29, color: colors.muted, weight: 540, gravity: 'North' });
    footer(args, colors.surfaceSoft);
    im(pngPath('stories', '02-three-buckets.png'), args);
  }

  // 03 — Arabic locations story.
  {
    const args = canvas(1080, 1920, colors.forest);
    circle(args, 924, 310, 294, colors.forestSoft);
    sparkle(args, 827, 334, 58, colors.limeDeep);
    storySignature(args, 3, colors.forest, 'MONEY PLACES · MAROC');
    arabicHeadline(args, ['فلوسك', 'فين كاينة؟'], 1000, 290, { size: 96, color: colors.white, leading: 1.24, weight: 780 });
    arabicLabel(args, 'شوف فين كاينين فلوسك، وبقا حافظ على الخطة.', 998, 596, { size: 28, color: colors.mint, weight: 570 });
    const places = [['البنك', colors.lime, 'location'], ['فالدار', colors.mint, 'wallet'], ['المحفظة', colors.sage, 'coins']];
    places.forEach(([name, fill, icon], index) => {
      const y = 814 + index * 190;
      elevatedCard(args, 72, y, 1008, y + 148, 48, colors.background, { shadow: '#0A2C28', offset: 10 });
      circle(args, 163, y + 74, 49, fill);
      iconByName(args, icon, 163, y + 74, 55, { stroke: colors.forest, accent: colors.secondary });
      arabicLabel(args, name, 892, y + 35, { size: 36, color: colors.ink, weight: 770 });
    });
    arabicLabel(args, 'فين كاينة فلوسك ماشي هو علاش كتستعملها.', 998, 1494, { size: 33, color: colors.lime, weight: 620 });
    footer(args, colors.forest);
    im(pngPath('stories', '03-money-places.png'), args);
  }

  // 04 — privacy story.
  {
    const args = canvas(1080, 1920, colors.forestDeep);
    circle(args, 900, 324, 292, '#1A4F48');
    sparkle(args, 826, 341, 60, colors.limeDeep);
    storySignature(args, 4, colors.forestDeep, 'PRIVÉ · À TON RYTHME');
    headline(args, ['Tu gardes', 'le contrôle.'], 80, 304, { size: 116, color: colors.white, leading: 0.93 });
    label(args, 'Pas de connexion bancaire.', 84, 560, { size: 35, color: colors.mint, weight: 550 });
    elevatedCard(args, 72, 822, 1008, 1392, 62, '#112825', { shadow: '#071D1A', stroke: '#4F7F5B', width: 2, offset: 12 });
    circle(args, 540, 1058, 160, colors.forestSoft);
    shieldIcon(args, 540, 1058, 185, { stroke: colors.white, accent: colors.lime });
    label(args, 'Tu ajoutes ce qui compte pour toi.', 0, 1278, { size: 34, color: colors.white, weight: 700, gravity: 'North' });
    label(args, 'Un suivi simple, choisi par toi.', 0, 1333, { size: 28, color: colors.mint, weight: 530, gravity: 'North' });
    footer(args, colors.forestDeep);
    im(pngPath('stories', '04-private-by-design.png'), args);
  }

  // 05 — question sticker prompt.
  {
    const args = canvas(1080, 1920, colors.lime);
    circle(args, 900, 328, 290, colors.limeBright);
    sparkle(args, 823, 352, 60, colors.forestDeep);
    storySignature(args, 5, colors.lime, 'ON ÉCOUTE · MAROC');
    headline(args, ['Qu’est-ce qui', 'rendrait ton', 'budget plus', 'simple ?'], 80, 292, { size: 100, color: colors.ink, leading: 0.9 });
    elevatedCard(args, 72, 960, 1008, 1326, 56, colors.background, { shadow: colors.limeDeep, offset: 12 });
    label(args, 'TA QUESTION', 124, 1031, { size: 20, color: colors.forest, weight: 740, kerning: 1 });
    label(args, 'Ajoute ton idée ici ↓', 124, 1131, { size: 48, color: colors.ink, weight: 780 });
    label(args, 'On prépare des réponses utiles, sans jugement.', 124, 1198, { size: 27, color: colors.muted, weight: 530 });
    roundedRect(args, 112, 1435, 968, 1556, 40, '#FFFFFF', colors.background, 3);
    label(args, 'AJOUTE LE STICKER QUESTION INSTAGRAM', 0, 1474, { size: 21, color: colors.forest, weight: 750, gravity: 'North' });
    footer(args, colors.lime);
    im(pngPath('stories', '05-ask-a-budget-question.png'), args);
  }

  // 06 — savings goal.
  {
    const args = canvas(1080, 1920, colors.mint);
    circle(args, 912, 320, 290, colors.surfaceSoft);
    sparkle(args, 825, 339, 62, colors.limeDeep);
    storySignature(args, 6, colors.mint, 'ÉPARGNE · OBJECTIF');
    arabicHeadline(args, ['وفّر للي', 'كيهمّك.'], 1000, 290, { size: 96, color: colors.ink, leading: 1.24, weight: 780 });
    arabicLabel(args, 'حتى خطوة صغيرة كتحسب.', 998, 596, { size: 28, color: colors.muted, weight: 560 });
    elevatedCard(args, 72, 827, 1008, 1375, 62, colors.forest, { shadow: '#C9DCCB', offset: 13 });
    arabicLabel(args, 'الهدف الجاي', 600, 908, { size: 32, color: colors.white, weight: 760 });
    label(args, '68% financé', 124, 1004, { size: 29, color: colors.mint, weight: 560 });
    circle(args, 770, 1073, 126, 'none', '#4F7F5B', 21);
    draw(args, 'path M 770,947 A 126,126 0 0,1 889,1113', { fill: 'none', stroke: colors.lime, width: 21 });
    centeredLabel(args, '68%', 770, 1073, { size: 43, color: colors.white, weight: 800, height: 1920 });
    roundedRect(args, 124, 1181, 694, 1210, 15, '#4F7F5B');
    roundedRect(args, 124, 1181, 514, 1210, 15, colors.lime);
    label(args, 'Donne un nom à ton prochain objectif.', 0, 1516, { size: 31, color: colors.forest, weight: 680, gravity: 'North' });
    footer(args, colors.mint);
    im(pngPath('stories', '06-savings-goals.png'), args);
  }

  // 07 — guided product tour.
  {
    const args = canvas(1080, 1920, colors.surfaceSoft);
    arch(args, 898, 314, 420, 360, colors.sage);
    sparkle(args, 823, 336, 58, colors.secondary);
    storySignature(args, 7, colors.surfaceSoft, 'TOUR · EN 3 ÉTAPES');
    headline(args, ['Un plan plus', 'clair, en', 'quelques taps.'], 80, 298, { size: 106, color: colors.ink, leading: 0.9 });
    elevatedCard(args, 227, 872, 853, 1434, 76, colors.forest, { shadow: '#C9DCCB', offset: 13 });
    roundedRect(args, 270, 945, 810, 1309, 42, colors.background);
    label(args, 'TON PLAN · SEPTEMBRE', 321, 1005, { size: 19, color: colors.forest, weight: 730, kerning: 0.8 });
    label(args, '10 000 MAD', 321, 1076, { size: 48, color: colors.ink, weight: 790 });
    [['Besoins', colors.forest], ['Envies', colors.secondary], ['Épargne', colors.limeDeep]].forEach(([name, color], index) => {
      const y = 1180 + index * 42;
      circle(args, 340, y, 9, color);
      label(args, name, 365, y - 13, { size: 23, color: colors.ink, weight: 630 });
    });
    roundedRect(args, 455, 1353, 625, 1382, 15, colors.lime);
    label(args, 'Retrouve le tour complet dans le Highlight.', 0, 1536, { size: 30, color: colors.muted, weight: 540, gravity: 'North' });
    footer(args, colors.surfaceSoft);
    im(pngPath('stories', '07-app-tour.png'), args);
  }

  // 08 — close with a low-pressure habit.
  {
    const args = canvas(1080, 1920, colors.limeDeep);
    circle(args, 899, 318, 292, colors.lime);
    moonIcon(args, 825, 330, 56, { fill: colors.forest, cutout: colors.lime });
    storySignature(args, 8, colors.limeDeep, 'PETIT CONSEIL · BUDGET');
    headline(args, ['Fais le', 'prochain pas.', 'Pas tout', 'd’un coup.'], 80, 292, { size: 103, color: colors.ink, leading: 0.89 });
    elevatedCard(args, 72, 1010, 1008, 1368, 58, colors.background, { shadow: '#7FB069', offset: 13 });
    label(args, 'UN RESET PLUS DOUX', 124, 1085, { size: 20, color: colors.forest, weight: 740, kerning: 1 });
    label(args, 'Regarde les chiffres.', 124, 1171, { size: 43, color: colors.ink, weight: 770 });
    label(args, 'Fais un ajustement utile.', 124, 1232, { size: 29, color: colors.muted, weight: 540 });
    label(args, 'Garde cette Story pour le prochain mois chargé. ✦', 0, 1518, { size: 30, color: colors.ink, weight: 660, gravity: 'North' });
    footer(args, colors.limeDeep);
    im(pngPath('stories', '08-budget-tip.png'), args);
  }
}

function createReelCovers() {
  {
    const args = canvas(1080, 1920, colors.background);
    circle(args, 910, 310, 290, colors.mint);
    sparkle(args, 819, 344, 60, colors.limeDeep);
    storySignature(args, 1, colors.background, 'REEL · 30 SECONDES');
    headline(args, ['Donne un rôle', 'à chaque', 'dirham.'], 80, 300, { size: 113, color: colors.ink, leading: 0.9 });
    photoCard(args, modernBudgetIllustration, 518, 638, 446, 252, 42, 'South');
    roundedRect(args, 518, 638, 964, 890, 42, 'none', colors.white, 4);
    elevatedCard(args, 72, 960, 1008, 1380, 62, colors.forest, { shadow: '#C9DCCB', offset: 13 });
    label(args, 'UN RESET DU MOIS, SIMPLE', 124, 1032, { size: 21, color: colors.lime, weight: 730, kerning: 1 });
    label(args, 'La méthode en', 124, 1136, { size: 51, color: colors.white, weight: 780 });
    label(args, '3 petites étapes.', 124, 1200, { size: 51, color: colors.white, weight: 780 });
    circle(args, 798, 1160, 114, colors.lime);
    draw(args, 'polygon 764,1096 764,1224 878,1160', { fill: colors.forest });
    footer(args, colors.background);
    im(pngPath('reels', '01-give-every-dirham-a-job-cover.png'), args);
  }

  {
    const args = canvas(1080, 1920, colors.forestSoft);
    circle(args, 910, 314, 290, colors.forest);
    sparkle(args, 825, 337, 60, colors.limeDeep);
    storySignature(args, 2, colors.forestSoft, 'REEL · MINDSET BUDGET');
    arabicHeadline(args, ['الميزانية', 'ماشي عقاب.'], 1000, 292, { size: 94, color: colors.white, leading: 1.24, weight: 780 });
    arabicLabel(args, 'هي طريقة باش ترتاح مع قراراتك.', 998, 594, { size: 28, color: colors.mint, weight: 560 });
    elevatedCard(args, 72, 969, 1008, 1377, 62, colors.background, { shadow: '#1A4F48', offset: 13 });
    heartIcon(args, 236, 1160, 100, { fill: colors.secondary });
    label(args, 'Un budget, c’est un outil de choix.', 364, 1098, { size: 37, color: colors.ink, weight: 760 });
    label(args, 'Pas un score sur ta vie.', 364, 1158, { size: 30, color: colors.muted, weight: 540 });
    circle(args, 829, 1220, 49, colors.limeDeep);
    footer(args, colors.forestSoft);
    im(pngPath('reels', '02-budgeting-is-not-a-punishment-cover.png'), args);
  }

  {
    const args = canvas(1080, 1920, colors.forestDeep);
    circle(args, 910, 314, 290, '#1A4F48');
    sparkle(args, 825, 341, 60, colors.limeDeep);
    storySignature(args, 3, colors.forestDeep, 'REEL · PRIVÉ PAR CHOIX');
    headline(args, ['Pourquoi pas', 'de connexion', 'bancaire ?'], 80, 300, { size: 108, color: colors.white, leading: 0.9 });
    elevatedCard(args, 72, 994, 1008, 1384, 62, '#112825', { shadow: '#071D1A', stroke: '#4F7F5B', width: 2, offset: 12 });
    circle(args, 250, 1190, 111, colors.forestSoft);
    shieldIcon(args, 250, 1190, 130, { stroke: colors.white, accent: colors.lime });
    label(args, 'Un suivi manuel,', 410, 1123, { size: 42, color: colors.white, weight: 780 });
    label(args, 'clair et choisi par toi.', 410, 1185, { size: 30, color: colors.mint, weight: 540 });
    footer(args, colors.forestDeep);
    im(pngPath('reels', '03-why-no-bank-connection-cover.png'), args);
  }
}

function drawProfileHighlight(args, x, y, icon, color, labelText) {
  circle(args, x, y, 74, '#FBFDFB');
  circle(args, x, y, 59, color);
  iconByName(args, icon, x, y, 42, { stroke: contrastOn(color), accent: colors.lime });
  label(args, labelText, x - 540, y + 91, { size: 15, color: colors.ink, weight: 720, gravity: 'North' });
}

function createPreviews() {
  const postFiles = [
    '01-your-money-on-purpose.png',
    '02-give-your-money-a-plan.png',
    '03-three-buckets-one-clear-view.png',
    '04-purpose-and-place.png',
    '05-money-places.png',
    '06-private-by-design.png',
    '07-give-every-dirham-a-job.png',
    '08-save-for-what-matters.png',
    '09-budget-in-your-language.png',
  ].map((file) => join(kitRoot, 'posts', file));
  const grid = pngPath('previews', 'smartjib-3x3-launch-grid.png');
  montage(grid, postFiles, ['-tile', '3x3', '-geometry', '360x450+0+0', '-background', colors.background]);

  const highlightFiles = [
    '01-start-cover.png',
    '02-budget-cover.png',
    '03-places-cover.png',
    '04-goals-cover.png',
    '05-private-cover.png',
    '06-tour-cover.png',
    '07-tips-cover.png',
    '08-faq-cover.png',
  ].map((file) => join(kitRoot, 'highlights', file));
  montage(pngPath('previews', 'smartjib-highlight-cover-sheet.png'), highlightFiles, [
    '-tile', '4x2',
    '-geometry', '270x480+0+0',
    '-background', colors.background,
  ]);

  // A profile mock-up showing the actual circle-style highlight treatment,
  // rather than rectangular Story frames, and the current Morocco-first bio.
  {
    const avatar = join(kitRoot, 'brand', 'smartjib-instagram-avatar-1080.png');
    const args = canvas(1080, 2120, colors.white);
    args.push('(', avatar, '-resize', '182x182', ')', '-gravity', 'NorthWest', '-geometry', '+76+72', '-composite');
    label(args, 'smartjib.app', 294, 112, { size: 42, color: colors.ink, weight: 800 });
    label(args, 'Budget simple · Maroc', 294, 168, { size: 24, color: colors.muted, weight: 540 });
    arabicLabel(args, 'فلوسك بوضوح، بلا ضغط. ✦', 1000, 286, { size: 28, color: colors.ink, weight: 650 });
    label(args, 'Budget simple en MAD · العربية · Français', 76, 337, { size: 25, color: colors.ink, weight: 540 });
    label(args, 'smartjib.app', 76, 383, { size: 24, color: colors.forest, weight: 760 });
    drawProfileHighlight(args, 132, 543, 'spark', colors.secondary, 'START');
    drawProfileHighlight(args, 336, 543, 'wallet', colors.limeDeep, 'BUDGET');
    drawProfileHighlight(args, 540, 543, 'location', colors.forestSoft, 'PLACES');
    drawProfileHighlight(args, 744, 543, 'target', '#7FB069', 'GOALS');
    drawProfileHighlight(args, 948, 543, 'shield', '#5B6B63', 'PRIVATE');
    args.push('(', grid, '-resize', '1080x1350', ')', '-gravity', 'South', '-geometry', '+0+0', '-composite');
    im(pngPath('previews', 'smartjib-instagram-profile-preview.png'), args);
  }
}

function main() {
  for (const source of [
    logo,
    font.display,
    font.body,
    font.bodyStrong,
    font.arabicDisplay,
    font.arabicBody,
    font.arabicBodyStrong,
    generatedFlatlay,
    modernBudgetIllustration,
    savingsIllustration,
    moneyPlacesIllustration,
  ]) {
    if (!existsSync(source)) throw new Error(`Required source asset not found: ${source}`);
  }
  // Preserve copy docs, source fonts, and editable SVG templates on refresh.
  ['brand', 'highlights', 'posts', 'stories', 'reels', 'previews'].forEach((folder) => {
    rmSync(join(kitRoot, folder), { recursive: true, force: true });
  });
  createBrandAssets();
  createHighlightCovers();
  createPosts();
  createStories();
  createReelCovers();
  createPreviews();
  console.log(`Morocco-first Instagram launch kit generated in ${kitRoot}`);
}

main();
