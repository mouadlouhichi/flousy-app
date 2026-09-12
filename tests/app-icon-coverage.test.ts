import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { APP_ICON_NAMES } from '../src/components/ui/app-icon';

/**
 * Every icon name the app asks AppIcon (or a chip option) to render must
 * exist in the app-icon map. An unknown name does not throw — it silently
 * renders the generic fallback glyph, which is how nine icons shipped
 * invisible-ish (person_outline, list-ordered, refresh, …) until someone
 * noticed the wrong glyph on a dashboard card.
 *
 * The scan is deliberately textual (no JSX parser): it extracts
 *  - every string literal inside a `name={…}` prop that follows an
 *    `<AppIcon` opening tag (ternaries included: `name={a ? 'x' : 'y'}`),
 *  - every `name="…"` / `name='…'` literal on an AppIcon tag,
 *  - every `icon: '…'` literal in files that render icons (they all end up
 *    in AppIcon through ChoiceChips or card option rows).
 *
 * False positives are kept out by only scanning files that reference
 * AppIcon / ChoiceChips — <input name="email"> and cva size variants are
 * not icon usages.
 */

const SOURCE_ROOT = new URL('../src/', import.meta.url);
const ICONISH = /AppIcon|ChoiceChip/;

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      yield* walk(full);
      continue;
    }
    if (/\.(tsx|ts)$/.test(entry)) yield full;
  }
}

function literalsInside(expression: string): string[] {
  // Literals in *value* positions only. A prop like
  // `name={state === 'saved' ? 'cloud_done' : 'cloud_off'}` compares against
  // state strings too — those are not icon names, so comparisons are
  // stripped before extracting literals.
  const stripped = expression
    .replace(/[=!]==?\s*['"][a-z0-9_-]+['"]/g, '')
    .replace(/['"][a-z0-9_-]+['"]\s*[=!]==?/g, '');
  return [...stripped.matchAll(/['"]([a-z0-9_-]+)['"]/g)].map((m) => m[1]);
}

describe('app icon coverage', () => {
  it('every icon name used in src exists in the icon map', () => {
    const used = new Map<string, string[]>();
    const note = (name: string, file: string) => {
      used.set(name, [...(used.get(name) ?? []), file]);
    };

    for (const file of walk(SOURCE_ROOT.pathname)) {
      if (file.endsWith('app-icon.tsx')) continue;
      const source = readFileSync(file, 'utf8');
      const rel = relative(process.cwd(), file).replace(/\\/g, '/');
      if (!ICONISH.test(source)) continue;

      // <AppIcon … name={expr} …> — expression may span lines but not braces.
      for (const match of source.matchAll(/<AppIcon\b[\s\S]{0,400}?name=\{([^}]*)\}/g)) {
        for (const literal of literalsInside(match[1])) note(literal, rel);
      }
      // <AppIcon … name="literal" …>
      for (const match of source.matchAll(/<AppIcon\b[\s\S]{0,400}?name=(["'])([a-z0-9_-]+)\1/g)) {
        note(match[2], rel);
      }
      // Chip / card option objects: { label, value, icon: 'name' } — the
      // value may also be a ternary, so it gets the same comparison
      // stripping as the name props.
      for (const match of source.matchAll(/\bicon:\s*([^,}\n]+)/g)) {
        for (const literal of literalsInside(match[1])) note(literal, rel);
      }
    }

    assert.ok(used.size > 50, `scan looked too small (${used.size} names) — the regexes rotted`);
    const missing = [...used.entries()]
      .filter(([name]) => !APP_ICON_NAMES.has(name))
      .map(([name, files]) => `${name} (used in ${[...new Set(files)].join(', ')})`);
    assert.deepEqual(
      missing,
      [],
      `Icon names rendered as the generic fallback — add them to src/components/ui/app-icon.tsx: ${missing.join('; ')}`,
    );
  });
});
