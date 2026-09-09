#!/usr/bin/env node
/**
 * Build SmartJib's Morocco-first Instagram launch kit.
 *
 * The checked-in PNGs under marketing/instagram are the upload-ready files.
 * This script recreates them using only ImageMagick plus the licensed local
 * Instrument Sans and Cairo font files stored with the launch kit.
 *
 * Run: node scripts/generate-instagram-kit.mjs
 */

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const kitRoot = join(repoRoot, 'marketing', 'instagram');
const logo = join(repoRoot, 'public', 'logo.png');
const fontRoot = join(kitRoot, 'fonts');

const colors = {
  cream: '#FFF9F1',
  paper: '#F7FAF8',
  white: '#FFFFFF',
  ink: '#172622',
  muted: '#5E716B',
  line: '#D6E4DE',
  teal: '#006B62',
  tealBright: '#058F82',
  tealDark: '#004F49',
  mint: '#9CE9DB',
  mist: '#DDF6EF',
  sand: '#F3DFC0',
  gold: '#E9B35C',
  coral: '#E98362',
  blush: '#F8DAD2',
  lavender: '#DCD9FF',
  shadow: '#D8E3DE',
};

const font = {
  display: join(fontRoot, 'InstrumentSans-Variable.ttf'),
  arabic: join(fontRoot, 'Cairo-Variable.ttf'),
};

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

function canvas(width, height, background = colors.cream) {
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
    family = font.display,
    gravity = 'NorthWest',
    weight = 500,
    kerning,
  } = options;
  args.push(
    '-font',
    family,
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
  lines.forEach((text, index) => label(args, text, x, Math.round(y + index * size * leading), {
    size,
    color,
    family,
    weight,
  }));
}

function arabicHeadline(args, lines, right, y, options = {}) {
  const {
    size = 100,
    color = colors.ink,
    weight = 750,
    leading = 0.99,
  } = options;
  lines.forEach((text, index) => arabicLabel(args, text, right, Math.round(y + index * size * leading), {
    size,
    color,
    weight,
  }));
}

/**
 * `-gravity NorthEast` takes an inset from the *right* edge, whereas the rest
 * of this generator works in absolute canvas coordinates. Keep Arabic callers
 * ergonomic by accepting an absolute right edge (e.g. 998 on a 1080 px artboard)
 * and convert it to ImageMagick's inset internally.
 */
function arabicLabel(args, text, right, y, options = {}) {
  label(args, text, 1080 - right, y, {
    family: font.arabic,
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

function footer(args, background = colors.cream) {
  const color = background === colors.teal || background === colors.tealDark || background === colors.tealBright
    ? colors.mist
    : colors.muted;
  label(args, 'smartjib.app', 82, 70, {
    size: 22,
    color,
    weight: 650,
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

function postSignature(args, index, background = colors.cream, kicker = 'MOROCCO · MAD') {
  const inverted = [colors.teal, colors.tealDark, colors.tealBright].includes(background);
  label(args, 'SMARTJIB', 82, 78, {
    size: 25,
    color: inverted ? colors.mint : colors.teal,
    weight: 780,
    kerning: 1.3,
  });
  roundedRect(args, 252, 78, 336, 112, 17, inverted ? '#167C72' : colors.mist);
  label(args, String(index).padStart(2, '0'), 273, 83, {
    size: 18,
    color: inverted ? colors.mint : colors.teal,
    weight: 760,
    kerning: 0.8,
  });
  label(args, kicker, 82, 123, {
    size: 16,
    color: inverted ? '#B8E9DD' : colors.muted,
    weight: 620,
    kerning: 0.6,
  });
}

function storySignature(args, index, background = colors.cream, kicker = 'SMARTJIB · MAROC') {
  const inverted = [colors.teal, colors.tealDark, colors.tealBright].includes(background);
  label(args, 'SMARTJIB', 82, 98, {
    size: 28,
    color: inverted ? colors.mint : colors.teal,
    weight: 780,
    kerning: 1.5,
  });
  roundedRect(args, 291, 96, 390, 134, 19, inverted ? '#167C72' : colors.mist);
  label(args, String(index).padStart(2, '0'), 315, 101, {
    size: 20,
    color: inverted ? colors.mint : colors.teal,
    weight: 760,
  });
  label(args, kicker, 82, 148, {
    size: 18,
    color: inverted ? '#B8E9DD' : colors.muted,
    weight: 620,
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

function walletIcon(args, cx, cy, size, options = {}) {
  const {
    stroke = colors.white,
    accent = colors.mint,
    fill = 'none',
  } = options;
  const u = size / 100;
  roundedRect(args, cx - 54 * u, cy - 32 * u, cx + 45 * u, cy + 34 * u, 18 * u, fill, stroke, 7 * u);
  line(args, cx - 50 * u, cy - 8 * u, cx + 36 * u, cy - 8 * u, stroke, 7 * u);
  roundedRect(args, cx + 22 * u, cy - 2 * u, cx + 66 * u, cy + 25 * u, 12 * u, accent);
  circle(args, cx + 42 * u, cy + 11 * u, 4 * u, colors.teal);
}

function targetIcon(args, cx, cy, size, options = {}) {
  const { stroke = colors.white, accent = colors.mint } = options;
  const u = size / 100;
  circle(args, cx, cy, 46 * u, 'none', stroke, 7 * u);
  circle(args, cx, cy, 27 * u, 'none', accent, 7 * u);
  circle(args, cx, cy, 8 * u, stroke);
  line(args, cx + 24 * u, cy - 25 * u, cx + 62 * u, cy - 63 * u, stroke, 7 * u);
  draw(args, `polygon ${cx + 60 * u},${cy - 66 * u} ${cx + 60 * u},${cy - 38 * u} ${cx + 32 * u},${cy - 66 * u}`, { fill: accent });
}

function coinsIcon(args, cx, cy, size, options = {}) {
  const { stroke = colors.white, accent = colors.gold } = options;
  const u = size / 100;
  circle(args, cx - 32 * u, cy + 20 * u, 28 * u, accent);
  circle(args, cx + 6 * u, cy + 4 * u, 35 * u, stroke);
  circle(args, cx + 38 * u, cy - 24 * u, 25 * u, accent);
  circle(args, cx + 6 * u, cy + 4 * u, 8 * u, colors.teal);
}

function locationIcon(args, cx, cy, size, options = {}) {
  const { stroke = colors.white, accent = colors.mint } = options;
  const u = size / 100;
  draw(args, `path M ${cx},${cy + 58 * u} C ${cx - 42 * u},${cy + 11 * u} ${cx - 44 * u},${cy - 42 * u} ${cx},${cy - 62 * u} C ${cx + 44 * u},${cy - 42 * u} ${cx + 42 * u},${cy + 11 * u} ${cx},${cy + 58 * u} Z`, {
    fill: 'none', stroke, width: 7 * u,
  });
  circle(args, cx, cy - 14 * u, 17 * u, accent);
}

function shieldIcon(args, cx, cy, size, options = {}) {
  const { stroke = colors.white, accent = colors.mint } = options;
  const u = size / 100;
  draw(args, `path M ${cx},${cy - 62 * u} L ${cx + 55 * u},${cy - 39 * u} L ${cx + 45 * u},${cy + 35 * u} L ${cx},${cy + 63 * u} L ${cx - 45 * u},${cy + 35 * u} L ${cx - 55 * u},${cy - 39 * u} Z`, {
    fill: 'none', stroke, width: 7 * u,
  });
  line(args, cx - 27 * u, cy + 2 * u, cx - 4 * u, cy + 25 * u, accent, 8 * u);
  line(args, cx - 4 * u, cy + 25 * u, cx + 31 * u, cy - 15 * u, accent, 8 * u);
}

function calendarIcon(args, cx, cy, size, options = {}) {
  const { stroke = colors.white, accent = colors.mint } = options;
  const u = size / 100;
  roundedRect(args, cx - 55 * u, cy - 50 * u, cx + 55 * u, cy + 50 * u, 18 * u, 'none', stroke, 7 * u);
  line(args, cx - 52 * u, cy - 21 * u, cx + 52 * u, cy - 21 * u, stroke, 7 * u);
  line(args, cx - 28 * u, cy - 67 * u, cx - 28 * u, cy - 36 * u, accent, 8 * u);
  line(args, cx + 28 * u, cy - 67 * u, cx + 28 * u, cy - 36 * u, accent, 8 * u);
  circle(args, cx - 23 * u, cy + 12 * u, 7 * u, accent);
  circle(args, cx + 2 * u, cy + 12 * u, 7 * u, accent);
  circle(args, cx + 27 * u, cy + 12 * u, 7 * u, accent);
}

function chatIcon(args, cx, cy, size, options = {}) {
  const { stroke = colors.white, accent = colors.mint } = options;
  const u = size / 100;
  roundedRect(args, cx - 63 * u, cy - 46 * u, cx + 63 * u, cy + 40 * u, 25 * u, 'none', stroke, 7 * u);
  draw(args, `polygon ${cx - 28 * u},${cy + 37 * u} ${cx - 12 * u},${cy + 37 * u} ${cx - 30 * u},${cy + 64 * u}`, { fill: stroke });
  circle(args, cx - 25 * u, cy - 2 * u, 7 * u, accent);
  circle(args, cx, cy - 2 * u, 7 * u, accent);
  circle(args, cx + 25 * u, cy - 2 * u, 7 * u, accent);
}

function languageIcon(args, cx, cy, size, options = {}) {
  const { stroke = colors.white, accent = colors.mint } = options;
  const u = size / 100;
  circle(args, cx, cy, 57 * u, 'none', stroke, 7 * u);
  line(args, cx - 54 * u, cy, cx + 54 * u, cy, stroke, 6 * u);
  draw(args, `path M ${cx},${cy - 56 * u} C ${cx - 31 * u},${cy - 30 * u} ${cx - 31 * u},${cy + 30 * u} ${cx},${cy + 56 * u}`, { fill: 'none', stroke: accent, width: 6 * u });
  draw(args, `path M ${cx},${cy - 56 * u} C ${cx + 31 * u},${cy - 30 * u} ${cx + 31 * u},${cy + 30 * u} ${cx},${cy + 56 * u}`, { fill: 'none', stroke: accent, width: 6 * u });
}

function heartIcon(args, cx, cy, size, options = {}) {
  const { fill = colors.coral } = options;
  const u = size / 100;
  draw(args, `path M ${cx},${cy + 49 * u} C ${cx - 98 * u},${cy - 5 * u} ${cx - 55 * u},${cy - 72 * u} ${cx},${cy - 32 * u} C ${cx + 55 * u},${cy - 72 * u} ${cx + 98 * u},${cy - 5 * u} ${cx},${cy + 49 * u} Z`, { fill });
}

function moonIcon(args, cx, cy, size, options = {}) {
  const { fill = colors.gold, cutout = colors.teal } = options;
  const u = size / 100;
  circle(args, cx, cy, 52 * u, fill);
  circle(args, cx + 26 * u, cy - 19 * u, 52 * u, cutout);
}

function iconByName(args, name, cx, cy, size, options = {}) {
  if (name === 'wallet') return walletIcon(args, cx, cy, size, options);
  if (name === 'target') return targetIcon(args, cx, cy, size, options);
  if (name === 'coins') return coinsIcon(args, cx, cy, size, options);
  if (name === 'location') return locationIcon(args, cx, cy, size, options);
  if (name === 'shield') return shieldIcon(args, cx, cy, size, options);
  if (name === 'calendar') return calendarIcon(args, cx, cy, size, options);
  if (name === 'chat') return chatIcon(args, cx, cy, size, options);
  if (name === 'language') return languageIcon(args, cx, cy, size, options);
  return sparkle(args, cx, cy, size, options.accent || colors.mint);
}

function miniTag(args, text, x, y, width, fill, textColor = colors.ink) {
  roundedRect(args, x, y, x + width, y + 48, 24, fill);
  label(args, text, x + 20, y + 12, {
    size: 17,
    color: textColor,
    weight: 720,
    kerning: 0.3,
  });
}

function createBrandAssets() {
  const brand = join(kitRoot, 'brand');
  directory(brand);
  cpSync(logo, join(brand, 'smartjib-logo-mark-transparent.png'));

  // Friendly avatar: a warm, highly legible mark with enough quiet space for
  // Instagram's small circular crop.
  {
    const args = canvas(1080, 1080, colors.cream);
    circle(args, 540, 540, 514, colors.mist);
    circle(args, 540, 540, 430, colors.teal);
    circle(args, 540, 540, 346, colors.tealBright);
    circle(args, 540, 540, 278, colors.mint);
    circle(args, 540, 540, 236, colors.cream);
    sparkle(args, 240, 308, 74, colors.gold);
    sparkle(args, 833, 760, 64, colors.coral);
    logoOverlay(args, 525, 'Center', '+0+16');
    im(pngPath('brand', 'smartjib-instagram-avatar-1080.png'), args);
  }

  // Transparent wordmark for Stories, partnerships, and future social edits.
  {
    const args = canvas(1800, 600, 'none');
    circle(args, 282, 302, 238, colors.mist);
    circle(args, 282, 302, 192, colors.teal);
    logoAt(args, 107, 127, 350);
    label(args, 'SmartJib', 570, 177, {
      size: 152,
      color: colors.teal,
      weight: 800,
    });
    label(args, 'BUDGET SIMPLE · VRAIE VIE', 580, 385, {
      size: 34,
      color: colors.muted,
      weight: 690,
      kerning: 1.5,
    });
    sparkle(args, 1573, 205, 54, colors.gold);
    im(pngPath('brand', 'smartjib-horizontal-wordmark.png'), args);
  }

  {
    const args = canvas(1600, 900, colors.cream);
    elevatedCard(args, 48, 48, 1552, 852, 54, colors.white, { shadow: '#E7E2D7', offset: 7 });
    label(args, 'SMARTJIB / PALETTE MAROC', 100, 108, {
      size: 27,
      color: colors.teal,
      weight: 760,
      kerning: 1.2,
    });
    const swatches = [
      ['Teal', colors.teal],
      ['Mint', colors.mint],
      ['Cream', colors.cream],
      ['Coral', colors.coral],
      ['Saffron', colors.gold],
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
    { file: '01-start', title: 'START', color: colors.coral, icon: 'spark' },
    { file: '02-budget', title: 'BUDGET', color: colors.gold, icon: 'wallet' },
    { file: '03-places', title: 'PLACES', color: colors.tealBright, icon: 'location' },
    { file: '04-goals', title: 'GOALS', color: '#6BBEAF', icon: 'target' },
    { file: '05-private', title: 'PRIVATE', color: '#567A73', icon: 'shield' },
    { file: '06-tour', title: 'TOUR', color: '#8D88D9', icon: 'calendar' },
    { file: '07-tips', title: 'TIPS', color: '#E59B70', icon: 'coins' },
    { file: '08-faq', title: 'FAQ', color: '#C87FA1', icon: 'chat' },
  ];

  covers.forEach(({ file, title, color, icon }, index) => {
    const args = canvas(1080, 1920, colors.cream);
    circle(args, 540, 960, 468, '#F9F4EA');
    circle(args, 540, 960, 380, color);
    circle(args, 540, 960, 320, '#FFFFFF', '#FFFFFF', 8);
    circle(args, 540, 960, 276, color);
    sparkle(args, 258, 637, 50, colors.gold);
    sparkle(args, 826, 1280, 42, colors.coral);
    if (icon === 'spark') {
      sparkle(args, 540, 960, 210, colors.white);
      circle(args, 540, 960, 52, colors.mint);
    } else {
      iconByName(args, icon, 540, 960, 180, { stroke: colors.white, accent: colors.mint });
    }
    label(args, `SMARTJIB / ${String(index + 1).padStart(2, '0')}`, 0, 194, {
      size: 23,
      color: colors.teal,
      weight: 730,
      gravity: 'North',
      kerning: 1,
    });
    label(args, title, 0, 1656, {
      size: 34,
      color: colors.teal,
      weight: 820,
      gravity: 'North',
      kerning: 1.2,
    });
    im(pngPath('highlights', `${file}-cover.png`), args);
  });
}

function createPosts() {
  // 01 — warm welcome: friendly French opener for a Moroccan audience.
  {
    const args = canvas(1080, 1350, colors.cream);
    circle(args, 962, 174, 250, colors.blush);
    sparkle(args, 863, 220, 54, colors.gold);
    postSignature(args, 1, colors.cream, 'BIENVENUE · MAROC');
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
    elevatedCard(args, 72, 606, 1008, 1118, 54, colors.teal, { shadow: '#B7D9D1', offset: 14 });
    circle(args, 786, 852, 190, colors.mint);
    circle(args, 786, 852, 142, colors.cream);
    logoAt(args, 637, 699, 300);
    miniTag(args, 'BESOINS', 126, 710, 183, colors.mint, colors.teal);
    miniTag(args, 'ENVIES', 126, 778, 162, colors.blush, colors.ink);
    miniTag(args, 'ÉPARGNE', 126, 846, 184, colors.sand, colors.ink);
    label(args, 'Des petits choix.', 126, 965, { size: 39, color: colors.white, weight: 760 });
    label(args, 'Plus de clarté au quotidien.', 126, 1016, { size: 26, color: colors.mist, weight: 520 });
    footer(args, colors.cream);
    im(pngPath('posts', '01-your-money-on-purpose.png'), args);
  }

  // 02 — core monthly-planning idea, localized around the dirham.
  {
    const args = canvas(1080, 1350, colors.paper);
    arch(args, 907, 201, 380, 320, colors.mist);
    circle(args, 860, 175, 62, colors.gold);
    postSignature(args, 2, colors.paper, 'PLAN DU MOIS · MAD');
    headline(args, ['Donne un rôle', 'à chaque dirham.'], 78, 212, {
      size: 96,
      color: colors.ink,
      leading: 0.94,
    });
    elevatedCard(args, 72, 532, 1008, 1084, 54, colors.white, {
      shadow: '#DCE7E2', stroke: colors.line, width: 2, offset: 11,
    });
    label(args, 'EXEMPLE POUR COMMENCER', 122, 593, {
      size: 18,
      color: colors.teal,
      weight: 740,
      kerning: 1,
    });
    label(args, '10 000 MAD', 122, 661, { size: 43, color: colors.ink, weight: 790 });
    const rows = [
      ['BESOINS', '50%', colors.teal],
      ['ENVIES', '30%', colors.coral],
      ['ÉPARGNE', '20%', colors.gold],
    ];
    rows.forEach(([name, value, color], index) => {
      const y = 760 + index * 104;
      circle(args, 138, y + 16, 12, color);
      label(args, name, 166, y, { size: 24, color: colors.ink, weight: 700 });
      rightLabel(args, value, 904, y, { size: 26, color: colors.ink, weight: 780 });
      roundedRect(args, 166, y + 47, 816, y + 66, 10, '#E6F1ED');
      const length = [326, 196, 130][index];
      roundedRect(args, 166, y + 47, 166 + length, y + 66, 10, color);
    });
    label(args, 'C’est un départ, pas une règle à subir.', 82, 1160, {
      size: 28,
      color: colors.muted,
      weight: 530,
    });
    footer(args, colors.paper);
    im(pngPath('posts', '02-give-your-money-a-plan.png'), args);
  }

  // 03 — Arabic/Darija hero post, set entirely in Cairo.
  {
    const args = canvas(1080, 1350, colors.teal);
    circle(args, 171, 197, 160, colors.tealBright);
    sparkle(args, 844, 188, 74, colors.gold);
    postSignature(args, 3, colors.teal, 'MAD · BUDGET SIMPLE');
    arabicHeadline(args, ['كل درهم', 'عندو مهمة.'], 998, 190, {
      size: 88,
      color: colors.white,
      leading: 1.25,
      weight: 780,
    });
    arabicLabel(args, 'خطّط بشوية بشوية، وعلى قدّك.', 998, 480, {
      size: 27,
      color: colors.mist,
      weight: 550,
    });
    elevatedCard(args, 72, 585, 1008, 1102, 56, colors.cream, { shadow: '#00554D', offset: 14 });
    const items = [
      ['احتياجات', colors.mint, 'ضروري'],
      ['رغبات', colors.blush, 'يبقى اختيار'],
      ['ادخار', colors.sand, 'للي جاي'],
    ];
    items.forEach(([title, fill, note], index) => {
      const x = 116 + index * 295;
      roundedRect(args, x, 691, x + 245, 963, 35, fill);
      circle(args, x + 122, 762, 54, colors.white);
      if (index === 0) walletIcon(args, x + 122, 762, 62, { stroke: colors.teal, accent: colors.coral });
      if (index === 1) heartIcon(args, x + 122, 760, 57, { fill: colors.coral });
      if (index === 2) targetIcon(args, x + 122, 762, 61, { stroke: colors.teal, accent: colors.coral });
      arabicLabel(args, title, x + 210, 842, { size: 28, color: colors.ink, weight: 750 });
      arabicLabel(args, note, x + 210, 884, { size: 20, color: colors.muted, weight: 560 });
    });
    arabicLabel(args, 'ماشي خصك تكون كامل. خصك غير تبدأ.', 998, 1172, {
      size: 32,
      color: colors.mint,
      weight: 600,
    });
    footer(args, colors.teal);
    im(pngPath('posts', '03-three-buckets-one-clear-view.png'), args);
  }

  // 04 — SmartJib's product distinction with friendly, tactile icons.
  {
    const args = canvas(1080, 1350, colors.mist);
    circle(args, 944, 178, 250, colors.lavender);
    sparkle(args, 814, 248, 50, colors.coral);
    postSignature(args, 4, colors.mist, 'CLARTÉ · SANS PRESSION');
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
    elevatedCard(args, 72, 590, 1008, 802, 48, colors.white, { shadow: '#C9E5DE', offset: 11 });
    circle(args, 184, 697, 66, colors.coral);
    targetIcon(args, 184, 697, 78, { stroke: colors.white, accent: colors.sand });
    label(args, 'POUR QUOI ?', 292, 638, { size: 19, color: colors.teal, weight: 730, kerning: 1 });
    label(args, 'Le rôle de ton argent.', 292, 688, { size: 35, color: colors.ink, weight: 750 });
    elevatedCard(args, 72, 852, 1008, 1064, 48, colors.white, { shadow: '#C9E5DE', offset: 11 });
    circle(args, 184, 959, 66, colors.tealBright);
    locationIcon(args, 184, 959, 78, { stroke: colors.white, accent: colors.mint });
    label(args, 'OÙ ?', 292, 900, { size: 19, color: colors.teal, weight: 730, kerning: 1 });
    label(args, 'L’endroit où il est.', 292, 950, { size: 35, color: colors.ink, weight: 750 });
    miniTag(args, 'BANQUE', 82, 1142, 142, colors.white, colors.teal);
    miniTag(args, 'MAISON', 240, 1142, 146, colors.white, colors.teal);
    miniTag(args, 'PORTEFEUILLE', 402, 1142, 196, colors.white, colors.teal);
    footer(args, colors.mist);
    im(pngPath('posts', '04-purpose-and-place.png'), args);
  }

  // 05 — Darija money-location explainer.
  {
    const args = canvas(1080, 1350, colors.paper);
    arch(args, 903, 194, 380, 330, colors.sand);
    sparkle(args, 824, 247, 50, colors.coral);
    postSignature(args, 5, colors.paper, 'MONEY PLACES · MAROC');
    arabicHeadline(args, ['فين كاينة', 'فلوسك؟'], 998, 190, {
      size: 88,
      color: colors.ink,
      leading: 1.25,
      weight: 780,
    });
    arabicLabel(args, 'البنك، الدار، ولا فالمحفظة.', 998, 480, {
      size: 27,
      color: colors.muted,
      weight: 560,
    });
    const places = [
      ['البنك', 'Bank', colors.teal, 'location'],
      ['فالدار', 'À la maison', colors.coral, 'wallet'],
      ['المحفظة', 'Dans ta poche', colors.gold, 'coins'],
    ];
    places.forEach(([arabic, french, fill, icon], index) => {
      const y = 588 + index * 174;
      elevatedCard(args, 72, y, 1008, y + 138, 42, colors.white, { shadow: '#DCE7E2', offset: 8 });
      circle(args, 168, y + 69, 46, fill);
      iconByName(args, icon, 168, y + 69, 48, { stroke: colors.white, accent: colors.mint });
      arabicLabel(args, arabic, 924, y + 29, { size: 31, color: colors.ink, weight: 760 });
      label(args, french, 258, y + 80, { size: 22, color: colors.muted, weight: 560 });
    });
    label(args, 'Voir l’endroit sans perdre le plan.', 82, 1150, { size: 29, color: colors.teal, weight: 650 });
    footer(args, colors.paper);
    im(pngPath('posts', '05-money-places.png'), args);
  }

  // 06 — privacy-friendly product promise.
  {
    const args = canvas(1080, 1350, colors.tealDark);
    circle(args, 920, 206, 248, '#166D63');
    sparkle(args, 812, 249, 56, colors.gold);
    postSignature(args, 6, colors.tealDark, 'PRIVÉ · À TON RYTHME');
    headline(args, ['Sans connexion', 'bancaire.'], 78, 218, {
      size: 103,
      color: colors.white,
      leading: 0.94,
    });
    label(args, 'Tu choisis ce que tu veux suivre.', 82, 450, {
      size: 31,
      color: colors.mist,
      weight: 520,
    });
    elevatedCard(args, 72, 609, 1008, 1050, 58, '#123B36', { shadow: '#003D38', stroke: '#27766C', width: 2, offset: 12 });
    circle(args, 540, 780, 136, colors.tealBright);
    shieldIcon(args, 540, 780, 166, { stroke: colors.white, accent: colors.mint });
    label(args, 'Tes choix. Tes données.', 0, 949, { size: 43, color: colors.white, weight: 780, gravity: 'North' });
    label(args, 'Pas de mots de passe bancaires à partager.', 0, 1004, { size: 25, color: colors.mist, weight: 520, gravity: 'North' });
    miniTag(args, 'MANUEL', 82, 1135, 138, '#166D63', colors.mint);
    miniTag(args, 'PRIVÉ', 240, 1135, 122, '#166D63', colors.mint);
    miniTag(args, 'SIMPLE', 382, 1135, 127, '#166D63', colors.mint);
    footer(args, colors.tealDark);
    im(pngPath('posts', '06-private-by-design.png'), args);
  }

  // 07 — low-pressure planning habit in a friendly visual rhythm.
  {
    const args = canvas(1080, 1350, colors.cream);
    circle(args, 920, 194, 240, colors.mint);
    moonIcon(args, 847, 216, 58, { fill: colors.gold, cutout: colors.mint });
    postSignature(args, 7, colors.cream, 'RESET DU MOIS · MAD');
    headline(args, ['Planifier.', 'Ajuster.', 'Respirer.'], 78, 205, {
      size: 103,
      color: colors.ink,
      leading: 0.88,
    });
    elevatedCard(args, 72, 605, 1008, 1088, 56, colors.white, { shadow: '#E8DDD0', stroke: '#E9DCCB', width: 2, offset: 10 });
    label(args, 'TON PLAN CE MOIS-CI', 122, 663, { size: 18, color: colors.teal, weight: 740, kerning: 1 });
    label(args, '10 000 MAD', 122, 729, { size: 42, color: colors.ink, weight: 790 });
    const plan = [
      ['1', 'Prévoir', 'ce qui entre', colors.teal],
      ['2', 'Répartir', 'besoins, envies, épargne', colors.coral],
      ['3', 'Ajuster', 'quand la vie change', colors.gold],
    ];
    plan.forEach(([number, title, note, color], index) => {
      const y = 828 + index * 75;
      circle(args, 143, y + 17, 20, color);
      centeredLabel(args, number, 143, y + 17, { size: 19, color: colors.white, weight: 780 });
      label(args, title, 190, y, { size: 26, color: colors.ink, weight: 740 });
      label(args, note, 345, y + 4, { size: 21, color: colors.muted, weight: 530 });
    });
    label(args, 'Pas besoin d’un budget parfait.', 82, 1160, { size: 30, color: colors.teal, weight: 680 });
    footer(args, colors.cream);
    im(pngPath('posts', '07-give-every-dirham-a-job.png'), args);
  }

  // 08 — Arabic savings message with an actual visual goal.
  {
    const args = canvas(1080, 1350, colors.mist);
    circle(args, 927, 190, 254, colors.paper);
    sparkle(args, 805, 237, 60, colors.gold);
    postSignature(args, 8, colors.mist, 'ÉPARGNE · OBJECTIF');
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
    elevatedCard(args, 72, 600, 1008, 1058, 58, colors.teal, { shadow: '#B5DED5', offset: 13 });
    label(args, 'GOAL IN PROGRESS', 122, 662, { size: 19, color: colors.mint, weight: 720, kerning: 1 });
    arabicLabel(args, 'الهدف الجاي', 610, 728, { size: 30, color: colors.white, weight: 760 });
    label(args, '68% financé', 122, 794, { size: 27, color: colors.mist, weight: 560 });
    circle(args, 799, 806, 112, 'none', '#2B8C81', 19);
    draw(args, 'path M 799,694 A 112,112 0 0,1 905,841', { fill: 'none', stroke: colors.mint, width: 19 });
    centeredLabel(args, '68%', 799, 806, { size: 38, color: colors.white, weight: 800 });
    roundedRect(args, 122, 904, 700, 930, 13, '#2B8C81');
    roundedRect(args, 122, 904, 515, 930, 13, colors.mint);
    miniTag(args, 'MÊME PETIT, ÇA COMPTE', 82, 1145, 278, colors.white, colors.teal);
    footer(args, colors.mist);
    im(pngPath('posts', '08-save-for-what-matters.png'), args);
  }

  // 09 — Arabic-first language inclusion post in Cairo; an explicit response
  // to Moroccan Arabic, French, and English user needs.
  {
    const args = canvas(1080, 1350, colors.coral);
    circle(args, 934, 188, 260, colors.gold);
    circle(args, 934, 188, 192, colors.mint);
    sparkle(args, 790, 279, 58, colors.white);
    postSignature(args, 9, colors.coral, 'ARABIC · FRANÇAIS · ENGLISH');
    arabicHeadline(args, ['ميزانيتك', 'بلغتك.'], 998, 190, {
      size: 92,
      color: colors.ink,
      leading: 1.24,
      weight: 790,
    });
    arabicLabel(args, 'باش التخطيط يكون أسهل وأقرب ليك.', 998, 480, {
      size: 27,
      color: '#55362B',
      weight: 570,
    });
    elevatedCard(args, 72, 602, 1008, 1048, 58, colors.cream, { shadow: '#C96C50', offset: 13 });
    label(args, 'CHOISIS TA LANGUE', 122, 667, { size: 19, color: colors.teal, weight: 740, kerning: 1 });
    const languages = [
      ['العربية', colors.teal, font.arabic, 620],
      ['Français', colors.mint, font.display, 700],
      ['English', colors.sand, font.display, 700],
    ];
    languages.forEach(([text, fill, family, weight], index) => {
      const y = 743 + index * 91;
      roundedRect(args, 122, y, 958, y + 62, 31, fill);
      if (family === font.arabic) {
        arabicLabel(args, text, 887, y + 7, { size: 28, color: colors.white, weight, gravity: 'NorthEast' });
      } else {
        label(args, text, 158, y + 13, { size: 27, color: colors.ink, family, weight });
      }
      circle(args, 907, y + 31, 10, family === font.arabic ? colors.mint : colors.teal);
    });
    label(args, '12 monnaies, dont le MAD.', 82, 1148, { size: 31, color: colors.ink, weight: 700 });
    footer(args, colors.coral);
    im(pngPath('posts', '09-budget-in-your-language.png'), args);
  }
}

function createStories() {
  // 01 — Welcome.
  {
    const args = canvas(1080, 1920, colors.cream);
    circle(args, 925, 326, 292, colors.blush);
    sparkle(args, 826, 319, 66, colors.gold);
    storySignature(args, 1, colors.cream, 'BIENVENUE · SMARTJIB');
    headline(args, ['Ton budget', 'peut être', 'plus doux.'], 80, 292, { size: 116, color: colors.ink, leading: 0.91 });
    label(args, 'Planifie en MAD, à ton rythme.', 84, 650, { size: 34, color: colors.muted, weight: 530 });
    elevatedCard(args, 72, 835, 1008, 1438, 62, colors.teal, { shadow: '#BDD9D2', offset: 14 });
    circle(args, 540, 1118, 234, colors.mint);
    circle(args, 540, 1118, 180, colors.cream);
    logoAt(args, 357, 935, 366);
    miniTag(args, 'BESOINS', 144, 1333, 171, colors.mint, colors.teal);
    miniTag(args, 'ENVIES', 330, 1333, 153, colors.blush, colors.ink);
    miniTag(args, 'ÉPARGNE', 498, 1333, 174, colors.sand, colors.ink);
    label(args, 'Bienvenue. On commence simple. ✦', 0, 1552, { size: 33, color: colors.teal, weight: 680, gravity: 'North' });
    footer(args, colors.cream);
    im(pngPath('stories', '01-welcome-to-smartjib.png'), args);
  }

  // 02 — Budget framework.
  {
    const args = canvas(1080, 1920, colors.paper);
    arch(args, 900, 310, 420, 370, colors.mist);
    sparkle(args, 823, 338, 62, colors.gold);
    storySignature(args, 2, colors.paper, 'PLAN DU MOIS · MAD');
    headline(args, ['Commence avec', 'ton vrai', 'montant.'], 80, 298, { size: 108, color: colors.ink, leading: 0.91 });
    elevatedCard(args, 72, 822, 1008, 1434, 62, colors.white, { shadow: '#DCE8E3', stroke: colors.line, width: 2, offset: 12 });
    label(args, 'EXEMPLE', 125, 888, { size: 19, color: colors.teal, weight: 740, kerning: 1 });
    label(args, '10 000 MAD', 125, 960, { size: 50, color: colors.ink, weight: 790 });
    [['Besoins', '50%', colors.teal], ['Envies', '30%', colors.coral], ['Épargne', '20%', colors.gold]].forEach(([name, value, color], index) => {
      const y = 1080 + index * 108;
      circle(args, 143, y + 18, 13, color);
      label(args, name, 174, y, { size: 30, color: colors.ink, weight: 700 });
      rightLabel(args, value, 899, y, { size: 30, color: colors.ink, weight: 760 });
      roundedRect(args, 174, y + 53, 850, y + 75, 11, '#E6F1ED');
      roundedRect(args, 174, y + 53, [512, 379, 304][index], y + 75, 11, color);
    });
    label(args, 'Le meilleur budget est celui qui respecte ta vraie vie.', 0, 1546, { size: 29, color: colors.muted, weight: 540, gravity: 'North' });
    footer(args, colors.paper);
    im(pngPath('stories', '02-three-buckets.png'), args);
  }

  // 03 — Arabic locations story.
  {
    const args = canvas(1080, 1920, colors.teal);
    circle(args, 924, 310, 294, colors.tealBright);
    sparkle(args, 827, 334, 58, colors.gold);
    storySignature(args, 3, colors.teal, 'MONEY PLACES · MAROC');
    arabicHeadline(args, ['فلوسك', 'فين كاينة؟'], 1000, 290, { size: 96, color: colors.white, leading: 1.24, weight: 780 });
    arabicLabel(args, 'شوف المكان، وباقي حافظ على الخطة.', 998, 596, { size: 28, color: colors.mist, weight: 570 });
    const places = [['البنك', colors.mint, 'location'], ['فالدار', colors.blush, 'wallet'], ['المحفظة', colors.sand, 'coins']];
    places.forEach(([name, fill, icon], index) => {
      const y = 814 + index * 190;
      elevatedCard(args, 72, y, 1008, y + 148, 48, colors.cream, { shadow: '#00524A', offset: 10 });
      circle(args, 163, y + 74, 49, fill);
      iconByName(args, icon, 163, y + 74, 55, { stroke: colors.teal, accent: colors.coral });
      arabicLabel(args, name, 892, y + 35, { size: 36, color: colors.ink, weight: 770 });
    });
    arabicLabel(args, 'مكانك ماشي هو الهدف ديالك.', 998, 1494, { size: 33, color: colors.mint, weight: 620 });
    footer(args, colors.teal);
    im(pngPath('stories', '03-money-places.png'), args);
  }

  // 04 — privacy story.
  {
    const args = canvas(1080, 1920, colors.tealDark);
    circle(args, 900, 324, 292, '#176C62');
    sparkle(args, 826, 341, 60, colors.gold);
    storySignature(args, 4, colors.tealDark, 'PRIVÉ · À TON RYTHME');
    headline(args, ['Tu gardes', 'le contrôle.'], 80, 304, { size: 116, color: colors.white, leading: 0.93 });
    label(args, 'Pas de connexion bancaire.', 84, 560, { size: 35, color: colors.mist, weight: 550 });
    elevatedCard(args, 72, 822, 1008, 1392, 62, '#103A34', { shadow: '#003D38', stroke: '#2A756B', width: 2, offset: 12 });
    circle(args, 540, 1058, 160, colors.tealBright);
    shieldIcon(args, 540, 1058, 185, { stroke: colors.white, accent: colors.mint });
    label(args, 'Tu ajoutes ce qui compte pour toi.', 0, 1278, { size: 34, color: colors.white, weight: 700, gravity: 'North' });
    label(args, 'Un suivi simple, choisi par toi.', 0, 1333, { size: 28, color: colors.mist, weight: 530, gravity: 'North' });
    footer(args, colors.tealDark);
    im(pngPath('stories', '04-private-by-design.png'), args);
  }

  // 05 — question sticker prompt.
  {
    const args = canvas(1080, 1920, colors.coral);
    circle(args, 900, 328, 290, colors.gold);
    sparkle(args, 823, 352, 60, colors.white);
    storySignature(args, 5, colors.coral, 'ON ÉCOUTE · MAROC');
    headline(args, ['Qu’est-ce qui', 'rendrait ton', 'budget plus', 'simple ?'], 80, 292, { size: 100, color: colors.ink, leading: 0.9 });
    elevatedCard(args, 72, 960, 1008, 1326, 56, colors.cream, { shadow: '#C96C50', offset: 12 });
    label(args, 'TA QUESTION', 124, 1031, { size: 20, color: colors.teal, weight: 740, kerning: 1 });
    label(args, 'Ajoute ton idée ici ↓', 124, 1131, { size: 48, color: colors.ink, weight: 780 });
    label(args, 'On prépare des réponses utiles, sans jugement.', 124, 1198, { size: 27, color: colors.muted, weight: 530 });
    roundedRect(args, 112, 1435, 968, 1556, 40, '#FFFFFF', colors.cream, 3);
    label(args, 'AJOUTE LE STICKER QUESTION INSTAGRAM', 0, 1474, { size: 21, color: colors.teal, weight: 750, gravity: 'North' });
    footer(args, colors.coral);
    im(pngPath('stories', '05-ask-a-budget-question.png'), args);
  }

  // 06 — savings goal.
  {
    const args = canvas(1080, 1920, colors.mist);
    circle(args, 912, 320, 290, colors.paper);
    sparkle(args, 825, 339, 62, colors.gold);
    storySignature(args, 6, colors.mist, 'ÉPARGNE · OBJECTIF');
    arabicHeadline(args, ['وفّر للي', 'كيهمّك.'], 1000, 290, { size: 96, color: colors.ink, leading: 1.24, weight: 780 });
    arabicLabel(args, 'حتى خطوة صغيرة كتحسب.', 998, 596, { size: 28, color: colors.muted, weight: 560 });
    elevatedCard(args, 72, 827, 1008, 1375, 62, colors.teal, { shadow: '#B5DED5', offset: 13 });
    arabicLabel(args, 'الهدف الجاي', 600, 908, { size: 32, color: colors.white, weight: 760 });
    label(args, '68% financé', 124, 1004, { size: 29, color: colors.mist, weight: 560 });
    circle(args, 770, 1073, 126, 'none', '#2B8C81', 21);
    draw(args, 'path M 770,947 A 126,126 0 0,1 889,1113', { fill: 'none', stroke: colors.mint, width: 21 });
    centeredLabel(args, '68%', 770, 1073, { size: 43, color: colors.white, weight: 800, height: 1920 });
    roundedRect(args, 124, 1181, 694, 1210, 15, '#2B8C81');
    roundedRect(args, 124, 1181, 514, 1210, 15, colors.mint);
    label(args, 'Donne un nom à ton prochain objectif.', 0, 1516, { size: 31, color: colors.teal, weight: 680, gravity: 'North' });
    footer(args, colors.mist);
    im(pngPath('stories', '06-savings-goals.png'), args);
  }

  // 07 — guided product tour.
  {
    const args = canvas(1080, 1920, colors.paper);
    arch(args, 898, 314, 420, 360, colors.lavender);
    sparkle(args, 823, 336, 58, colors.coral);
    storySignature(args, 7, colors.paper, 'TOUR · EN 3 ÉTAPES');
    headline(args, ['Un plan plus', 'clair, en', 'quelques taps.'], 80, 298, { size: 106, color: colors.ink, leading: 0.9 });
    elevatedCard(args, 227, 872, 853, 1434, 76, colors.teal, { shadow: '#C2DBD5', offset: 13 });
    roundedRect(args, 270, 945, 810, 1309, 42, colors.cream);
    label(args, 'TON PLAN · SEPTEMBRE', 321, 1005, { size: 19, color: colors.teal, weight: 730, kerning: 0.8 });
    label(args, '10 000 MAD', 321, 1076, { size: 48, color: colors.ink, weight: 790 });
    [['Besoins', colors.teal], ['Envies', colors.coral], ['Épargne', colors.gold]].forEach(([name, color], index) => {
      const y = 1180 + index * 42;
      circle(args, 340, y, 9, color);
      label(args, name, 365, y - 13, { size: 23, color: colors.ink, weight: 630 });
    });
    roundedRect(args, 455, 1353, 625, 1382, 15, colors.mint);
    label(args, 'Retrouve le tour complet dans le Highlight.', 0, 1536, { size: 30, color: colors.muted, weight: 540, gravity: 'North' });
    footer(args, colors.paper);
    im(pngPath('stories', '07-app-tour.png'), args);
  }

  // 08 — close with a low-pressure habit.
  {
    const args = canvas(1080, 1920, colors.gold);
    circle(args, 899, 318, 292, colors.mint);
    moonIcon(args, 825, 330, 56, { fill: colors.teal, cutout: colors.mint });
    storySignature(args, 8, colors.gold, 'PETIT CONSEIL · BUDGET');
    headline(args, ['Fais le', 'prochain pas.', 'Pas tout', 'd’un coup.'], 80, 292, { size: 103, color: colors.ink, leading: 0.89 });
    elevatedCard(args, 72, 1010, 1008, 1368, 58, colors.cream, { shadow: '#C98F45', offset: 13 });
    label(args, 'UN RESET PLUS DOUX', 124, 1085, { size: 20, color: colors.teal, weight: 740, kerning: 1 });
    label(args, 'Regarde les chiffres.', 124, 1171, { size: 43, color: colors.ink, weight: 770 });
    label(args, 'Fais un ajustement utile.', 124, 1232, { size: 29, color: colors.muted, weight: 540 });
    label(args, 'Garde cette Story pour le prochain mois chargé. ✦', 0, 1518, { size: 30, color: colors.ink, weight: 660, gravity: 'North' });
    footer(args, colors.gold);
    im(pngPath('stories', '08-budget-tip.png'), args);
  }
}

function createReelCovers() {
  {
    const args = canvas(1080, 1920, colors.cream);
    circle(args, 910, 310, 290, colors.blush);
    sparkle(args, 819, 344, 60, colors.gold);
    storySignature(args, 1, colors.cream, 'REEL · 30 SECONDES');
    headline(args, ['Donne un rôle', 'à chaque', 'dirham.'], 80, 300, { size: 113, color: colors.ink, leading: 0.9 });
    elevatedCard(args, 72, 960, 1008, 1380, 62, colors.teal, { shadow: '#BBD9D2', offset: 13 });
    label(args, 'UN RESET DU MOIS, SIMPLE', 124, 1032, { size: 21, color: colors.mint, weight: 730, kerning: 1 });
    label(args, 'La méthode en', 124, 1136, { size: 51, color: colors.white, weight: 780 });
    label(args, '3 petites étapes.', 124, 1200, { size: 51, color: colors.white, weight: 780 });
    circle(args, 798, 1160, 114, colors.mint);
    draw(args, 'polygon 764,1096 764,1224 878,1160', { fill: colors.teal });
    footer(args, colors.cream);
    im(pngPath('reels', '01-give-every-dirham-a-job-cover.png'), args);
  }

  {
    const args = canvas(1080, 1920, colors.tealBright);
    circle(args, 910, 314, 290, colors.teal);
    sparkle(args, 825, 337, 60, colors.gold);
    storySignature(args, 2, colors.tealBright, 'REEL · MINDSET BUDGET');
    arabicHeadline(args, ['الميزانية', 'ماشي عقاب.'], 1000, 292, { size: 94, color: colors.white, leading: 1.24, weight: 780 });
    arabicLabel(args, 'هي طريقة باش ترتاح مع قراراتك.', 998, 594, { size: 28, color: colors.mist, weight: 560 });
    elevatedCard(args, 72, 969, 1008, 1377, 62, colors.cream, { shadow: '#006E65', offset: 13 });
    heartIcon(args, 236, 1160, 100, { fill: colors.coral });
    label(args, 'Un budget, c’est un outil de choix.', 364, 1098, { size: 37, color: colors.ink, weight: 760 });
    label(args, 'Pas un score sur ta vie.', 364, 1158, { size: 30, color: colors.muted, weight: 540 });
    circle(args, 829, 1220, 49, colors.gold);
    footer(args, colors.tealBright);
    im(pngPath('reels', '02-budgeting-is-not-a-punishment-cover.png'), args);
  }

  {
    const args = canvas(1080, 1920, colors.tealDark);
    circle(args, 910, 314, 290, '#1A746A');
    sparkle(args, 825, 341, 60, colors.gold);
    storySignature(args, 3, colors.tealDark, 'REEL · PRIVÉ PAR CHOIX');
    headline(args, ['Pourquoi pas', 'de connexion', 'bancaire ?'], 80, 300, { size: 108, color: colors.white, leading: 0.9 });
    elevatedCard(args, 72, 994, 1008, 1384, 62, '#123B36', { shadow: '#003A35', stroke: '#2C756C', width: 2, offset: 12 });
    circle(args, 250, 1190, 111, colors.tealBright);
    shieldIcon(args, 250, 1190, 130, { stroke: colors.white, accent: colors.mint });
    label(args, 'Un suivi manuel,', 410, 1123, { size: 42, color: colors.white, weight: 780 });
    label(args, 'clair et choisi par toi.', 410, 1185, { size: 30, color: colors.mist, weight: 540 });
    footer(args, colors.tealDark);
    im(pngPath('reels', '03-why-no-bank-connection-cover.png'), args);
  }
}

function drawProfileHighlight(args, x, y, icon, color, labelText) {
  circle(args, x, y, 74, '#F4EFE5');
  circle(args, x, y, 59, color);
  if (icon === 'spark') {
    sparkle(args, x, y, 52, colors.white);
  } else {
    iconByName(args, icon, x, y, 42, { stroke: colors.white, accent: colors.mint });
  }
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
  montage(grid, postFiles, ['-tile', '3x3', '-geometry', '360x450+0+0', '-background', colors.cream]);

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
    '-background', colors.cream,
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
    label(args, 'smartjib.app', 76, 383, { size: 24, color: colors.teal, weight: 760 });
    drawProfileHighlight(args, 132, 543, 'spark', colors.coral, 'START');
    drawProfileHighlight(args, 336, 543, 'wallet', colors.gold, 'BUDGET');
    drawProfileHighlight(args, 540, 543, 'location', colors.tealBright, 'PLACES');
    drawProfileHighlight(args, 744, 543, 'target', '#6BBEAF', 'GOALS');
    drawProfileHighlight(args, 948, 543, 'shield', '#567A73', 'PRIVATE');
    args.push('(', grid, '-resize', '1080x1350', ')', '-gravity', 'South', '-geometry', '+0+0', '-composite');
    im(pngPath('previews', 'smartjib-instagram-profile-preview.png'), args);
  }
}

function main() {
  for (const source of [logo, font.display, font.arabic]) {
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
