// The release gate that stands in front of `deploy-rules` is `npm audit`, and it has two
// opposite failure modes that the exit code alone cannot tell apart: a dependency with a
// real advisory, and an advisory service that did not answer. This pins the summariser
// that makes the difference visible in the run, including the case where there is no
// report to parse at all - which must never be reported as a vulnerability.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const script = path.resolve(process.cwd(), 'scripts/audit-summary.mjs');
const dir = mkdtempSync(path.join(tmpdir(), 'audit-summary-'));

function run(contents: string) {
  const file = path.join(dir, `report-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(file, contents);
  const result = spawnSync('node', [script, file], { encoding: 'utf8' });
  return { line: result.stdout.trim(), status: result.status };
}

const summarise = (contents: string) => run(contents).line;

test('names the vulnerable packages and their severities', () => {
  const line = summarise(JSON.stringify({
    metadata: { vulnerabilities: { high: 1, total: 1 } },
    vulnerabilities: {
      next: { severity: 'high', range: '<14.2.3', via: [{ title: 'Denial of service in the image optimizer' }] },
    },
  }));
  assert.match(line, /1 high/);
  assert.match(line, /next@<14\.2\.3/);
  assert.match(line, /Denial of service in the image optimizer/);
});

test('says so when the audit command produced no report, instead of claiming a clean run', () => {
  const line = summarise('npm error code E404\nnpm error audit endpoint unreachable');
  assert.match(line, /did not produce a report/);
  assert.match(line, /not an advisory/);
  assert.doesNotMatch(line, /vulnerable|no advisories counted/);
});

test('reports an empty report as empty rather than as a parse failure', () => {
  const { line, status } = run(JSON.stringify({ metadata: { vulnerabilities: { total: 0 } }, auditReportVersion: 2 }));
  assert.match(line, /no advisories counted/);
  assert.equal(status, 0, 'a clean report is not an indictment, whatever npm exited with');
});

test('exits 10 only when the report itself indicts a package', () => {
  const dirty = run(JSON.stringify({
    metadata: { vulnerabilities: { high: 1, total: 1 } },
    vulnerabilities: { next: { severity: 'high', range: '<14.2.3', via: [{ title: 'DoS' }] } },
  }));
  assert.equal(dirty.status, 10);
  const missing = run('npm error code E404');
  assert.equal(missing.status, 20, 'no report is its own answer, not a clean one and not an advisory');
});
