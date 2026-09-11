/**
 * Audit the Moroccan product corpus against the app's own knowledge engine.
 *
 * Reads the raw source snapshot written by `scripts/fetch-ma-corpus.mjs` and
 * runs every product through exactly the functions the UI calls, so the
 * numbers below are the numbers a shopper would see — not a re-implementation
 * of them.
 *
 *   npx tsx scripts/audit-ma-corpus.mts --in=data/ma-corpus-off.json
 *
 * Output: a summary on stdout plus `data/ma-corpus-audit.json` holding every
 * unrecognized ingredient name ranked by how many products it blocks, which
 * is the work list for extending the curated tables.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyzeFoodText } from '../src/lib/food-knowledge/analyze';
import { detectLabelDomain, detectFoodKind } from '../src/lib/food-knowledge/domain';
import { foodLabelGrade } from '../src/lib/food-knowledge/grade';
import { analyzeInciText } from '../src/lib/ingredient-safety/analyze';
import { inferProductForm } from '../src/lib/ingredient-safety/form';
import type { ProductDomain } from '../src/lib/store';

interface SourceProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  categories?: string;
  categories_tags?: string[];
  ingredients_text?: string;
  allergens_tags?: string[];
  nutriscore_grade?: string;
  nova_group?: number;
}

function arg(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  const hit = process.argv.find((value) => value.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

const inputPath = resolve(process.cwd(), arg('in', 'data/ma-corpus-off.json'));
const corpus = JSON.parse(readFileSync(inputPath, 'utf8')) as {
  source: string;
  fetchedAt: string;
  reportedTotal: number;
  count: number;
  products: SourceProduct[];
};

const unknownCounts = new Map<string, number>();
const buckets = new Map<string, number>();
const coverageBuckets = { full: 0, partial: 0, limited: 0, none: 0 };
const bandCounts = new Map<string, number>();
const cosmeticStatus = new Map<string, number>();
let ranked = 0;
let scored = 0;
let noIngredients = 0;
let cosmetic = 0;
const examples = new Map<string, string[]>();

const bump = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);
const remember = (key: string, code: string) => {
  const list = examples.get(key) ?? [];
  if (list.length < 5) list.push(code);
  examples.set(key, list);
};

for (const product of corpus.products) {
  const code = product.code ?? '?';
  const name = product.product_name?.trim() || product.brands?.trim() || '';
  const category = product.categories?.split(',')[0]?.trim() || '';
  const text = product.ingredients_text?.trim() ?? '';
  bump(buckets, 'total');

  if (!text) {
    noIngredients += 1;
    bump(buckets, 'no-ingredient-text');
    continue;
  }
  bump(buckets, 'has-ingredient-text');

  const domain: ProductDomain = detectLabelDomain({ name, category, ingredientsText: text });
  bump(buckets, `domain:${domain}`);

  if (domain === 'cosmetic') {
    cosmetic += 1;
    const form = inferProductForm(category, name);
    const result = analyzeInciText(text, { form, category, label: name });
    bump(cosmeticStatus, result.scoreStatus);
    if (result.score === null) {
      bump(buckets, 'cosmetic-withheld');
      remember(`cosmetic:${result.scoreStatus}`, code);
    } else {
      bump(buckets, 'cosmetic-scored');
    }
    for (const row of result.ingredients) {
      if (row.matched) continue;
      const key = row.raw.trim().toLowerCase().slice(0, 60);
      if (!key) continue;
      bump(unknownCounts, `inci:${key}`);
      remember(`inci:${key}`, code);
    }
    continue;
  }

  if (domain !== 'food' && domain !== 'unknown') {
    bump(buckets, 'out-of-scope');
    continue;
  }

  const analysis = analyzeFoodText(text, {
    ...(name ? { label: name } : {}),
    ...(category ? { category } : {}),
    ...(product.allergens_tags?.length ? { offAllergenTags: product.allergen_tags } : {}),
  });
  const grade = foodLabelGrade(analysis);
  ranked += 1;

  if (analysis.coverage >= 0.999) coverageBuckets.full += 1;
  else if (analysis.coverage >= 0.7) coverageBuckets.partial += 1;
  else if (analysis.coverage > 0) coverageBuckets.limited += 1;
  else coverageBuckets.none += 1;

  if (!grade) {
    const why = analysis.kind === 'water'
      ? 'water'
      : analysis.recognized === 0
        ? 'nothing-recognized'
        : 'unknown';
    bump(buckets, `food-unranked:${why}`);
    remember(`food-unranked:${why}`, code);
  } else {
    scored += 1;
    bump(bandCounts, grade.band);
  }

  for (const ingredient of analysis.ingredients) {
    if (ingredient.family && ingredient.family !== 'other') continue;
    const key = ingredient.raw.trim().toLowerCase().slice(0, 60);
    if (!key) continue;
    bump(unknownCounts, `food:${key}`);
    remember(`food:${key}`, code);
  }

  if (detectFoodKind({ name, category, ingredientsText: text }) === 'water') {
    bump(buckets, 'kind:water');
  }
}

const rankedUnknowns = [...unknownCounts.entries()]
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  .map(([name, count]) => ({ name, count, examples: examples.get(name) ?? [] }));

const report = {
  input: inputPath,
  source: corpus.source,
  fetchedAt: corpus.fetchedAt,
  reportedTotal: corpus.reportedTotal,
  corpusSize: corpus.count,
  buckets: Object.fromEntries([...buckets.entries()].sort()),
  ranked,
  scored,
  unrankedFood: ranked - scored,
  noIngredients,
  cosmetic,
  coverage: coverageBuckets,
  bands: Object.fromEntries([...bandCounts.entries()].sort()),
  cosmeticStatus: Object.fromEntries([...cosmeticStatus.entries()].sort()),
  topUnknowns: rankedUnknowns.slice(0, 200),
};

const outPath = resolve(process.cwd(), arg('out', 'data/ma-corpus-audit.json'));
writeFileSync(outPath, `${JSON.stringify(report, null, 1)}\n`);

const pct = (value: number, base: number) => `${((value / base) * 100).toFixed(1)}%`;
console.log(`corpus            ${corpus.count} products (source reports ${corpus.reportedTotal})`);
console.log(`with ingredients  ${corpus.count - noIngredients} (${pct(corpus.count - noIngredients, corpus.count)})`);
console.log(`food analyzed     ${ranked}`);
console.log(`food ranked       ${scored} (${pct(scored, ranked || 1)} of analyzed, ${pct(scored, corpus.count || 1)} of corpus)`);
console.log(`coverage          full ${coverageBuckets.full} · partial ${coverageBuckets.partial} · limited ${coverageBuckets.limited} · none ${coverageBuckets.none}`);
console.log(`bands             ${[...bandCounts.entries()].map(([k, v]) => `${k} ${v}`).join(' · ')}`);
console.log(`cosmetic          ${cosmetic} → ${[...cosmeticStatus.entries()].map(([k, v]) => `${k} ${v}`).join(' · ')}`);
console.log(`\ntop unrecognized ingredient names:`);
for (const row of rankedUnknowns.slice(0, 40)) {
  console.log(`  ${String(row.count).padStart(4)}  ${row.name}`);
}
console.log(`\nfull report → ${outPath}`);
