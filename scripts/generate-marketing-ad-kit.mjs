#!/usr/bin/env node
/**
 * Generate SmartJib paid-media and email-header artwork from the published
 * Morocco-first identity. Delivery PNGs are written only under
 * marketing/advertising/assets and marketing/mailing/assets.
 *
 * Requires ImageMagick 6 (`convert`, `montage`) and the repository dependencies.
 * Run: node scripts/generate-marketing-ad-kit.mjs
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ArabicReshaper from 'arabic-reshaper';
import bidiFactory from 'bidi-js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const adRoot = join(root, 'marketing', 'advertising', 'assets');
const mailRoot = join(root, 'marketing', 'mailing', 'assets');
const fonts = join(root, 'marketing', 'instagram', 'fonts');
const logo = join(root, 'public', 'logo.png');

const color = {
  cream: '#FFF9F1',
  paper: '#F7FAF8',
  white: '#FFFFFF',
  ink: '#172622',
  muted: '#5E716B',
  line: '#D6E4DE',
  teal: '#006B62',
  bright: '#058F82',
  deep: '#004F49',
  mint: '#9CE9DB',
  mist: '#DDF6EF',
  sand: '#F3DFC0',
  coral: '#E98362',
  blush: '#F8DAD2',
  saffron: '#E9B35C',
  shadow: '#D8E3DE',
};

const font = {
  display: join(fonts, 'PlusJakartaSans-ExtraBold.ttf'),
  body: join(fonts, 'Inter-Regular.ttf'),
  bodyStrong: join(fonts, 'Inter-SemiBold.ttf'),
  arabicDisplay: join(fonts, 'Cairo-ExtraBold.ttf'),
  arabicBody: join(fonts, 'IBMPlexSansArabic-Regular.ttf'),
  arabicStrong: join(fonts, 'IBMPlexSansArabic-SemiBold.ttf'),
};

const bidi = bidiFactory();
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

function prepareArabic(text) {
  const shaped = ArabicReshaper.convertArabic(text);
  const cairoSafe = Array.from(shaped, (character) => {
    const replacement = cairoPresentationFallbacks.get(character.codePointAt(0));
    return replacement ? String.fromCodePoint(replacement) : character;
  }).join('');
  return bidi.getReorderedString(cairoSafe, bidi.getEmbeddingLevels(cairoSafe, 'rtl'));
}

function ensure(path) {
  mkdirSync(path, { recursive: true });
}

function output(...segments) {
  const path = join(adRoot, ...segments);
  ensure(dirname(path));
  return path;
}

function render(path, args) {
  ensure(dirname(path));
  execFileSync('convert', [
    ...args,
    '-strip', '-colorspace', 'sRGB', '-depth', '8',
    '-units', 'PixelsPerInch', '-density', '72', path,
  ], { stdio: 'inherit' });
}

function base(width, height, fill) {
  return ['-size', `${width}x${height}`, `xc:${fill}`];
}

function draw(args, command, { fill = 'none', stroke = 'none', width = 1 } = {}) {
  const value = command.startsWith('path ') ? `path '${command.slice(5)}'` : command;
  args.push('-fill', fill, '-stroke', stroke, '-strokewidth', String(width), '-draw', value);
}

function rect(args, x1, y1, x2, y2, radius, fill, stroke = 'none', width = 1) {
  draw(args, `roundrectangle ${x1},${y1} ${x2},${y2} ${radius},${radius}`, { fill, stroke, width });
}

function circle(args, x, y, radius, fill, stroke = 'none', width = 1) {
  draw(args, `circle ${x},${y} ${x + radius},${y}`, { fill, stroke, width });
}

function line(args, x1, y1, x2, y2, stroke, width = 4) {
  draw(args, `line ${x1},${y1} ${x2},${y2}`, { stroke, width });
}

function sparkle(args, x, y, size, fill) {
  const h = size / 2;
  draw(args, `polygon ${x},${y - h} ${x + h * 0.34},${y - h * 0.34} ${x + h},${y} ${x + h * 0.34},${y + h * 0.34} ${x},${y + h} ${x - h * 0.34},${y + h * 0.34} ${x - h},${y} ${x - h * 0.34},${y - h * 0.34}`, { fill });
}

function text(args, value, x, y, options = {}) {
  const {
    size = 28,
    fill = color.ink,
    family = font.body,
    weight = 400,
    gravity = 'NorthWest',
    kerning,
  } = options;
  let resolved = family;
  if (family === font.body && weight >= 650) resolved = font.bodyStrong;
  if (family === font.arabicBody && weight >= 650) resolved = font.arabicStrong;
  args.push(
    '-font', resolved,
    '-pointsize', String(size),
    '-fill', fill,
    '-stroke', 'none',
    '-strokewidth', '0',
    '-weight', String(weight),
    '-gravity', gravity,
  );
  if (kerning !== undefined) args.push('-kerning', String(kerning));
  args.push('-annotate', `+${x}+${y}`, value);
}

function heading(args, lines, x, y, options = {}) {
  const { size = 92, fill = color.ink, leading = 0.93 } = options;
  lines.forEach((value, index) => text(args, value, x, Math.round(y + index * size * leading), {
    size,
    fill,
    family: font.display,
    weight: 800,
  }));
}

function arabicText(args, value, right, y, width, options = {}) {
  text(args, prepareArabic(value), width - right, y, {
    family: font.arabicBody,
    gravity: 'NorthEast',
    weight: 500,
    ...options,
  });
}

function arabicHeading(args, lines, right, y, width, options = {}) {
  const { size = 90, fill = color.white, leading = 1.22 } = options;
  lines.forEach((value, index) => arabicText(args, value, right, Math.round(y + index * size * leading), width, {
    size,
    fill,
    family: font.arabicDisplay,
    weight: 850,
  }));
}

function brand(args, width, inverted = false, y = 64) {
  text(args, 'SMARTJIB', 72, y, {
    size: 24,
    fill: inverted ? color.mint : color.teal,
    family: font.body,
    weight: 750,
    kerning: 1.4,
  });
  rect(args, 238, y + 2, 346, y + 37, 18, inverted ? '#167C72' : color.mist);
  text(args, 'MAROC · MAD', 257, y + 8, {
    size: 13,
    fill: inverted ? color.mint : color.teal,
    family: font.body,
    weight: 700,
    kerning: 0.4,
  });
  sparkle(args, width - 93, y + 25, 33, inverted ? color.saffron : color.coral);
}

function footer(args, inverted = false, width = 1080, y = 1280) {
  text(args, 'smartjib.app', 72, y, {
    size: 22,
    fill: inverted ? color.mint : color.muted,
    family: font.body,
    weight: 700,
  });
  text(args, 'BUDGET SIMPLE · MAROC', width - 365, y + 3, {
    size: 14,
    fill: inverted ? '#B8E9DD' : color.muted,
    family: font.body,
    weight: 650,
    kerning: 0.6,
  });
}

function button(args, label, x1, y1, x2, y2, fill = color.coral, labelFill = color.ink) {
  rect(args, x1, y1, x2, y2, Math.round((y2 - y1) / 2), fill);
  text(args, label, x1 + 31, y1 + 19, {
    size: 22,
    fill: labelFill,
    family: font.body,
    weight: 700,
  });
  text(args, '→', x2 - 56, y1 + 13, { size: 30, fill: labelFill, family: font.bodyStrong, weight: 700 });
}

function logoComposite(args, size, gravity, geometry) {
  args.push('(', logo, '-resize', `${size}x${size}`, ')', '-gravity', gravity, '-geometry', geometry, '-composite');
}

function makeCalmFeedFr() {
  const path = output('meta', '01-calm-plan-fr-feed.png');
  const a = base(1080, 1350, color.cream);
  circle(a, 970, 112, 245, color.blush);
  sparkle(a, 860, 250, 45, color.saffron);
  brand(a, 1080);
  heading(a, ['Ton budget.', 'Ton rythme.'], 72, 180, { size: 98 });
  text(a, 'Une façon plus douce de planifier en MAD.', 75, 386, { size: 28, fill: color.muted });
  rect(a, 72, 492, 1008, 1055, 42, color.teal);
  text(a, 'TON PLAN DE CE MOIS-CI', 118, 543, { size: 17, fill: color.mint, weight: 700, kerning: 1 });
  text(a, '10 000 MAD', 118, 591, { size: 43, fill: color.white, family: font.display, weight: 800 });
  const rows = [
    ['01', 'Prévoir', 'ce qui entre'],
    ['02', 'Répartir', 'besoins · envies · épargne'],
    ['03', 'Ajuster', 'quand la vie change'],
  ];
  rows.forEach(([number, title, detail], index) => {
    const y = 690 + index * 105;
    circle(a, 137, y + 22, 24, [color.mint, color.coral, color.saffron][index]);
    text(a, number, 123, y + 6, { size: 16, fill: color.ink, weight: 750 });
    text(a, title, 190, y, { size: 27, fill: color.white, weight: 700 });
    text(a, detail, 408, y + 4, { size: 22, fill: '#B8E9DD' });
  });
  button(a, 'Commencer mon budget', 72, 1100, 445, 1175);
  text(a, 'Pas besoin d’un budget parfait.', 485, 1121, { size: 22, fill: color.teal, weight: 700 });
  footer(a);
  render(path, a);
  return path;
}

function makePurposeFeedFr() {
  const path = output('meta', '02-purpose-place-fr-feed.png');
  const a = base(1080, 1350, color.mist);
  circle(a, 938, 100, 210, color.sand);
  brand(a, 1080);
  heading(a, ['Pour quoi ?', 'Et où ?'], 72, 178, { size: 103 });
  text(a, 'Deux questions. Un budget plus clair.', 75, 390, { size: 28, fill: color.muted });

  rect(a, 72, 500, 1008, 720, 34, color.white, color.line, 3);
  circle(a, 158, 610, 44, color.coral);
  circle(a, 158, 610, 20, 'none', color.white, 6);
  circle(a, 158, 610, 5, color.white);
  text(a, 'POUR QUOI ?', 240, 542, { size: 16, fill: color.teal, weight: 750, kerning: 1 });
  text(a, 'Le rôle de ton argent.', 240, 590, { size: 36, fill: color.ink, family: font.display, weight: 800 });
  text(a, 'Besoins · envies · épargne', 240, 646, { size: 22, fill: color.muted });

  rect(a, 72, 760, 1008, 980, 34, color.white, color.line, 3);
  circle(a, 158, 870, 44, color.teal);
  draw(a, 'path M 158,836 C 136,836 126,853 126,868 C 126,895 158,914 158,914 C 158,914 190,895 190,868 C 190,853 180,836 158,836 M 158,855 C 166,855 172,861 172,869 C 172,877 166,883 158,883 C 150,883 144,877 144,869 C 144,861 150,855 158,855', { fill: 'none', stroke: color.white, width: 6 });
  text(a, 'OÙ ?', 240, 802, { size: 16, fill: color.coral, weight: 750, kerning: 1 });
  text(a, 'L’endroit où il est.', 240, 850, { size: 36, fill: color.ink, family: font.display, weight: 800 });
  text(a, 'Banque · maison · portefeuille', 240, 906, { size: 22, fill: color.muted });

  button(a, 'Voir comment ça marche', 72, 1045, 470, 1120, color.teal, color.white);
  text(a, 'Le plan n’est pas le solde.', 512, 1066, { size: 22, fill: color.teal, weight: 700 });
  footer(a);
  render(path, a);
  return path;
}

function shield(a, cx, cy, scale = 1, stroke = color.white) {
  const p = [
    ['M', cx, cy - 110 * scale],
    ['C', cx + 45 * scale, cy - 85 * scale, cx + 90 * scale, cy - 80 * scale, cx + 105 * scale, cy - 75 * scale],
    ['L', cx + 105 * scale, cy + 5 * scale],
    ['C', cx + 105 * scale, cy + 82 * scale, cx + 48 * scale, cy + 125 * scale, cx, cy + 150 * scale],
    ['C', cx - 48 * scale, cy + 125 * scale, cx - 105 * scale, cy + 82 * scale, cx - 105 * scale, cy + 5 * scale],
    ['L', cx - 105 * scale, cy - 75 * scale],
    ['C', cx - 90 * scale, cy - 80 * scale, cx - 45 * scale, cy - 85 * scale, cx, cy - 110 * scale],
  ].map((s) => s.join(' ')).join(' ');
  draw(a, `path ${p}`, { fill: 'none', stroke, width: 12 * scale });
  draw(a, `path M ${cx - 45 * scale},${cy + 8 * scale} L ${cx - 10 * scale},${cy + 42 * scale} L ${cx + 58 * scale},${cy - 30 * scale}`, { fill: 'none', stroke, width: 12 * scale });
}

function makePrivateFeedFr() {
  const path = output('meta', '03-private-fr-feed.png');
  const a = base(1080, 1350, color.teal);
  circle(a, 930, 55, 235, '#167C72');
  brand(a, 1080, true);
  heading(a, ['Sans connexion', 'bancaire.'], 72, 185, { size: 91, fill: color.white });
  text(a, 'Tu choisis ce que tu veux suivre.', 75, 385, { size: 28, fill: color.mint });
  rect(a, 72, 485, 1008, 1005, 44, color.deep, '#31877E', 3);
  circle(a, 540, 678, 128, color.bright);
  shield(a, 540, 668, 0.62);
  text(a, 'TES CHOIX · TES DONNÉES', 348, 846, { size: 22, fill: color.mint, weight: 750, kerning: 1 });
  text(a, 'Pas d’identifiants bancaires à partager', 260, 900, { size: 27, fill: color.white, weight: 700 });
  text(a, 'avec SmartJib.', 440, 942, { size: 27, fill: color.white, weight: 700 });
  button(a, 'Découvrir le fonctionnement', 72, 1060, 545, 1135, color.coral, color.ink);
  text(a, 'MANUEL · SIMPLE · À TON RYTHME', 588, 1081, { size: 15, fill: color.mint, weight: 700, kerning: 0.6 });
  footer(a, true);
  render(path, a);
  return path;
}

function makeCalmFeedAr() {
  const path = output('meta', '04-calm-plan-ar-feed.png');
  const a = base(1080, 1350, color.teal);
  circle(a, 155, 105, 185, '#167C72');
  brand(a, 1080, true);
  arabicHeading(a, ['فلوسك بوضوح،', 'بلا ضغط.'], 1000, 175, 1080, { size: 96 });
  arabicText(a, 'خطّط بالدرهم وعلى حساب واقعك.', 1000, 438, 1080, { size: 27, fill: color.mint });
  rect(a, 72, 530, 1008, 1000, 44, color.cream);
  const rows = [
    ['ضروريات', 'اللي خاصّك'],
    ['رغبات', 'اللي بغيتي'],
    ['توفير', 'للي جاي'],
  ];
  rows.forEach(([title, detail], index) => {
    const x1 = 118 + index * 294;
    rect(a, x1, 615, x1 + 250, 885, 30, [color.mint, color.blush, color.sand][index]);
    circle(a, x1 + 125, 690, 39, color.white);
    text(a, ['01', '02', '03'][index], x1 + 104, 674, { size: 22, fill: color.teal, weight: 750 });
    arabicText(a, title, x1 + 222, 755, 1080, { size: 28, fill: color.ink, weight: 700 });
    arabicText(a, detail, x1 + 222, 807, 1080, { size: 19, fill: color.muted });
  });
  arabicText(a, 'ما خاصكش تكون كامل، غير بدا.', 955, 930, 1080, { size: 24, fill: color.teal, weight: 700 });
  rect(a, 660, 1055, 1008, 1132, 39, color.coral);
  arabicText(a, 'نبدا ميزانيتي  ←', 958, 1070, 1080, { size: 25, fill: color.ink, weight: 700 });
  footer(a, true);
  render(path, a);
  return path;
}

function makeCalmStoryFr() {
  const path = output('meta', '05-calm-plan-fr-story.png');
  const a = base(1080, 1920, color.cream);
  circle(a, 925, 120, 260, color.blush);
  brand(a, 1080, false, 100);
  heading(a, ['Ton budget.', 'Ton rythme.'], 72, 285, { size: 108 });
  text(a, 'Commence avec le vrai montant du mois.', 75, 520, { size: 29, fill: color.muted });
  rect(a, 72, 660, 1008, 1385, 48, color.teal);
  text(a, 'UN PLAN QUI BOUGE AVEC LA VRAIE VIE', 118, 720, { size: 18, fill: color.mint, weight: 700, kerning: 1 });
  const rows = [
    ['01', 'Prévoir', 'ce qui entre'],
    ['02', 'Répartir', 'besoins · envies · épargne'],
    ['03', 'Ajuster', 'quand le mois change'],
  ];
  rows.forEach(([n, title, detail], index) => {
    const y = 850 + index * 155;
    circle(a, 150, y + 25, 33, [color.mint, color.coral, color.saffron][index]);
    text(a, n, 130, y + 6, { size: 22, fill: color.ink, weight: 700 });
    text(a, title, 230, y, { size: 37, fill: color.white, family: font.display, weight: 800 });
    text(a, detail, 230, y + 62, { size: 25, fill: '#B8E9DD' });
  });
  button(a, 'Commencer mon budget', 72, 1495, 480, 1580, color.coral, color.ink);
  text(a, 'Pas besoin d’un budget parfait.', 75, 1640, { size: 27, fill: color.teal, weight: 700 });
  footer(a, false, 1080, 1810);
  render(path, a);
  return path;
}

function makeCalmStoryAr() {
  const path = output('meta', '06-calm-plan-ar-story.png');
  const a = base(1080, 1920, color.teal);
  circle(a, 130, 110, 230, '#167C72');
  brand(a, 1080, true, 100);
  arabicHeading(a, ['فلوسك بوضوح،', 'بلا ضغط.'], 1000, 285, 1080, { size: 100 });
  arabicText(a, 'بدا بالمبلغ الحقيقي ديال هاد الشهر.', 1000, 555, 1080, { size: 28, fill: color.mint });
  rect(a, 72, 690, 1008, 1390, 48, color.cream);
  const rows = [
    ['١', 'كتب شحال غادي يدخل'],
    ['٢', 'قسّم بين الضروريات والرغبات والتوفير'],
    ['٣', 'عدّل ملي الواقع يتبدّل'],
  ];
  rows.forEach(([n, copy], index) => {
    const y = 810 + index * 170;
    circle(a, 920, y + 22, 34, [color.mint, color.coral, color.saffron][index]);
    arabicText(a, n, 930, y + 2, 1080, { size: 24, fill: color.ink, weight: 700 });
    arabicText(a, copy, 840, y, 1080, { size: index === 1 ? 27 : 31, fill: color.ink, weight: 700 });
    if (index < 2) line(a, 130, y + 110, 950, y + 110, color.line, 3);
  });
  rect(a, 610, 1500, 1008, 1590, 45, color.coral);
  arabicText(a, 'نبدا ميزانيتي  ←', 955, 1518, 1080, { size: 28, fill: color.ink, weight: 700 });
  arabicText(a, 'ما خاصكش تكون كامل، غير بدا.', 1000, 1650, 1080, { size: 27, fill: color.mint, weight: 700 });
  footer(a, true, 1080, 1810);
  render(path, a);
  return path;
}

function makePrivateLandscape() {
  const path = output('display', '07-private-fr-landscape.png');
  const a = base(1200, 628, color.teal);
  circle(a, 1110, 0, 245, '#167C72');
  text(a, 'SMARTJIB', 55, 45, { size: 21, fill: color.mint, weight: 750, kerning: 1.3 });
  sparkle(a, 1125, 62, 35, color.saffron);
  heading(a, ['Sans connexion', 'bancaire.'], 55, 128, { size: 70, fill: color.white, leading: 0.92 });
  text(a, 'Tu choisis ce que tu veux suivre.', 58, 285, { size: 25, fill: color.mint });
  text(a, 'Pas d’identifiants bancaires à partager avec SmartJib.', 58, 345, { size: 20, fill: color.white });
  button(a, 'Découvrir SmartJib', 55, 425, 365, 494, color.coral, color.ink);
  text(a, 'smartjib.app', 58, 556, { size: 19, fill: color.mint, weight: 700 });
  circle(a, 900, 310, 155, color.bright);
  shield(a, 900, 295, 0.68);
  render(path, a);
  return path;
}

function makeEmailHeader() {
  const path = join(mailRoot, 'smartjib-email-header-1200x480.png');
  const a = base(1200, 480, color.cream);
  circle(a, 1100, 55, 235, color.blush);
  circle(a, 1005, 400, 180, color.mist);
  sparkle(a, 1060, 150, 44, color.saffron);
  text(a, 'SMARTJIB', 60, 50, { size: 22, fill: color.teal, weight: 750, kerning: 1.4 });
  heading(a, ['Ton budget.', 'Ton rythme.'], 60, 125, { size: 72 });
  text(a, 'Une façon plus douce de planifier en MAD.', 62, 305, { size: 24, fill: color.muted });
  logoComposite(a, 170, 'East', '+90+0');
  render(path, a);
  return path;
}

function makePreview(paths) {
  const preview = output('previews', 'smartjib-paid-creative-preview.png');
  const thumbs = paths.slice(0, 6).map((path) => `${path}[0]`);
  execFileSync('montage', [
    ...thumbs,
    '-thumbnail', '300x430',
    '-tile', '3x2',
    '-geometry', '+28+28',
    '-background', color.paper,
    '-bordercolor', color.white,
    '-border', '8',
    '-strip', '-colorspace', 'sRGB', '-depth', '8', preview,
  ], { stdio: 'inherit' });
}

rmSync(adRoot, { recursive: true, force: true });
ensure(adRoot);
ensure(mailRoot);

const paid = [
  makeCalmFeedFr(),
  makePurposeFeedFr(),
  makePrivateFeedFr(),
  makeCalmFeedAr(),
  makeCalmStoryFr(),
  makeCalmStoryAr(),
  makePrivateLandscape(),
];
makeEmailHeader();
makePreview(paid);

console.log(`Generated ${paid.length} paid assets, 1 preview, and 1 email header.`);
