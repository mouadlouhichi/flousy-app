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
    fns.set(m[1], { params: splitTop(m[2], [',']), lets, ret });
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

const rules = [];
const ruleRe = /allow\s+([\w,\s]+?)\s*:\s*if\s+([^;]*);/g;
let m;
while ((m = ruleRe.exec(src))) {
  const line = src.slice(0, m.index).split('\n').length;
  rules.push({ line, method: m[1].trim(), cost: exprCost(m[2], new Set(), 0, []), text: m[2].trim().slice(0, 44) });
}
rules.sort((a, b) => b.cost - a.cost);
console.log('\nrule cost (highest first):');
for (const r of rules.slice(0, limit)) {
  console.log(String(r.cost).padStart(6), `L${String(r.line).padStart(3)}`, r.method.padEnd(14), r.text);
}
