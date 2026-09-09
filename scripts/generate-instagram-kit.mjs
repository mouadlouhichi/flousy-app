#!/usr/bin/env node
/**
 * Generates the original SmartJib Instagram launch kit under
 * marketing/instagram/. The generated PNGs are intentionally checked in so
 * they are ready to upload; this script is the reproducible source for future
 * refreshes. It only uses ImageMagick's `convert`/`montage` commands already
 * available in the Arena workspace.
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

const colors = {
  paper: '#F4F8F6',
  white: '#FFFFFF',
  ink: '#12211E',
  muted: '#58706A',
  line: '#C9DCD7',
  teal: '#00685F',
  tealBright: '#008378',
  tealMid: '#3E9D92',
  mint: '#89F5E7',
  mist: '#DDF7F1',
  sage: '#C6E6DF',
  coral: '#D9724D',
  coralPale: '#F9DED4',
  gold: '#E7B85D',
  goldPale: '#F8ECD1',
  savings: '#16785F',
};

const font = {
  regular: 'DejaVu-Sans',
  bold: 'DejaVu-Sans-Bold',
  mono: 'DejaVu-Sans-Mono',
  monoBold: 'DejaVu-Sans-Mono-Bold',
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

function canvas(width, height, background = colors.paper) {
  return ['-size', `${width}x${height}`, `xc:${background}`];
}

function draw(args, instruction, options = {}) {
  const { fill, stroke = 'none', width = 1 } = options;
  if (fill) args.push('-fill', fill);
  // ImageMagick 6 expects SVG-style path data to be quoted inside its -draw
  // mini-language. Keeping callers readable (`path M …`) avoids subtle shell
  // quoting issues and works when this script is invoked through execFileSync.
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
    size = 25,
    color = colors.muted,
    family = font.mono,
    gravity = 'NorthWest',
  } = options;
  args.push(
    '-font',
    family,
    '-pointsize',
    String(size),
    '-fill',
    color,
    // Drawing an icon leaves its stroke width in ImageMagick's image state.
    // Reset it before every annotation so later labels cannot turn into an
    // unreadable outlined blob.
    '-stroke',
    'none',
    '-strokewidth',
    '0',
    '-gravity',
    gravity,
    '-annotate',
    `+${x}+${y}`,
    text,
  );
}

function headline(args, lines, x, y, options = {}) {
  const {
    size = 96,
    color = colors.ink,
    family = font.bold,
    leading = 1.18,
  } = options;
  lines.forEach((text, index) => label(args, text, x, Math.round(y + index * size * leading), {
    size,
    color,
    family,
  }));
}

function logoOverlay(args, size, gravity = 'SouthEast', geometry = '+92+104') {
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

function footer(args, text = 'smartjib.app', color = colors.muted) {
  label(args, text, 92, 72, { size: 22, color, family: font.mono, gravity: 'SouthWest' });
}

function postBase(kicker, index, background = colors.paper) {
  const args = canvas(1080, 1350, background);
  label(args, `SMARTJIB  /  ${String(index).padStart(2, '0')}`, 82, 82, {
    size: 23,
    color: background === colors.teal || background === colors.ink ? colors.mint : colors.teal,
    family: font.monoBold,
  });
  label(args, kicker.toUpperCase(), 82, 120, {
    size: 19,
    color: background === colors.teal || background === colors.ink ? colors.sage : colors.muted,
  });
  return args;
}

function postFooter(args, background = colors.paper) {
  footer(args, 'smartjib.app', background === colors.teal || background === colors.ink ? colors.mist : colors.muted);
}

function storyBase(kicker, index, background = colors.paper) {
  const args = canvas(1080, 1920, background);
  label(args, `SMARTJIB  /  ${String(index).padStart(2, '0')}`, 86, 100, {
    size: 25,
    color: background === colors.teal || background === colors.ink ? colors.mint : colors.teal,
    family: font.monoBold,
  });
  label(args, kicker.toUpperCase(), 86, 142, {
    size: 20,
    color: background === colors.teal || background === colors.ink ? colors.sage : colors.muted,
  });
  return args;
}

function storyFooter(args, background = colors.paper) {
  label(args, 'smartjib.app', 86, 95, {
    size: 22,
    color: background === colors.teal || background === colors.ink ? colors.mist : colors.muted,
    family: font.mono,
    gravity: 'SouthWest',
  });
}

function createBrandAssets() {
  const brand = join(kitRoot, 'brand');
  directory(brand);
  cpSync(logo, join(brand, 'smartjib-logo-mark-transparent.png'));

  // High-resolution profile image: the wallet mark stays inside Instagram's
  // circular crop-safe area and remains legible at 40px.
  {
    const args = canvas(1080, 1080, colors.paper);
    circle(args, 540, 540, 510, colors.mist);
    circle(args, 540, 540, 438, colors.white);
    circle(args, 540, 540, 398, colors.teal);
    circle(args, 540, 540, 330, colors.tealBright);
    circle(args, 540, 540, 285, colors.mist);
    logoOverlay(args, 610, 'Center', '+0+16');
    im(pngPath('brand', 'smartjib-instagram-avatar-1080.png'), args);
  }

  // A transparent wordmark is useful for stories, media kits, and future post
  // variations. It uses the existing official mark rather than inventing a
  // second identity.
  {
    const args = canvas(1800, 600, 'none');
    roundedRect(args, 30, 75, 510, 555, 128, colors.mist);
    logoOverlay(args, 430, 'NorthWest', '+60+84');
    label(args, 'SmartJib', 585, 205, { size: 154, color: colors.teal, family: font.bold });
    label(args, 'BUDGET WITH PURPOSE', 596, 408, {
      size: 33,
      color: colors.muted,
      family: font.monoBold,
    });
    im(pngPath('brand', 'smartjib-horizontal-wordmark.png'), args);
  }

  {
    const args = canvas(1600, 900, colors.paper);
    roundedRect(args, 48, 48, 1552, 852, 52, colors.white, colors.line, 2);
    label(args, 'SMARTJIB / SOCIAL PALETTE', 100, 110, {
      size: 26,
      color: colors.teal,
      family: font.monoBold,
    });
    const swatches = [
      ['Deep teal', colors.teal],
      ['Bright teal', colors.tealBright],
      ['Mint', colors.mint],
      ['Paper', colors.paper],
      ['Ink', colors.ink],
      ['Coral', colors.coral],
    ];
    swatches.forEach(([name, color], index) => {
      const x = 100 + (index % 3) * 490;
      const y = 220 + Math.floor(index / 3) * 300;
      roundedRect(args, x, y, x + 410, y + 166, 28, color);
      label(args, name, x, y + 210, { size: 28, color: colors.ink, family: font.bold });
      label(args, color, x, y + 252, { size: 22, color: colors.muted, family: font.mono });
    });
    im(pngPath('brand', 'smartjib-social-palette.png'), args);
  }
}

function createHighlightCovers() {
  const covers = [
    { file: '01-start', title: 'START', icon: 'start' },
    { file: '02-budget', title: 'BUDGET', icon: 'budget' },
    { file: '03-places', title: 'PLACES', icon: 'places' },
    { file: '04-goals', title: 'GOALS', icon: 'goals' },
    { file: '05-private', title: 'PRIVATE', icon: 'private' },
    { file: '06-tour', title: 'TOUR', icon: 'tour' },
    { file: '07-tips', title: 'TIPS', icon: 'tips' },
    { file: '08-faq', title: 'FAQ', icon: 'faq' },
  ];

  function icon(args, kind) {
    const white = colors.white;
    const bright = colors.mint;
    if (kind === 'start') {
      circle(args, 540, 960, 132, 'none', white, 18);
      circle(args, 540, 960, 52, 'none', bright, 16);
      line(args, 500, 1003, 610, 892, white, 18);
      draw(args, 'polygon 604,890 606,946 550,890', { fill: white });
      return;
    }
    if (kind === 'budget') {
      roundedRect(args, 378, 872, 702, 1064, 42, 'none', white, 18);
      line(args, 380, 927, 700, 927, white, 18);
      roundedRect(args, 590, 942, 734, 1012, 28, bright);
      circle(args, 637, 977, 10, colors.teal);
      return;
    }
    if (kind === 'places') {
      [[402, 864], [402, 952], [402, 1040]].forEach(([x, y], index) => {
        roundedRect(args, x, y, 678, y + 58, 22, 'none', white, 14);
        circle(args, 640, y + 29, 9, index === 1 ? bright : white);
      });
      return;
    }
    if (kind === 'goals') {
      circle(args, 540, 960, 146, 'none', white, 18);
      circle(args, 540, 960, 88, 'none', bright, 18);
      circle(args, 540, 960, 28, white);
      line(args, 606, 895, 680, 820, white, 17);
      draw(args, 'polygon 674,818 676,868 626,818', { fill: white });
      return;
    }
    if (kind === 'private') {
      draw(args, 'path M 540,814 L 700,876 L 668,1060 L 540,1140 L 412,1060 L 380,876 Z', {
        fill: 'none', stroke: white, width: 18,
      });
      draw(args, 'path M 478,963 L 524,1009 L 616,911', { fill: 'none', stroke: bright, width: 22 });
      return;
    }
    if (kind === 'tour') {
      roundedRect(args, 430, 816, 650, 1104, 40, 'none', white, 18);
      roundedRect(args, 465, 870, 615, 1016, 16, bright);
      line(args, 508, 1061, 572, 1061, white, 14);
      return;
    }
    if (kind === 'tips') {
      circle(args, 540, 963, 76, 'none', white, 18);
      line(args, 486, 1036, 594, 1036, white, 18);
      line(args, 500, 1071, 580, 1071, bright, 16);
      [[540, 826, 540, 774], [410, 874, 370, 836], [670, 874, 710, 836], [407, 973, 352, 973], [673, 973, 728, 973]].forEach(
        ([x1, y1, x2, y2]) => line(args, x1, y1, x2, y2, white, 16),
      );
      return;
    }
    // FAQ is intentionally a single high-contrast glyph — it holds up best in
    // Instagram's tiny circular thumbnail.
    label(args, '?', 0, 108, { size: 270, color: white, family: font.bold, gravity: 'Center' });
  }

  covers.forEach((cover, index) => {
    const args = canvas(1080, 1920, colors.paper);
    circle(args, 540, 962, 486, colors.mist);
    circle(args, 540, 962, 360, colors.teal);
    circle(args, 540, 962, 310, colors.tealBright);
    label(args, `SMARTJIB / ${String(index + 1).padStart(2, '0')}`, 0, 165, {
      size: 24,
      color: colors.teal,
      family: font.monoBold,
      gravity: 'North',
    });
    icon(args, cover.icon);
    label(args, cover.title, 0, 230, {
      size: 31,
      color: colors.teal,
      family: font.monoBold,
      gravity: 'South',
    });
    im(pngPath('highlights', `${cover.file}-cover.png`), args);
  });
}

function createPosts() {
  // 01 — the launch hero
  {
    const args = postBase('Start here', 1, colors.paper);
    circle(args, 950, 146, 230, colors.mist);
    roundedRect(args, 64, 212, 1016, 1206, 56, colors.teal);
    headline(args, ['Your money,', 'on purpose.'], 98, 300, {
      size: 111,
      color: colors.white,
      leading: 1.18,
    });
    label(args, 'A calmer way to plan needs, wants,', 102, 620, {
      size: 30,
      color: colors.mist,
      family: font.regular,
    });
    label(args, 'and savings.', 102, 662, { size: 30, color: colors.mist, family: font.regular });
    roundedRect(args, 102, 818, 480, 900, 42, colors.tealBright);
    label(args, 'BUDGET WITH CLARITY', 135, 863, {
      size: 21,
      color: colors.white,
      family: font.monoBold,
    });
    circle(args, 806, 1008, 168, colors.mist);
    logoOverlay(args, 285, 'SouthEast', '+132+124');
    postFooter(args, colors.teal);
    im(pngPath('posts', '01-your-money-on-purpose.png'), args);
  }

  // 02 — educational 50/30/20 post
  {
    const args = postBase('Budget basics', 2, colors.paper);
    circle(args, 920, 265, 260, colors.goldPale);
    headline(args, ['Give your', 'money a plan.'], 82, 235, { size: 94, color: colors.ink });
    label(args, 'ONE SIMPLE STARTING POINT', 87, 513, {
      size: 21,
      color: colors.muted,
      family: font.monoBold,
    });
    roundedRect(args, 82, 602, 998, 1085, 42, colors.white, colors.line, 3);
    const rows = [
      ['NEEDS', '50%', colors.teal],
      ['WANTS', '30%', colors.coral],
      ['SAVINGS', '20%', colors.savings],
    ];
    rows.forEach(([name, amount, color], index) => {
      const y = 670 + index * 126;
      label(args, name, 132, y, { size: 23, color: colors.ink, family: font.monoBold });
      label(args, amount, 838, y, { size: 35, color: colors.ink, family: font.bold });
      roundedRect(args, 132, y + 48, 870, y + 72, 12, colors.mist);
      const length = index === 0 ? 369 : index === 1 ? 221 : 148;
      roundedRect(args, 132, y + 48, 132 + length, y + 72, 12, color);
    });
    label(args, 'Make it fit your life — not the other way around.', 86, 1158, {
      size: 25,
      color: colors.muted,
      family: font.regular,
    });
    postFooter(args);
    im(pngPath('posts', '02-give-your-money-a-plan.png'), args);
  }

  // 03 — three deliberately different envelopes
  {
    const args = postBase('The three buckets', 3, colors.ink);
    circle(args, 960, 180, 248, '#25413B');
    headline(args, ['Three buckets.', 'One clear view.'], 83, 250, {
      size: 88,
      color: colors.white,
    });
    const buckets = [
      ['Needs', 'The essentials.', colors.teal],
      ['Wants', 'The things you enjoy.', colors.coral],
      ['Savings', 'What future-you needs.', colors.savings],
    ];
    buckets.forEach(([title, description, color], index) => {
      const y = 585 + index * 172;
      roundedRect(args, 84, y, 996, y + 130, 34, color);
      circle(args, 144, y + 65, 19, colors.white);
      label(args, title, 192, y + 55, { size: 42, color: colors.white, family: font.bold });
      label(args, description, 192, y + 97, { size: 21, color: colors.white, family: font.regular });
    });
    postFooter(args, colors.ink);
    im(pngPath('posts', '03-three-buckets-one-clear-view.png'), args);
  }

  // 04 — the distinctive SmartJib positioning: purpose vs. place
  {
    const args = postBase('What makes SmartJib different', 4, colors.teal);
    circle(args, 947, 168, 230, colors.tealBright);
    headline(args, ['A budget answers', 'two questions.'], 84, 245, {
      size: 84,
      color: colors.white,
    });
    roundedRect(args, 84, 565, 996, 772, 38, colors.white);
    label(args, 'WHAT IS THIS MONEY FOR?', 128, 626, {
      size: 21,
      color: colors.muted,
      family: font.monoBold,
    });
    label(args, 'A need.', 128, 703, { size: 58, color: colors.teal, family: font.bold });
    circle(args, 900, 668, 42, colors.mist);
    roundedRect(args, 84, 812, 996, 1019, 38, colors.tealBright);
    label(args, 'WHERE IS THIS MONEY HELD?', 128, 874, {
      size: 21,
      color: colors.mist,
      family: font.monoBold,
    });
    label(args, 'In your wallet.', 128, 951, { size: 58, color: colors.white, family: font.bold });
    circle(args, 900, 915, 42, colors.mint);
    label(args, 'Purpose and place are not the same thing.', 87, 1110, {
      size: 26,
      color: colors.mist,
      family: font.regular,
    });
    postFooter(args, colors.teal);
    im(pngPath('posts', '04-purpose-and-place.png'), args);
  }

  // 05 — money-place feature
  {
    const args = postBase('Money places', 5, colors.paper);
    circle(args, 890, 218, 276, colors.mist);
    headline(args, ['Money can live', 'in more than', 'one place.'], 82, 220, {
      size: 80,
      color: colors.ink,
      leading: 1.1,
    });
    const cards = [
      ['BANK', 'Your account'],
      ['HOME', 'Cash at home'],
      ['WALLET', 'Money with you'],
    ];
    cards.forEach(([title, detail], index) => {
      const y = 605 + index * 151;
      roundedRect(args, 82, y, 998, y + 111, 31, index === 1 ? colors.mist : colors.white, colors.line, 2);
      circle(args, 141, y + 56, 17, index === 0 ? colors.teal : index === 1 ? colors.coral : colors.gold);
      label(args, title, 186, y + 52, { size: 29, color: colors.ink, family: font.monoBold });
      label(args, detail, 454, y + 53, { size: 23, color: colors.muted, family: font.regular });
    });
    label(args, 'See where your money is — without mixing up its purpose.', 85, 1110, {
      size: 25,
      color: colors.muted,
      family: font.regular,
    });
    postFooter(args);
    im(pngPath('posts', '05-money-places.png'), args);
  }

  // 06 — privacy / no bank connection feature
  {
    const args = postBase('Private by design', 6, colors.ink);
    circle(args, 878, 201, 250, '#25413B');
    headline(args, ['Track your', 'money.'], 84, 240, { size: 106, color: colors.white });
    headline(args, ['Keep control.'], 84, 484, { size: 88, color: colors.mint });
    roundedRect(args, 84, 700, 996, 1004, 42, '#1C3430', '#41655D', 2);
    draw(args, 'path M 225,765 L 355,816 L 329,969 L 225,1032 L 121,969 L 95,816 Z', {
      fill: 'none', stroke: colors.mint, width: 17,
    });
    draw(args, 'path M 177,897 L 215,935 L 296,847', { fill: 'none', stroke: colors.white, width: 20 });
    label(args, 'NO BANK CONNECTION', 428, 794, { size: 23, color: colors.mint, family: font.monoBold });
    label(args, 'You enter what matters.', 428, 876, { size: 38, color: colors.white, family: font.bold });
    label(args, 'A focused, manual budget tracker.', 428, 925, {
      size: 22,
      color: colors.sage,
      family: font.regular,
    });
    postFooter(args, colors.ink);
    im(pngPath('posts', '06-private-by-design.png'), args);
  }

  // 07 — concrete action, styled like an intentionally simplified app card
  {
    const args = postBase('Monthly reset', 7, colors.paper);
    circle(args, 960, 160, 225, colors.coralPale);
    headline(args, ['Give every', 'dirham a job.'], 82, 232, { size: 98, color: colors.ink });
    roundedRect(args, 82, 590, 998, 1096, 46, colors.white, colors.line, 3);
    label(args, 'YOUR MONTHLY PLAN', 130, 655, { size: 21, color: colors.muted, family: font.monoBold });
    label(args, 'Income', 130, 736, { size: 26, color: colors.ink, family: font.regular });
    label(args, '10,000 MAD', 710, 736, { size: 40, color: colors.ink, family: font.bold });
    line(args, 130, 785, 950, 785, colors.line, 2);
    [['Needs', '50%', colors.teal], ['Wants', '30%', colors.coral], ['Savings', '20%', colors.savings]].forEach(([name, percent, color], index) => {
      const y = 844 + index * 72;
      circle(args, 144, y, 11, color);
      label(args, name, 176, y + 9, { size: 26, color: colors.ink, family: font.regular });
      label(args, percent, 835, y + 9, { size: 27, color: colors.ink, family: font.bold });
    });
    roundedRect(args, 130, 1014, 951, 1057, 22, colors.mist);
    roundedRect(args, 130, 1014, 664, 1057, 22, colors.teal);
    label(args, 'Start with your real life, then adjust.', 86, 1174, {
      size: 25,
      color: colors.muted,
      family: font.regular,
    });
    postFooter(args);
    im(pngPath('posts', '07-give-every-dirham-a-job.png'), args);
  }

  // 08 — savings goal
  {
    const args = postBase('Savings goals', 8, colors.mist);
    circle(args, 922, 182, 255, colors.mint);
    headline(args, ['Save for what', 'matters to you.'], 82, 236, { size: 86, color: colors.ink });
    roundedRect(args, 82, 592, 998, 1077, 46, colors.teal);
    label(args, 'GOAL IN PROGRESS', 132, 664, { size: 21, color: colors.mint, family: font.monoBold });
    label(args, 'Your next chapter', 132, 760, { size: 47, color: colors.white, family: font.bold });
    label(args, '68% funded', 132, 833, { size: 30, color: colors.mist, family: font.regular });
    circle(args, 777, 822, 118, 'none', colors.mist, 22);
    draw(args, 'path M 777,704 A 118,118 0 1,1 684,894', { fill: 'none', stroke: colors.mint, width: 22 });
    label(args, '68%', 731, 839, { size: 43, color: colors.white, family: font.bold });
    roundedRect(args, 132, 942, 948, 974, 16, '#3C958A');
    roundedRect(args, 132, 942, 686, 974, 16, colors.mint);
    label(args, 'Small, visible progress changes the feeling of saving.', 86, 1154, {
      size: 25,
      color: colors.muted,
      family: font.regular,
    });
    postFooter(args);
    im(pngPath('posts', '08-save-for-what-matters.png'), args);
  }

  // 09 — localization and CTA
  {
    const args = postBase('Built for your language', 9, colors.tealBright);
    circle(args, 945, 168, 234, colors.teal);
    headline(args, ['Budget in the', 'language that', 'feels natural.'], 84, 230, {
      size: 77,
      color: colors.white,
      leading: 1.09,
    });
    // Short language codes stay clear at feed size and avoid relying on a
    // rasterizer's Arabic shaping support. The accompanying caption carries
    // the full English / Français / العربية wording.
    const chips = [
      ['EN', 84, colors.white, colors.teal, 78],
      ['FR', 368, colors.mist, colors.teal, 78],
      ['AR', 652, colors.mint, colors.teal, 78],
    ];
    chips.forEach(([text, x, fill, textColor, textOffset]) => {
      roundedRect(args, x, 708, x + 244, 794, 43, fill);
      label(args, text, x + textOffset, 762, { size: 31, color: textColor, family: font.bold });
    });
    roundedRect(args, 84, 905, 996, 1108, 38, colors.teal);
    label(args, 'START WITH A CLEAR VIEW', 132, 973, { size: 23, color: colors.mint, family: font.monoBold });
    label(args, 'One budget. Your way.', 132, 1056, { size: 51, color: colors.white, family: font.bold });
    postFooter(args, colors.tealBright);
    im(pngPath('posts', '09-budget-in-your-language.png'), args);
  }
}

function createStories() {
  // Story 01: welcome / Start highlight
  {
    const args = storyBase('Welcome', 1, colors.teal);
    circle(args, 884, 344, 310, colors.tealBright);
    headline(args, ['Welcome to', 'SmartJib.'], 86, 334, { size: 108, color: colors.white });
    label(args, 'A clearer, calmer way to plan your money.', 91, 631, {
      size: 33,
      color: colors.mist,
      family: font.regular,
    });
    roundedRect(args, 86, 840, 994, 1428, 58, colors.mist);
    circle(args, 540, 1135, 246, colors.white);
    logoOverlay(args, 450, 'Center', '+0+175');
    label(args, 'NEEDS  •  WANTS  •  SAVINGS', 0, 241, {
      size: 23,
      color: colors.teal,
      family: font.monoBold,
      gravity: 'South',
    });
    storyFooter(args, colors.teal);
    im(pngPath('stories', '01-welcome-to-smartjib.png'), args);
  }

  // Story 02: Budget highlight
  {
    const args = storyBase('Budget basics', 2, colors.paper);
    circle(args, 938, 293, 252, colors.goldPale);
    headline(args, ['A budget can', 'start simply.'], 86, 347, { size: 94, color: colors.ink });
    const rows = [['Needs', '50%', colors.teal], ['Wants', '30%', colors.coral], ['Savings', '20%', colors.savings]];
    rows.forEach(([name, amount, color], index) => {
      const y = 800 + index * 179;
      roundedRect(args, 86, y, 994, y + 135, 37, colors.white, colors.line, 2);
      circle(args, 150, y + 67, 19, color);
      label(args, name, 197, y + 70, { size: 39, color: colors.ink, family: font.bold });
      label(args, amount, 831, y + 70, { size: 38, color: colors.ink, family: font.bold });
    });
    label(args, 'Use a split as a starting point — then make it yours.', 88, 1466, {
      size: 28,
      color: colors.muted,
      family: font.regular,
    });
    storyFooter(args);
    im(pngPath('stories', '02-three-buckets.png'), args);
  }

  // Story 03: Places highlight
  {
    const args = storyBase('Money places', 3, colors.mist);
    headline(args, ['One budget.', 'Three places.'], 86, 350, { size: 102, color: colors.ink });
    const cards = [['BANK', colors.teal], ['HOME', colors.coral], ['WALLET', colors.gold]];
    cards.forEach(([title, color], index) => {
      const x = 86 + index * 310;
      roundedRect(args, x, 846, x + 274, 1165, 38, colors.white);
      circle(args, x + 59, 918, 19, color);
      label(args, title, x + 36, 1024, { size: 29, color: colors.ink, family: font.monoBold });
      label(args, index === 0 ? 'Your account' : index === 1 ? 'Cash at home' : 'With you', x + 36, 1080, {
        size: 20,
        color: colors.muted,
        family: font.regular,
      });
    });
    label(args, 'Track where money is held without losing sight of what it is for.', 88, 1328, {
      size: 29,
      color: colors.muted,
      family: font.regular,
    });
    storyFooter(args);
    im(pngPath('stories', '03-money-places.png'), args);
  }

  // Story 04: Private highlight
  {
    const args = storyBase('Private by design', 4, colors.ink);
    headline(args, ['A focused way', 'to track money.'], 86, 346, { size: 94, color: colors.white });
    roundedRect(args, 86, 798, 994, 1378, 58, '#1C3430', '#41655D', 2);
    draw(args, 'path M 540,878 L 722,946 L 684,1160 L 540,1251 L 396,1160 L 358,946 Z', {
      fill: 'none', stroke: colors.mint, width: 22,
    });
    draw(args, 'path M 468,1040 L 523,1095 L 635,983', { fill: 'none', stroke: colors.white, width: 25 });
    label(args, 'NO BANK CONNECTION', 0, 1482, { size: 24, color: colors.mint, family: font.monoBold, gravity: 'North' });
    label(args, 'You add what matters. You stay in control.', 0, 1552, {
      size: 29,
      color: colors.sage,
      family: font.regular,
      gravity: 'North',
    });
    storyFooter(args, colors.ink);
    im(pngPath('stories', '04-private-by-design.png'), args);
  }

  // Story 05: FAQ prompt. The operator adds Instagram's native Question sticker.
  {
    const args = storyBase('Ask us anything', 5, colors.tealBright);
    circle(args, 901, 300, 260, colors.teal);
    headline(args, ['What would make', 'budgeting feel', 'easier?'], 86, 340, {
      size: 82,
      color: colors.white,
      leading: 1.12,
    });
    roundedRect(args, 86, 950, 994, 1268, 52, colors.white);
    label(args, 'YOUR BUDGET QUESTION', 130, 1030, { size: 22, color: colors.muted, family: font.monoBold });
    label(args, 'Tap the Question sticker', 130, 1130, { size: 43, color: colors.teal, family: font.bold });
    label(args, 'and tell us what you want to solve.', 130, 1182, {
      size: 25,
      color: colors.muted,
      family: font.regular,
    });
    label(args, 'ADD INSTAGRAM QUESTION STICKER HERE', 0, 1372, {
      size: 21,
      color: colors.mint,
      family: font.monoBold,
      gravity: 'North',
    });
    storyFooter(args, colors.tealBright);
    im(pngPath('stories', '05-ask-a-budget-question.png'), args);
  }

  // Story 06: Goals highlight
  {
    const args = storyBase('Savings goals', 6, colors.mist);
    circle(args, 923, 300, 278, colors.mint);
    headline(args, ['Save for the', 'life you are', 'building.'], 86, 335, {
      size: 91,
      color: colors.ink,
      leading: 1.1,
    });
    roundedRect(args, 86, 951, 994, 1325, 56, colors.teal);
    label(args, 'START WITH ONE GOAL', 137, 1035, { size: 23, color: colors.mint, family: font.monoBold });
    label(args, 'Name it.', 137, 1138, { size: 50, color: colors.white, family: font.bold });
    label(args, 'Choose a next amount.', 137, 1210, { size: 34, color: colors.mist, family: font.regular });
    circle(args, 796, 1145, 96, 'none', colors.mist, 20);
    circle(args, 796, 1145, 58, 'none', colors.mint, 17);
    circle(args, 796, 1145, 17, colors.white);
    storyFooter(args);
    im(pngPath('stories', '06-savings-goals.png'), args);
  }

  // Story 07: Tour highlight
  {
    const args = storyBase('App tour', 7, colors.paper);
    circle(args, 918, 300, 280, colors.mist);
    headline(args, ['A clearer view', 'in a few taps.'], 86, 354, { size: 94, color: colors.ink });
    roundedRect(args, 300, 790, 780, 1395, 62, colors.teal);
    roundedRect(args, 332, 855, 748, 1273, 35, colors.white);
    label(args, 'SEPTEMBER PLAN', 370, 923, { size: 20, color: colors.muted, family: font.monoBold });
    label(args, '10,000 MAD', 370, 1006, { size: 46, color: colors.ink, family: font.bold });
    [['Needs', colors.teal], ['Wants', colors.coral], ['Savings', colors.savings]].forEach(([name, color], index) => {
      const y = 1081 + index * 52;
      circle(args, 386, y, 9, color);
      label(args, name, 410, y + 9, { size: 22, color: colors.ink, family: font.regular });
    });
    roundedRect(args, 462, 1320, 618, 1350, 15, colors.mint);
    label(args, 'Want the walkthrough? Tap through the Tour Highlight.', 0, 1508, {
      size: 28,
      color: colors.muted,
      family: font.regular,
      gravity: 'North',
    });
    storyFooter(args);
    im(pngPath('stories', '07-app-tour.png'), args);
  }

  // Story 08: Tips highlight
  {
    const args = storyBase('Small budget tip', 8, colors.teal);
    circle(args, 903, 316, 278, colors.tealBright);
    headline(args, ['Plan the next', 'step — not the', 'perfect month.'], 86, 350, {
      size: 84,
      color: colors.white,
      leading: 1.12,
    });
    roundedRect(args, 86, 1004, 994, 1336, 54, colors.white);
    label(args, 'A KINDER RESET', 136, 1085, { size: 22, color: colors.teal, family: font.monoBold });
    label(args, 'Look at the numbers.', 136, 1172, { size: 40, color: colors.ink, family: font.bold });
    label(args, 'Make one helpful adjustment.', 136, 1237, { size: 29, color: colors.muted, family: font.regular });
    label(args, 'Save this for the next time a budget feels heavy.', 0, 1474, {
      size: 28,
      color: colors.mist,
      family: font.regular,
      gravity: 'North',
    });
    storyFooter(args, colors.teal);
    im(pngPath('stories', '08-budget-tip.png'), args);
  }
}

function createReelCovers() {
  {
    const args = storyBase('Reel cover', 1, colors.paper);
    circle(args, 900, 294, 280, colors.mist);
    headline(args, ['Give every', 'dirham a job.'], 86, 366, { size: 105, color: colors.ink });
    roundedRect(args, 86, 884, 994, 1294, 52, colors.teal);
    label(args, 'IN 30 SECONDS', 137, 962, { size: 22, color: colors.mint, family: font.monoBold });
    label(args, 'A simple monthly', 137, 1072, { size: 57, color: colors.white, family: font.bold });
    label(args, 'budget reset.', 137, 1140, { size: 57, color: colors.white, family: font.bold });
    circle(args, 793, 1094, 111, colors.mist);
    draw(args, 'polygon 765,1038 765,1150 865,1094', { fill: colors.teal });
    storyFooter(args);
    im(pngPath('reels', '01-give-every-dirham-a-job-cover.png'), args);
  }

  {
    const args = storyBase('Reel cover', 2, colors.ink);
    circle(args, 903, 302, 278, '#25413B');
    headline(args, ['Budgeting', 'is not a', 'punishment.'], 86, 352, {
      size: 99,
      color: colors.white,
      leading: 1.1,
    });
    roundedRect(args, 86, 932, 994, 1302, 52, '#1C3430', '#41655D', 2);
    label(args, 'IT IS A CHOICE TOOL', 137, 1010, { size: 22, color: colors.mint, family: font.monoBold });
    label(args, 'Here is the mindset', 137, 1110, { size: 49, color: colors.white, family: font.bold });
    label(args, 'shift that helps.', 137, 1171, { size: 49, color: colors.white, family: font.bold });
    storyFooter(args, colors.ink);
    im(pngPath('reels', '02-budgeting-is-not-a-punishment-cover.png'), args);
  }

  {
    const args = storyBase('Reel cover', 3, colors.tealBright);
    circle(args, 902, 301, 272, colors.teal);
    headline(args, ['Why no bank', 'connection?'], 86, 362, { size: 103, color: colors.white });
    roundedRect(args, 86, 886, 994, 1302, 52, colors.white);
    draw(args, 'path M 236,965 L 365,1015 L 339,1169 L 236,1230 L 133,1169 L 107,1015 Z', {
      fill: 'none', stroke: colors.teal, width: 18,
    });
    draw(args, 'path M 187,1091 L 226,1130 L 303,1053', { fill: 'none', stroke: colors.tealBright, width: 20 });
    label(args, 'A focused tracker', 427, 1043, { size: 47, color: colors.teal, family: font.bold });
    label(args, 'for the money you enter.', 427, 1108, { size: 28, color: colors.muted, family: font.regular });
    storyFooter(args, colors.tealBright);
    im(pngPath('reels', '03-why-no-bank-connection-cover.png'), args);
  }
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
  montage(grid, postFiles, ['-tile', '3x3', '-geometry', '360x450+0+0', '-background', colors.paper]);

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
    '-background', colors.paper,
  ]);

  // A concise profile mock-up lets the operator approve the asset system
  // without manually opening twenty individual files.
  {
    const avatar = join(kitRoot, 'brand', 'smartjib-instagram-avatar-1080.png');
    const args = canvas(1080, 2120, colors.white);
    args.push('(', avatar, '-resize', '182x182', ')', '-gravity', 'NorthWest', '-geometry', '+76+74', '-composite');
    label(args, 'smartjib.app', 298, 122, { size: 41, color: colors.ink, family: font.bold });
    label(args, 'Budget & Money Tracker', 298, 175, { size: 23, color: colors.muted, family: font.regular });
    label(args, 'Budget with purpose, not pressure.  Needs • wants • savings', 76, 308, {
      size: 24,
      color: colors.ink,
      family: font.regular,
    });
    label(args, 'No bank connection • 12 currencies', 76, 350, { size: 24, color: colors.ink, family: font.regular });
    label(args, 'smartjib.app', 76, 393, { size: 24, color: colors.teal, family: font.bold });
    label(args, 'START', 108, 600, { size: 17, color: colors.ink, family: font.monoBold, gravity: 'North' });
    label(args, 'BUDGET', 330, 600, { size: 17, color: colors.ink, family: font.monoBold, gravity: 'North' });
    label(args, 'PLACES', 551, 600, { size: 17, color: colors.ink, family: font.monoBold, gravity: 'North' });
    label(args, 'GOALS', 772, 600, { size: 17, color: colors.ink, family: font.monoBold, gravity: 'North' });
    highlightFiles.slice(0, 4).forEach((file, index) => {
      args.push('(', file, '-resize', '164x292', ')', '-gravity', 'NorthWest', '-geometry', `+${58 + index * 242}+418`, '-composite');
    });
    args.push('(', grid, '-resize', '1080x1350', ')', '-gravity', 'South', '-geometry', '+0+0', '-composite');
    im(pngPath('previews', 'smartjib-instagram-profile-preview.png'), args);
  }
}

function main() {
  if (!existsSync(logo)) {
    throw new Error(`Official SmartJib logo not found: ${logo}`);
  }
  // Only remove generated image directories. Documentation and editable source
  // files in marketing/instagram are left intact when the kit is regenerated.
  ['brand', 'highlights', 'posts', 'stories', 'reels', 'previews'].forEach((folder) => {
    rmSync(join(kitRoot, folder), { recursive: true, force: true });
  });
  createBrandAssets();
  createHighlightCovers();
  createPosts();
  createStories();
  createReelCovers();
  createPreviews();
  console.log(`Instagram launch kit generated in ${kitRoot}`);
}

main();
