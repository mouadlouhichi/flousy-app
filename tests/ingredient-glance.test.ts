import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeIngredientList } from '../src/lib/ingredient-safety/analyze';
import { ingredientFlagText } from '../src/components/dashboard/courses/courses-ingredient-glance';
import en from '../messages/en.json';
import fr from '../messages/fr.json';
import ar from '../messages/ar.json';

/** The app's simple {token} interpolation, mirroring i18n-core.interpolate. */
function t(template: string, values: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in values ? String(values[key]) : `{${key}}`,
  );
}

type AnyMessages = {
  ingredientGlance?: Record<string, unknown>;
  ingredientManual?: Record<string, unknown>;
};
type GlanceShape = typeof en.ingredientGlance;
const glanceOf = (messages: AnyMessages): GlanceShape =>
  (messages.ingredientGlance ?? {}) as unknown as GlanceShape;

type AnyGroup = { [key: string]: unknown };

describe('ingredientGlance messages', () => {
  it('keeps identical key sets across en/fr/ar', () => {
    const keys = (obj: GlanceShape) => Object.keys(obj).sort();
    const enKeys = keys(glanceOf(en));
    assert.ok(enKeys.length > 20, 'expected the glance message group to exist');
    assert.deepEqual(keys(glanceOf(fr)), enKeys);
    assert.deepEqual(keys(glanceOf(ar)), enKeys);
  });

  it('keeps the ingredientManual group identical across locales', () => {
    const manualOf = (m: AnyMessages) =>
      (m.ingredientManual ?? {}) as AnyGroup;
    const keys = (obj: AnyGroup) => Object.keys(obj).sort();
    const enKeys = keys(manualOf(en));
    assert.ok(enKeys.length >= 7, 'expected the manual-entry message group to exist');
    assert.deepEqual(keys(manualOf(fr)), enKeys);
    assert.deepEqual(keys(manualOf(ar)), enKeys);
  });

  it('composes localized flag lines from a real engine output', () => {
    const analysis = analyzeIngredientList(
      ['Aqua', 'Glycerin', 'Quaternium-15', 'Parfum', 'Linalool', 'Limonene'],
      { form: 'leave-on' },
    );
    const g = glanceOf(en);
    const textOf = (code: string) => ingredientFlagText(code, analysis, g, t);

    const prohibited = textOf('eu-annex-ii-name-match');
    assert.match(prohibited, /Annex II/);
    assert.match(prohibited, /Quaternium-15/i);
    assert.doesNotMatch(prohibited, /product (?:is )?(?:banned|safe|compliant)/i);

    const allergens = textOf('fragrance-allergen-name-matches');
    assert.match(allergens, /Linalool/i);

    assert.equal(textOf('fragrance-generic'), g.flagGeneric);
    assert.equal(
      textOf('unknown-ingredients'),
      t(g.flagUnknown, { count: analysis.total - analysis.recognized }),
    );
  });

  it('composes in French and Arabic for every flag code', () => {
    const analysis = analyzeIngredientList(
      ['Aqua', 'Glycerin', 'Quaternium-15', 'Parfum', 'Linalool', 'Limonene', 'Methylisothiazolinone'],
      { form: 'leave-on' },
    );
    const codes = analysis.flags.map((f) => f.code);
    assert.ok(codes.includes('eu-annex-ii-name-match'));
    for (const messages of [fr, ar]) {
      const g = glanceOf(messages);
      for (const code of codes) {
        const line = ingredientFlagText(code, analysis, g, t);
        assert.ok(
          line.length > 0,
          `flag ${code} should produce text for ${messages === fr ? 'fr' : 'ar'}`,
        );
      }
    }
  });

  it('exposes band labels while identity-only lists remain unscored', () => {
    const analysis = analyzeIngredientList(['Aqua', 'Glycerin'], { form: 'leave-on' });
    assert.equal(analysis.band, null);
    assert.equal(analysis.score, null);
    const g = glanceOf(en);
    assert.ok(g.bandExcellent.length > 0);
    assert.ok(g.bandAvoid.length > 0);
  });
});
