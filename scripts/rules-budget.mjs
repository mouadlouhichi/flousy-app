// Estimate how much of Firestore's 1000-expressions-per-request budget a rule uses.
//
// The rules engine inlines every function call at its call site and evaluates a
// request's rules against one shared budget, so a helper called three times costs
// three times, while a `let` (or a parameter, which is bound the same way) is
// evaluated once and each later use of the name costs one expression. Exceeding the
// budget is not an error you can see: the write is simply denied. This script counts
// in that model so the cost of a rule is reviewable without an emulator.
//
//   node scripts/rules-budget.mjs [file] [rulesToShow]
import fs from 'node:fs';

const src = fs.readFileSync(process.argv[2] ?? 'firestore.rules', 'utf8');

function splitTop(text, seps) {
  const out = [];
  let depth = 0;
  let quote = null;
  let buf = '';
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quote) {
      buf += c;
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"') { quote = c; buf += c; continue; }
    if ('([{'.includes(c)) depth += 1;
    if (')]}'.includes(c)) depth -= 1;
    if (depth === 0 && seps.includes(c)) { out.push(buf.trim()); buf = ''; continue; }
    buf += c;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

function matchBrace(text, openIdx, open = '(', close = ')') {
  let depth = 0;
  for (let i = openIdx; i < text.length; i += 1) {
    if (text[i] === open) depth += 1;
    else if (text[i] === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return text.length - 1;
}

const fns = new Map();
{
  const re = /\bfunction\s+(\w+)\s*\(([^)]*)\)\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    const open = m.index + m[0].length - 1;
    const end = matchBrace(src, open, '{', '}');
    const lets = [];
    let ret = '';
    for (const raw of splitTop(src.slice(open + 1, end), [';'])) {
      const s = raw.replace(/\/\/[^\n]*/g, '').trim();
      if (!s) continue;
      const bound = /^let\s+([A-Za-z_]\w*)\s*=\s*([\s\S]+)$/.exec(s);
      if (bound) lets.push([bound[1], bound[2].trim()]);
      else if (s.startsWith('return ')) ret = s.slice(7).trim();
    }
    fns.set(m[1], { params: splitTop(m[2], [',']), lets, ret, body: src.slice(open + 1, end) });
  }
}

function exprCost(text, scope, depth, path) {
  if (depth > 24) return 0;
  const cleaned = text.replace(/\/\/[^\n]*/g, ' ');
  const callRe = /([A-Za-z_]\w*)\s*\(/g;
  const spans = [];
  let m;
  while ((m = callRe.exec(cleaned))) {
    if (/\.\s*$/.test(cleaned.slice(0, m.index))) continue; // method call on a value
    const name = m[1];
    const open = m.index + m[0].length - 1;
    const end = matchBrace(cleaned, open);
    const args = splitTop(cleaned.slice(open + 1, end), [',']);
    const own = fns.has(name) && !path.includes(name)
      ? callCost(name, args, scope, depth, path)
      : args.reduce((n, a) => n + exprCost(a, scope, depth + 1, path), 0);
    spans.push({ start: m.index, end, own, known: fns.has(name) && !path.includes(name) });
    callRe.lastIndex = end;
  }
  let stripped = '';
  let cursor = 0;
  let total = 0;
  for (const span of spans) {
    stripped += cleaned.slice(cursor, span.start) + (span.known ? '@' : '');
    cursor = span.end + 1;
    total += span.own;
  }
  stripped += cleaned.slice(cursor);
  const tokens = stripped.match(/'[^']*'|"[^"]*"|[A-Za-z_]\w*|\d+|\.\w+|[(){}[\],;:!?<>=+*/&|~-]/g) || [];
  return total + tokens.length;
}

function callCost(name, args, scope, depth, path) {
  const fn = fns.get(name);
  let total = 0;
  const bound = new Set(scope);
  fn.params.forEach((p, i) => {
    total += exprCost(args[i] ?? '', scope, depth + 1, [...path, name]);
    bound.add(p);
  });
  for (const [lname, lexpr] of fn.lets) {
    total += exprCost(lexpr, bound, depth + 1, [...path, name]) + 1;
    bound.add(lname);
  }
  return total + exprCost(fn.ret, bound, depth + 1, [...path, name]);
}

const limit = Number(process.argv[3] ?? 10);
const helpers = [...fns.keys()]
  .map((name) => ({ name, cost: callCost(name, fns.get(name).params.map(() => 'x'), new Set(), 0, [name]) }))
  .sort((a, b) => b.cost - a.cost);
console.log('helper cost (one call, fully expanded):');
for (const h of helpers.slice(0, limit)) console.log(String(h.cost).padStart(6), h.name);


// Distinct documents a rule consults. `get()`/`exists()`/`getAfter()`/`existsAfter()` are
// capped per request - 10 for a single-document write, 20 for a batch or transaction - and
// going over it is a hard permission-denied whose only other symptom is that the client
// cannot explain itself. This ruleset's entitlement chain (household root, member row,
// sponsor profile, sponsor ledger, month document, invite) consults one document per hop, so
// the read cap, not the expression budget, is what the design has to fit. Two reads of the
// same path count once, because the engine caches a document already read in the request;
// a read through a `let path` counts as one document in that function's scope, keyed by the
// variable, which is the right answer when the path is built once and consulted twice and
// an undercount when one variable name is reused for different documents.
function pathKeys(body, scope) {
  const cleaned = body.replace(/\/\/[^\n]*/g, ' ');
  const re = /(^|[^.\w])(get|exists|getAfter|existsAfter)\s*\(/g;
  const keys = new Set();
  let m;
  while ((m = re.exec(cleaned))) {
    const open = m.index + m[0].length - 1;
    let depth = 0;
    let end = open;
    for (let i = open; i < cleaned.length; i += 1) {
      if (cleaned[i] === '(') depth += 1;
      else if (cleaned[i] === ')') {
        depth -= 1;
        if (depth === 0) { end = i; break; }
      }
    }
    const arg = cleaned.slice(open + 1, end).split(',')[0].replace(/\s+/g, '');
    if (arg) keys.add(`${scope}:${arg}`);
    re.lastIndex = end;
  }
  return keys;
}

// Fixed point, because helpers call helpers: `householdRootFacts` reaches the household,
// the sponsor profile and the sponsor's ledger row through three other functions.
const fnReads = new Map();
for (const [name, fn] of fns) fnReads.set(name, pathKeys(fn.body, name));
for (let pass = 0; pass < 8; pass += 1) {
  let changed = 0;
  for (const [name, fn] of fns) {
    const own = fnReads.get(name);
    const calls = (fn.body).match(/[A-Za-z_]\w*\s*\(/g) ?? [];
    for (const raw of calls) {
      const callee = raw.replace(/\s*\($/, '');
      const set = fns.has(callee) ? fnReads.get(callee) : null;
      if (!set || callee === name) continue;
      for (const k of set) if (!own.has(k)) { own.add(k); changed += 1; }
    }
    if (own.size !== fnReads.get(name).size) fnReads.set(name, own);
  }
  if (!changed) break;
}

function ruleReads(ruleText) {
  const keys = pathKeys(ruleText, 'rule');
  const calls = ruleText.match(/[A-Za-z_]\w*\s*\(/g) ?? [];
  const seen = new Set();
  for (const raw of calls) {
    const callee = raw.replace(/\s*\($/, '');
    if (!fns.has(callee) || seen.has(callee)) continue;
    seen.add(callee);
    for (const k of fnReads.get(callee)) keys.add(k);
  }
  // Reads of the same document through differently spelled paths are one document; the
  // scope prefix only made the variable case work, so drop it for the comparison.
  const documents = new Set([...keys].map((k) => k.split(':').slice(1).join(':')));
  return documents.size;
}

const rules = [];
const ruleRe = /allow\s+([\w,\s]+?)\s*:\s*if\s+([^;]*);/g;
let m;
while ((m = ruleRe.exec(src))) {
  const line = src.slice(0, m.index).split('\n').length;
  rules.push({
    line,
    method: m[1].trim(),
    cost: exprCost(m[2], new Set(), 0, []),
    reads: ruleReads(m[2]),
    text: m[2].trim().slice(0, 44),
  });
}
rules.sort((a, b) => b.cost - a.cost);
console.log('\nrule cost (highest first):');
for (const r of rules.slice(0, limit)) {
  console.log(String(r.cost).padStart(6), `L${String(r.line).padStart(3)}`, r.method.padEnd(14), r.text);
}

// The number that decides whether a write is possible at all. A single-document request may
// consult ten documents; a batch or transaction twenty; anything more is refused with the
// same bare permission-denied the app reports for every other refusal.
console.log('\nrule reads (distinct documents consulted; 10 for a single write, 20 for a batch):');
for (const r of [...rules].sort((a, b) => b.reads - a.reads).slice(0, limit)) {
  const flag = r.reads > 10 ? (r.reads > 20 ? '  OVER BOTH' : '  over 10') : '';
  console.log(String(r.reads).padStart(4), `L${String(r.line).padStart(3)}`, r.method.padEnd(14), r.text, flag);
}

// Fail the build on a rule that cannot be evaluated. Over the 1000-expression budget the
// engine refuses the request *before* testing any branch, so the app sees a bare
// permission-denied with nothing to attribute it to - the exact symptom that made importing,
// syncing and deleting a shared workspace fail with "something went wrong". Estimated cost is
// an approximation, so the gate is a ratchet: known-over rules are listed here with the
// reason they are tolerable, and anything new, or any listed rule that grows, fails.
const KNOWN_OVER = new Map([
  // Reached only by a custom-role member holding PARTIAL month grants: `||` short-circuits,
  // so every other writer is authorized by a cheaper statement before this one is tried.
  ['monthUpdateByCustomMember(hid)', 1300],
]);
const offenders = rules
  .filter((r) => r.cost > 1000)
  .map((r) => ({ r, key: [...KNOWN_OVER.keys()].find((k) => r.text.startsWith(k)) }))
  .filter(({ r, key }) => key === undefined || r.cost > KNOWN_OVER.get(key));
if (offenders.length > 0) {
  console.error('\nover the 1000-expression budget (these are refused before any branch runs):');
  for (const { r, key } of offenders) {
    const bound = key === undefined ? 'not allowlisted' : `allowlisted at ${KNOWN_OVER.get(key)}, now higher`;
    console.error(String(r.cost).padStart(6), `L${r.line}`, r.method, r.text, `- ${bound}`);
  }
  process.exit(1);
}
