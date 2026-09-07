#!/usr/bin/env node
/**
 * Fetch the official EU CosIng "Ingredients & Fragrance Inventory" export and
 * rebuild data/cosing/cosing-ingredients.tsv (same schema as the committed
 * snapshot — see data/cosing/README.md).
 *
 * The official download endpoints have moved around over the years (legacy
 * ec.europa.eu → single-market-economy.ec.europa.eu → data.europa.eu), so this
 * script tries a list of candidate URLs in order and stops at the first 200.
 * None of them are reachable from the sandboxed CI network; run it on a
 * machine with general internet access.
 *
 * Usage:
 *   node scripts/fetch-cosing.mjs            # fetch + rewrite the TSV
 *   node scripts/fetch-cosing.mjs --dry-run  # validate the download only
 *
 * Output format (tab-separated, header first):
 *   inci\tcas\tec\tfunctions\trestriction
 */

import { createWriteStream, mkdirSync } from 'node:fs';
import { get } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';

const CANDIDATE_URLS = [
  // Current EU portal export (single-market-economy) — best guess of the
  // stable URL; update it if the portal relocates again.
  'https://single-market-economy.ec.europa.eu/sites/default/files/COSING_Ingredients-Fragrance%20Inventory_v2.csv',
  // Legacy growth/tools-databases URL (redirects on the old site).
  'https://ec.europa.eu/growth/tools-databases/cosing/pdf/COSING_Ingredients-Fragrance%20Inventory_v2.csv',
  // data.europa.eu dataset: "Cosmetic ingredient database (Cosing) —
  // Ingredients and fragrance inventory".
  'https://data.europa.eu/api/hub/store/data/csv/6266d54b-0e2c-4d7e-97aa-f34727c9224f.csv',
];

const OUT = join(process.cwd(), 'data', 'cosing', 'cosing-ingredients.tsv');
const DRY_RUN = process.argv.includes('--dry-run');

function download(url) {
  return new Promise((resolve, reject) => {
    get(url, { headers: { 'User-Agent': 'SmartJib cosing refresh' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        resolve(download(res.headers.location));
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      resolve(res);
    }).on('error', reject);
  });
}

/** Official export preamble/headers are not stable across vintages: find the
 *  row that starts with the reference column ("COSING Ref No"). */
function findHeader(lines) {
  const idx = lines.findIndex((l) => /^"?\s*COSING\s+Ref/i.test(l.trim()));
  if (idx === -1) throw new Error('could not locate the "COSING Ref No" header row');
  return idx;
}

function cell(value) {
  return String(value ?? '').replace(/^"|"$/g, '').replace(/\s*\n\s*/g, ' ').trim();
}

function fold(name) {
  // Simplified key fold for dedupe (kept in sync with the TS loader's rules:
  // uppercase, non-alphanumeric → space, "C I 77491" → "CI 77491").
  let s = cell(name).toUpperCase().replace(/[^A-Z0-9]+/g, ' ');
  s = s.replace(/\bC I(?=\s*\d)/g, 'CI');
  return s.trim().replace(/\s+/g, ' ');
}

async function main() {
  let stream = null;
  let sourceUrl = '';
  for (const url of CANDIDATE_URLS) {
    try {
      stream = await download(url);
      sourceUrl = url;
      console.error(`downloaded from ${url}`);
      break;
    } catch (error) {
      console.error(`- ${url}: ${error.message}`);
    }
  }
  if (!stream) {
    console.error(
      '\nNo official endpoint was reachable (sandbox/CI networks block the EC portal).\n' +
        'Options: run this script on a machine with internet, or refresh manually —\n' +
        'see data/cosing/README.md (mirror-based steps). The committed snapshot was left untouched.',
    );
    process.exit(1);
  }

  const tmp = join(tmpdir(), 'cosing-raw.csv');
  await pipeline(stream, createWriteStream(tmp));

  const fs = await import('node:fs/promises');
  const text = await fs.readFile(tmp, 'utf8');
  const lines = text.split(/\r?\n/);
  const headerIdx = findHeader(lines);
  const rows = lines.slice(headerIdx + 1).filter((l) => l.trim());

  // Column order of the official export (documented above the table in the
  // CosIng portal): ref | inci | inn | pheur | cas | ec | chem | restr | func.
  const best = new Map();
  for (const line of rows) {
    const c = line.split('\t').length > 1 ? line.split('\t') : line.split(',');
    if (c.length < 8) continue;
    const inci = cell(c[1]);
    if (!inci) continue;
    const rec = {
      inci,
      cas: cell(c[4]),
      ec: cell(c[5]),
      restriction: cell(c[7]),
      functions: cell(c[8] ?? ''),
    };
    const key = fold(inci);
    const existing = best.get(key);
    if (!existing) {
      best.set(key, rec);
    } else {
      // Prefer the variant carrying the richest restriction/function text.
      if (!existing.restriction && rec.restriction) existing.restriction = rec.restriction;
      if (!existing.cas && rec.cas) existing.cas = rec.cas;
      if (!existing.functions && rec.functions) existing.functions = rec.functions;
    }
  }

  const sorted = [...best.values()].sort((a, b) => a.inci.localeCompare(b.inci));
  const out = ['inci\tcas\tec\tfunctions\trestriction'];
  for (const r of sorted) {
    out.push([r.inci, r.cas, r.ec, r.functions, r.restriction].join('\t'));
  }

  if (DRY_RUN) {
    console.log(`OK: ${sorted.length} unique ingredients parsed (dry run, file untouched).`);
    return;
  }

  mkdirSync(join(process.cwd(), 'data', 'cosing'), { recursive: true });
  await fs.writeFile(OUT, out.join('\n') + '\n', 'utf8');
  console.log(`wrote ${OUT}: ${sorted.length} rows`);
  console.log(
    'Next: bump the `snapshot` string in src/lib/ingredient-safety/dataset.ts, then run npm run check.',
  );
}

main().catch((error) => {
  console.error(`fetch-cosing failed: ${error.message}`);
  process.exit(1);
});