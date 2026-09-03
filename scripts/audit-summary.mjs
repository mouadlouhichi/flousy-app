// Turn `npm audit --json` into one line a human (or a CI annotation) can act on.
//
// `npm audit` exits 1 both when it finds an advisory and when it cannot reach the
// advisory service, and the plain text output that distinguishes them scrolls past in a
// log that is not always readable after the fact. So the gate keeps a machine-readable
// report and this script names the packages - or names the fact that there was no report
// to parse, which is an infrastructure failure and not a reason to hold a release.
import fs from 'node:fs';

const path = process.argv[2];
if (!path) {
  console.error('usage: node scripts/audit-summary.mjs <npm-audit.json>');
  process.exit(2);
}

const text = fs.readFileSync(path, 'utf8');
let report;
try {
  report = JSON.parse(text);
} catch {
  // No JSON: either the registry refused the lookup or npm printed an error before it.
  const first = text.split('\n').map((line) => line.trim()).filter(Boolean)[0] ?? 'no output';
  console.log(`audit did not produce a report (not an advisory - investigate the lookup): ${first.slice(0, 220)}`);
  process.exit(0);
}

const metadata = report?.metadata?.vulnerabilities ?? {};
const totals = ['info', 'low', 'moderate', 'high', 'critical']
  .filter((level) => metadata[level])
  .map((level) => `${metadata[level]} ${level}`)
  .join(', ');

const entries = Object.entries(report?.vulnerabilities ?? {}).slice(0, 8).map(([name, issue]) => {
  const titles = (issue?.via ?? [])
    .filter((via) => typeof via === 'object' && via?.title)
    .map((via) => via.title);
  return `${name}@${issue?.range ?? '?'} (${issue?.severity ?? '?'}${titles.length ? `: ${titles[0]}` : ''})`;
});

const overflow = Object.keys(report?.vulnerabilities ?? {}).length - entries.length;
console.log([
  totals || 'no advisories counted',
  entries.length ? `vulnerable: ${entries.join('; ')}` : 'no vulnerable package listed',
  overflow > 0 ? `+${overflow} more` : '',
].filter(Boolean).join(' | '));
