/**
 * Split a harvested corpus into parts small enough to move through channels
 * with a size ceiling (the gist API only returns files inline below ~1 MB).
 *
 *   node scripts/split-corpus.mjs data/ma-corpus-off.json --per=400
 *
 * Writes data/parts/part-0.json … preserving the corpus metadata on every
 * part so any part can be audited on its own.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const input = resolve(process.cwd(), process.argv[2] ?? 'data/ma-corpus-off.json');
const perArg = process.argv.find((value) => value.startsWith('--per='));
const per = Number(perArg ? perArg.slice('--per='.length) : 400);

const corpus = JSON.parse(readFileSync(input, 'utf8'));
const products = corpus.products ?? [];
const outDir = resolve(dirname(input), 'parts');
mkdirSync(outDir, { recursive: true });

let parts = 0;
for (let index = 0; index < products.length; index += per) {
  const slice = products.slice(index, index + per);
  const part = { ...corpus, count: slice.length, products: slice };
  const out = resolve(outDir, `part-${parts}.json`);
  writeFileSync(out, JSON.stringify(part));
  console.log(`part-${parts}.json: ${slice.length} products, ${JSON.stringify(part).length} bytes`);
  parts += 1;
}
console.log(`${parts} part(s) → ${outDir}`);
