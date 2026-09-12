#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const marketingRoot = join(root, 'marketing');
const instagramRoot = join(marketingRoot, 'instagram');
const errors = [];
const pass = (message) => console.log(`✓ ${message}`);
const fail = (message) => errors.push(message);

const colors = {
  background: '#F3F7F3',
  surfaceSoft: '#FBFDFB',
  white: '#FFFFFF',
  ink: '#0E1A17',
  muted: '#5B6B63',
  forest: '#0F3B36',
  forestSoft: '#1A4F48',
  forestDeep: '#0A2C28',
  panelDark: '#112825',
  lime: '#C5E6A6',
  limeBright: '#D6F0BD',
  limeDeep: '#A9D383',
  mint: '#E3F0E6',
  sage: '#C9DCCB',
  secondary: '#4F7F5B',
};

function luminance(hex) {
  const values = hex.match(/[0-9a-f]{2}/gi).map((part) => Number.parseInt(part, 16) / 255);
  const [red, green, blue] = values.map((value) => (
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground, background) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

const contrastPairs = [
  ['ink', 'background'], ['ink', 'surfaceSoft'], ['ink', 'white'], ['ink', 'mint'], ['ink', 'sage'],
  ['ink', 'lime'], ['ink', 'limeBright'], ['ink', 'limeDeep'],
  ['muted', 'background'], ['muted', 'surfaceSoft'], ['muted', 'white'], ['muted', 'mint'],
  ['forest', 'background'], ['forest', 'surfaceSoft'], ['forest', 'white'], ['forest', 'mint'], ['forest', 'sage'],
  ['forestDeep', 'lime'], ['forestDeep', 'limeBright'], ['forestDeep', 'limeDeep'],
  ['white', 'forest'], ['white', 'forestSoft'], ['white', 'forestDeep'], ['white', 'panelDark'], ['white', 'secondary'],
  ['mint', 'forest'], ['mint', 'forestSoft'], ['mint', 'forestDeep'],
  ['lime', 'forest'], ['lime', 'forestDeep'],
];

for (const [foreground, background] of contrastPairs) {
  const ratio = contrastRatio(colors[foreground], colors[background]);
  if (ratio < 4.5) fail(`Contrast ${foreground}/${background} is ${ratio.toFixed(2)}:1; expected at least 4.5:1.`);
}
if (!errors.length) {
  const ratios = contrastPairs.map(([fg, bg]) => contrastRatio(colors[fg], colors[bg]));
  pass(`${contrastPairs.length} approved text/surface pairs pass WCAG AA (minimum ${Math.min(...ratios).toFixed(2)}:1)`);
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const sourceExtensions = new Set(['.md', '.html', '.svg', '.csv', '.json', '.txt', '.mjs']);
const sourceFiles = [
  ...walk(marketingRoot).filter((path) => sourceExtensions.has(extname(path).toLowerCase())),
  join(root, 'scripts', 'generate-instagram-kit.mjs'),
  join(root, 'scripts', 'generate-marketing-ad-kit.mjs'),
];
const source = sourceFiles.map((path) => `${path}\n${readFileSync(path, 'utf8')}`).join('\n');
if (/smartjib\.app/i.test(source)) fail('Old smartjib.app domain remains in an active marketing source.');
else pass('All active marketing links and rendered labels use smartjib.space');
if (/IBM Plex Sans Arabic/i.test(source)) fail('IBM Plex Sans Arabic remains in an active marketing source.');
else pass('Every active Arabic/Darija marketing source is Cairo-only');
if (/leading:\s*0\./.test(source)) fail('Compressed sub-1.0 display leading remains in a marketing generator.');
else pass('Generated multi-line display leading is no longer compressed');

const requiredFonts = [
  'Inter-Regular.ttf',
  'Inter-SemiBold.ttf',
  'Cairo-ExtraBold.ttf',
  'Cairo-Variable.woff2',
];
for (const name of requiredFonts) {
  if (!existsSync(join(instagramRoot, 'fonts', name))) fail(`Required social font is missing: ${name}`);
}
if (requiredFonts.every((name) => existsSync(join(instagramRoot, 'fonts', name)))) {
  pass('Reproducible Inter and Cairo production font files are present');
}

const publicLogo = join(root, 'public', 'logo.png');
const marketingLogo = join(instagramRoot, 'brand', 'smartjib-logo-mark-transparent.png');
if (!readFileSync(publicLogo).equals(readFileSync(marketingLogo))) {
  fail('The marketing wallet mark does not match the approved public/logo.png master.');
} else {
  pass('App and marketing use the same approved 3D wallet master');
}

const opengraphSource = readFileSync(join(root, 'src', 'app', 'opengraph-image.tsx'), 'utf8');
if (!opengraphSource.includes("'public', 'logo-128.png'")) {
  fail('Open Graph artwork must embed the approved public/logo-128.png wallet.');
} else {
  pass('Open Graph artwork uses the approved wallet');
}

const lightBackgroundIcons = [
  'apple-icon.png',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-192.png',
  'icon-maskable-512.png',
  'web-app-manifest-192x192.png',
  'web-app-manifest-512x512.png',
];
for (const name of lightBackgroundIcons) {
  const path = join(root, 'public', name);
  const corner = execFileSync('convert', [path, '-format', '%[pixel:p{0,0}]', 'info:'], { encoding: 'utf8' }).trim();
  if (!/243\s*,\s*247\s*,\s*243/.test(corner)) {
    fail(`${name} must use the light #F3F7F3 background behind the dark wallet; found ${corner}.`);
  }
}
if (!errors.some((message) => message.includes('background behind the dark wallet'))) {
  pass('PWA and Apple icons keep the dark wallet on a contrasting light background');
}

function pngs(directory) {
  return walk(directory).filter((path) => extname(path).toLowerCase() === '.png');
}

function dimensions(path) {
  return execFileSync('identify', ['-format', '%wx%h', path], { encoding: 'utf8' }).trim();
}

const deliveryGroups = [
  [join(instagramRoot, 'brand'), 4, null],
  [join(instagramRoot, 'highlights'), 8, '1080x1920'],
  [join(instagramRoot, 'posts'), 9, '1080x1350'],
  [join(instagramRoot, 'stories'), 8, '1080x1920'],
  [join(instagramRoot, 'reels'), 3, '1080x1920'],
  [join(marketingRoot, 'advertising', 'assets', 'meta'), 6, null],
  [join(marketingRoot, 'advertising', 'assets', 'display'), 1, '1200x628'],
];
let deliveryCount = 0;
for (const [directory, expectedCount, expectedDimensions] of deliveryGroups) {
  const files = pngs(directory);
  deliveryCount += files.length;
  if (files.length !== expectedCount) fail(`${directory} has ${files.length} PNGs; expected ${expectedCount}.`);
  if (expectedDimensions) {
    for (const path of files) {
      const actual = dimensions(path);
      if (actual !== expectedDimensions) fail(`${path} is ${actual}; expected ${expectedDimensions}.`);
    }
  }
}
const specialDimensions = new Map([
  [join(instagramRoot, 'brand', 'smartjib-instagram-avatar-1080.png'), '1080x1080'],
  [join(instagramRoot, 'brand', 'smartjib-horizontal-wordmark.png'), '1800x600'],
  [join(instagramRoot, 'brand', 'smartjib-logo-mark-transparent.png'), '512x512'],
  [join(instagramRoot, 'brand', 'smartjib-social-palette.png'), '1600x900'],
  [join(marketingRoot, 'advertising', 'assets', 'meta', '01-calm-plan-fr-feed.png'), '1080x1350'],
  [join(marketingRoot, 'advertising', 'assets', 'meta', '02-purpose-place-fr-feed.png'), '1080x1350'],
  [join(marketingRoot, 'advertising', 'assets', 'meta', '03-private-fr-feed.png'), '1080x1350'],
  [join(marketingRoot, 'advertising', 'assets', 'meta', '04-calm-plan-ar-feed.png'), '1080x1350'],
  [join(marketingRoot, 'advertising', 'assets', 'meta', '05-calm-plan-fr-story.png'), '1080x1920'],
  [join(marketingRoot, 'advertising', 'assets', 'meta', '06-calm-plan-ar-story.png'), '1080x1920'],
  [join(marketingRoot, 'advertising', 'assets', 'display', '07-private-fr-landscape.png'), '1200x628'],
  [join(marketingRoot, 'mailing', 'assets', 'smartjib-email-header-1200x480.png'), '1200x480'],
]);
for (const [path, expected] of specialDimensions) {
  if (!existsSync(path)) fail(`Required delivery asset is missing: ${path}`);
  else if (dimensions(path) !== expected) fail(`${path} is ${dimensions(path)}; expected ${expected}.`);
}
if (deliveryCount === 39 && !errors.some((message) => message.includes('expected'))) {
  pass('All 39 delivery PNGs are present at their native dimensions');
}

for (const name of ['welcome-ar.html', 'launch-ar.html']) {
  const html = readFileSync(join(marketingRoot, 'mailing', 'templates', name), 'utf8');
  if (!/<html[^>]+dir="rtl"/i.test(html) || !/<body[^>]+dir="rtl"/i.test(html)) {
    fail(`${name} must declare RTL on both html and body.`);
  }
  if (!/font-family:Cairo/i.test(html)) fail(`${name} must use Cairo for Arabic email copy.`);
}
if (!errors.some((message) => message.includes('must declare RTL') || message.includes('Arabic email copy'))) {
  pass('Arabic email templates declare RTL and use Cairo throughout');
}

if (errors.length) {
  console.error(`\nMarketing validation failed with ${errors.length} issue${errors.length === 1 ? '' : 's'}:`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('\nMarketing kit validation passed.');
