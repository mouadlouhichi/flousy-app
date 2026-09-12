#!/usr/bin/env node
/**
 * Release guard for the ingredient-risk ("risk bank") datasets.
 *
 * Why this exists: `/api/inci/analyze` opens the local EU corpora with
 * `readFileSync` at request time. On Vercel/standalone only *traced* files are
 * deployed, and the earlier tracing list covered one of the three files — so a
 * deployment could build, deploy, and then answer 503 `dataset unavailable`
 * for every scan without a single test failing. This script closes that gap by
 * checking the three things that must stay true for the feature to work:
 *
 *   1. every dataset the loader opens exists and parses at the expected size;
 *   2. the loader actually builds a usable index (rows, glossary coverage);
 *   3. `next.config.mjs` traces every filesystem path the loader touches.
 *
 * It is wired into `npm run check`, so CI and a local release both fail here
 * rather than in production.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const problems = [];

function fail(message) {
  problems.push(message);
}

// --- 1 + 2: load the datasets exactly the way the production route does -----

// The loader is TypeScript with extension-less imports, so it must be run
// through the repo's tsx loader rather than bare node.
const tsxBin = join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const tsx = existsSync(tsxBin)
  ? [tsxBin]
  : [process.execPath, join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs')];

let dataset;
try {
  const out = execFileSync(
    tsx[0],
    [
      ...tsx.slice(1),
      '--eval',
      [
        "import { loadCosingDataset } from './src/lib/ingredient-safety/dataset.ts';",
        "import { regulatoryDatasetStats } from './src/lib/ingredient-safety/regulatory.ts';",
        'const d = loadCosingDataset();',
        'const r = regulatoryDatasetStats();',
        'console.log(JSON.stringify({',
        '  rows: d.meta.rows, inventoryRows: d.meta.inventoryRows, glossaryRows: d.meta.glossaryRows,',
        '  version: d.meta.version, snapshot: d.meta.snapshot,',
        '  annexRecords: r.records, annexNames: r.indexedNames, annexVersion: r.version',
        '}));',
      ].join('\n'),
    ],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  dataset = JSON.parse(out.trim().split('\n').pop());
} catch (error) {
  const detail = (error.stderr ?? error.message ?? '').toString().trim().slice(0, 600);
  fail(`could not load the ingredient datasets from src/lib/ingredient-safety: ${detail}`);
}

if (dataset) {
  // Thresholds are intentionally far below the current corpus (30k+ glossary
  // names, 2.3k annex records): they catch a truncated or empty commit, not a
  // legitimate refresh. Raise them if the corpora ever shrink on purpose.
  if (!(dataset.glossaryRows > 20_000)) {
    fail(`EU INCI glossary looks truncated: ${dataset.glossaryRows} rows (expected > 20000)`);
  }
  if (!(dataset.inventoryRows > 20_000)) {
    fail(`CosIng inventory looks truncated: ${dataset.inventoryRows} rows (expected > 20000)`);
  }
  if (!(dataset.rows > 25_000)) {
    fail(`merged identity index looks truncated: ${dataset.rows} rows (expected > 25000)`);
  }
  if (!(dataset.annexRecords > 1_000)) {
    fail(`EU annex corpus looks truncated: ${dataset.annexRecords} records (expected > 1000)`);
  }
  if (!(dataset.annexNames > 500)) {
    fail(`EU annex name index looks truncated: ${dataset.annexNames} names (expected > 500)`);
  }
  console.log(
    `  ingredient datasets: ${dataset.rows.toLocaleString()} identity rows ` +
    `(${dataset.glossaryRows.toLocaleString()} glossary + ${dataset.inventoryRows.toLocaleString()} inventory), ` +
    `${dataset.annexRecords.toLocaleString()} annex records / ${dataset.annexNames.toLocaleString()} indexed names`,
  );
  console.log(`  dataset version: ${dataset.version} · annexes ${dataset.annexVersion}`);
}

// --- 3: every filesystem path the loader opens must be traced ---------------

const configText = readFileSync(join(root, 'next.config.mjs'), 'utf8');
const datasetSources = [
  'src/lib/ingredient-safety/dataset.ts',
  'src/lib/ingredient-safety/regulatory.ts',
];

/** Paths joined onto `process.cwd()` inside the ingredient loader. */
const runtimePaths = new Set();
for (const source of datasetSources) {
  if (!existsSync(join(root, source))) {
    fail(`missing expected loader source: ${source}`);
    continue;
  }
  const text = readFileSync(join(root, source), 'utf8');
  for (const match of text.matchAll(/join\(process\.cwd\(\),\s*((?:'[^']*',?\s*)+)\)/g)) {
    const parts = [...match[1].matchAll(/'([^']*)'/g)].map((part) => part[1]);
    if (parts.length === 0) continue;
    runtimePaths.add(parts.join('/'));
  }
}

if (runtimePaths.size === 0) {
  fail('no runtime dataset paths were found in the ingredient loader — update this guard');
}

for (const relative of [...runtimePaths].sort()) {
  const absolute = join(root, relative);
  if (!existsSync(absolute)) {
    fail(`dataset file referenced by the loader is missing: ${relative}`);
    continue;
  }
  const traced = configText.includes(`./${relative}`) || configText.includes(relative);
  if (!traced) {
    fail(
      `${relative} is read at runtime but is not listed in next.config.mjs ` +
      'outputFileTracingIncludes — a deploy would answer 503 "dataset unavailable".',
    );
  }
}
console.log(`  traced runtime datasets: ${[...runtimePaths].sort().join(', ')}`);

if (problems.length > 0) {
  console.error('\n✖ ingredient data verification failed:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log('✓ ingredient data verification passed');
