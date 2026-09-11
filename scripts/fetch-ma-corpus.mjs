/**
 * Fetch a Moroccan product corpus from the Open * Facts public API.
 *
 * Why this exists: the product-knowledge tables (food families, additives,
 * cosmetic INCI identity) are curated by hand, and hand-curated tables rot
 * against the labels people actually scan. This script pulls a real,
 * dated snapshot of Moroccan products so the analysis can be audited against
 * them — how many get a rank, which ingredients go unrecognized, and where
 * the coverage gaps are.
 *
 * It needs outbound network access to world.openfoodfacts.org, so it is run
 * manually (not in CI):
 *
 *   node scripts/fetch-ma-corpus.mjs                          # OFF, 20 pages
 *   node scripts/fetch-ma-corpus.mjs --source=obf --pages=5   # cosmetics
 *   node scripts/fetch-ma-corpus.mjs --out=data/ma-corpus.json
 *
 * The output is a plain JSON array of raw source records — no transformation,
 * so the audit can be re-run offline against exactly what the source said.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const SOURCES = {
  off: {
    host: 'https://world.openfoodfacts.org',
    label: 'food',
  },
  obf: {
    host: 'https://world.openbeautyfacts.org',
    label: 'cosmetics',
  },
};

const FIELDS = [
  'code',
  'product_name',
  'brands',
  'categories',
  'categories_tags',
  'labels_tags',
  'ingredients_text',
  'allergens_tags',
  'nutriscore_grade',
  'nova_group',
  'quantity',
].join(',');

function arg(name, fallback) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((value) => value.startsWith(prefix));
  // A push-triggered run passes empty inputs; treat them as "use the default"
  // so the same command line works from a workflow and from a terminal.
  const value = hit ? hit.slice(prefix.length).trim() : '';
  return value || fallback;
}

const sourceKey = arg('source', 'off');
const pages = Number(arg('pages', '20'));
const out = resolve(process.cwd(), arg('out', `data/ma-corpus-${sourceKey}.json`));
const source = SOURCES[sourceKey];
if (!source) {
  console.error(`unknown source "${sourceKey}" (expected off or obf)`);
  process.exit(1);
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function getPage(page) {
  const url = `${source.host}/api/v2/search`
    + `?countries_tags_en=Morocco&page=${page}&page_size=100&fields=${encodeURIComponent(FIELDS)}`;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        // OFF asks integrators to identify themselves.
        'User-Agent': 'FlousyApp-ProductAudit/1.0 (product knowledge audit)',
        Accept: 'application/json',
      },
    });
    if (response.status === 429 || response.status >= 500) {
      await sleep(2_000 * attempt);
      continue;
    }
    if (!response.ok) throw new Error(`${sourceKey} page ${page}: HTTP ${response.status}`);
    return response.json();
  }
  throw new Error(`${sourceKey} page ${page}: gave up after retries`);
}

const byCode = new Map();
let total = 0;
for (let page = 1; page <= pages; page += 1) {
  const payload = await getPage(page);
  const products = payload.products ?? [];
  total = payload.count ?? total;
  for (const product of products) {
    if (!product?.code) continue;
    if (!byCode.has(product.code)) byCode.set(product.code, product);
  }
  process.stderr.write(`${sourceKey}: page ${page} → ${products.length} (unique ${byCode.size}/${total})\n`);
  if (products.length === 0) break;
  // Be a polite API citizen: the public instance is community-funded.
  await sleep(500);
}

const corpus = [...byCode.values()];
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify({
  source: sourceKey,
  fetchedAt: new Date().toISOString(),
  reportedTotal: total,
  count: corpus.length,
  products: corpus,
}, null, 1)}\n`);
console.log(`wrote ${corpus.length} ${source.label} products → ${out}`);
