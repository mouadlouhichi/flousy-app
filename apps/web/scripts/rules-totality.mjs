// Which rules can be aborted by a document that merely lacks a field?
//
// `incoming().plan` is not a check that `plan` is missing: it is an expression that cannot
// be evaluated, and Firestore turns that into a permission-denied with no cause attached.
// `incoming().get('plan', '')` answers the question. The distinction is the whole
// difference between "this write is not allowed" and "we could not tell", and only the
// first one is a thing the app can explain to the user.
//
// Reads hide inside helpers, so the scan expands calls transitively: the rule for
// `members/{memberId}` looks total and still aborts in `profileIsPro` three calls deep.
import fs from 'node:fs';

const file = process.argv[2] ?? 'firestore.rules';
// `--baseline <file>` compares against recorded debt instead of demanding perfection: the
// scan emits the sorted list of `method:field` pairs it found, and the check fails if the
// set differs. A rule fixed must be removed from the baseline (which is the point - the
// list can only shrink), and a new one cannot appear silently.
const baselineArg = process.argv.indexOf('--baseline');
const writeArg = process.argv.indexOf('--write');
const baselinePath = (baselineArg >= 0 ? process.argv[baselineArg + 1] : null)
  ?? (writeArg >= 0 ? process.argv[writeArg + 1] ?? 'firestore.totality-baseline.json' : null);
// Comments carry the reasoning for these rules, so they are full of the very shapes this
// scan looks for - strip both comment styles first or the documentation reads as debt.
const src = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

function sliceBody(open) {
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return { body: src.slice(open + 1, i), end: i };
    }
  }
  return { body: src.slice(open + 1), end: src.length - 1 };
}

const fns = new Map();
{
  const re = /\bfunction\s+(\w+)\s*\(([^)]*)\)\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    const open = m.index + m[0].length - 1;
    const { body, end } = sliceBody(open);
    fns.set(m[1], { body, params: m[2].split(',').map((p) => p.trim()).filter(Boolean), line: src.slice(0, m.index).split('\n').length });
    re.lastIndex = end;
  }
}

// Expressions that evaluate to a *document* (a map), including the variables they are bound
// to and the snapshots `get()/getAfter()` return.
const DOC = /(incoming\(\)|existing\(\)|resource\.data|request\.resource\.data|[A-Za-z_]\w*\s*\.\s*data)/;
// Names that are *methods* on a map, list or snapshot rather than fields a document may
// omit - `after.diff(before)` cannot abort on a missing key, `after.diff` can.
const METHODS = new Set(['get', 'diff', 'size', 'split', 'keys', 'values', 'toSet', 'hasAny',
  'hasOnly', 'affectedKeys', 'lower', 'upper', 'trim', 'matches', 'replace', 'toUtf8',
  'contains', 'concat', 'join', 'removeAll', 'exists', 'getAfter', 'existsAfter', 'data']);

function docNames(body) {
  const names = new Set();
  for (const m of body.matchAll(/\blet\s+([A-Za-z_]\w*)\s*=\s*([^;]+)/g)) {
    if (DOC.test(m[2]) || names.has(m[2].trim())) names.add(m[1]);
  }
  // `data` and `p` are documents passed in by callers that read `existing()`/`incoming()`.
  for (const m of body.matchAll(/\bfor\s*\(/g)) void m;
  return names;
}

// Unguarded `<doc>.<field>` reads in one body: reported unless the same body asks whether
// the field is present, or reads it through `.get(field, default)`.
function unguarded(body, extraDocs = new Set()) {
  const docs = new Set([...docNames(body), ...extraDocs]);
  const docRe = new RegExp(`(?:${DOC.source.slice(0, DOC.source.length)}${docs.size ? `|${[...docs].join('|')})` : '})'}`, 'g');
  const found = [];
  // Two shapes: a document expression read directly (`incoming().plan`, `after.role`), and a
  // snapshot read through `.data` (`getAfter(path).data.revision`). The second is the one
  // that strands an existing user, because the document being read is somebody else's -
  // a sponsor profile, the month row this write is checking against - and a rule has no
  // way to know which fields a legacy copy of it ever stored.
  const re = /(?:incoming\(\)|existing\(\)|[A-Za-z_]\w*(?:\s*\.\s*data)?|\bresource\.data)\s*\.\s*([A-Za-z_]\w*)|\.data\s*\.\s*([A-Za-z_]\w*)/g;
  let m;
  while ((m = re.exec(body))) {
    const field = m[1] ?? m[2];
    if (!field || METHODS.has(field)) continue; // a method call on the document, not a field read
    if (m[2]) {
      // `.data.<field>` - the receiver is whatever snapshot produced it.
      const receiver = body.slice(Math.max(0, m.index - 160), m.index + '.data'.length).match(/[A-Za-z_]\w*\s*\([^()]*\)\s*\.data$/)?.[0]
        ?? body.slice(Math.max(0, m.index - 160), m.index + '.data'.length).match(/\w+\.data$/)?.[0]
        ?? '<snapshot>.data';
      const guardedField = new RegExp(`['"]${field}['"]\\s+in\\s+[^)]{0,200}\\)\\.data`).test(body);
      if (!guardedField) found.push({ field, receiver, line: src.slice(0, bodyStart(body) + m.index).split('\n').length });
      continue;
    }
    const receiver = m[0].replace(/\s*\.\s*\w+$/, '').trim();
    const isDocExpr = docs.has(receiver) || /incoming\(\)|existing\(\)|\.data$/.test(receiver);
    if (!isDocExpr) continue;
    const guarded = new RegExp(`['"]${field}['"]\\s+in\\s+${receiver.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(body)
      || new RegExp(`['"]${field}['"]\\s+in\\s+`).test(body);
    if (!guarded) found.push({ field, receiver, line: src.slice(0, bodyStart(body) + m.index).split('\n').length });
  }
  return found;
}

let _bodies = new Map();
function bodyStart(body) {
  if (!_bodies.has(body)) _bodies.set(body, src.indexOf(body));
  return _bodies.get(body);
}

function readsOf(name, seen = new Set()) {
  if (seen.has(name) || !fns.has(name)) return [];
  seen.add(name);
  const fn = fns.get(name);
  const own = unguarded(fn.body).map((u) => ({ ...u, via: name }));
  const nested = [...fn.body.matchAll(/\b([A-Za-z_]\w*)\s*\(/g)]
    .filter((m) => fns.has(m[1]))
    .flatMap((m) => readsOf(m[1], seen));
  return [...own, ...nested];
}

const rows = [];
for (const m of src.matchAll(/\ballow\s+([\w,\s]+?)\s*:\s*if\s+([^;]*);/g)) {
  const line = src.slice(0, m.index).split('\n').length;
  const ruleBody = m[2];
  const direct = unguarded(ruleBody);
  const viaHelpers = [...ruleBody.matchAll(/\b([A-Za-z_]\w*)\s*\(/g)]
    .filter((c) => fns.has(c[1]))
    .flatMap((c) => readsOf(c[1]));
  const all = [...direct.map((u) => ({ ...u, via: 'rule' })), ...viaHelpers];
  if (all.length) rows.push({ line, method: m[1].trim(), issues: all });
}

rows.sort((a, b) => b.issues.length - a.issues.length);

// A `create` rule may insist on fields: the document does not exist yet, so a write that
// omits a required key is a malformed write and any answer that is not `true` is correct.
// An `update` rule has no such luxury - the document it is judging belongs to somebody who
// is already using the app, and a field the writer of a new feature did not think to
// backfill turns into a refusal they cannot explain. So only the non-create cases are an
// error here; the rest is a report.
const isCreate = (method) => method.split(',').map((m) => m.trim()).every((m) => m === 'create');
const blocking = rows.filter((r) => !isCreate(r.method));
const permissive = rows.filter((r) => isCreate(r.method));

if (!rows.length) {
  console.log('no unguarded document reads: every field a rule looks at is either proven present or read with a default');
  process.exit(0);
}
const report = (list) => {
  for (const r of list) {
    const fields = [...new Set(r.issues.map((i) => `${i.via === 'rule' ? 'rule' : `via ${i.via}`}.${i.field}`))];
    console.log(`L${String(r.line).padStart(4)} ${r.method.padEnd(14)} ${fields.length} unguarded: ${fields.slice(0, 8).join(', ')}${fields.length > 8 ? ` +${fields.length - 8}` : ''}`);
  }
};
if (blocking.length) {
  console.log('Unguarded document reads in update/delete rules - these refuse existing users when a field is missing:');
  report(blocking);
}
if (permissive.length) {
  console.log(`\n(create rules allowed to require their fields, reported for information: ${permissive.reduce((n, r) => n + r.issues.length, 0)} sites)`,);
  report(permissive);
}
if (!blocking.length) {
  console.log('\nNo update or delete rule can be aborted by a missing field.');
}
const sites = [...new Set(blocking.flatMap((r) => r.issues.map((i) => `${r.method.trim()}:${i.field}`)))].sort();
if (process.argv.includes('--write')) {
  // Record what is there, not what should be: the file is the debt, and the test below is
  // what stops it from growing while it is being paid down.
  fs.writeFileSync(baselinePath ?? 'firestore.totality-baseline.json', JSON.stringify(sites, null, 2) + '\n');
  console.log(`recorded ${sites.length} site(s)`);
  process.exit(0);
}
if (baselinePath) {
  const expected = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const missing = expected.filter((k) => !sites.includes(k));
  const extra = sites.filter((k) => !expected.includes(k));
  if (extra.length) console.log(`new unguarded reads not in the baseline: ${extra.join(', ')}`);
  if (missing.length) console.log(`fixed since the baseline was recorded, update it: ${missing.join(', ')}`);
  if (extra.length || missing.length) process.exit(1);
  console.log(`\nmatches the recorded baseline of ${sites.length} site(s); the list only shrinks`);
  process.exit(0);
}
process.exit(blocking.length ? 1 : 0);
