/**
 * Moroccan barcode corpus regression.
 *
 * `data/ma-corpus-off.json` holds 203 real products harvested from the Open
 * Food Facts "Morocco" facet (22 847 products exist there; these are pages 1-6,
 * see `scripts/audit-ma-corpus.mts` and `docs/MOROCCAN_BARCODE_CORPUS_AUDIT_2026-09-11.md`).
 *
 * The acceptance bar: a scanned Moroccan product must come back with a grade.
 * The only legitimate exceptions are labels that carry no ingredient list at
 * all — waters (which get the mineral-composition view instead of a grade) and
 * a handful of records where the stored "ingredients" are marketing text.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyzeFoodText } from '../src/lib/food-knowledge/analyze';
import { detectFoodKind } from '../src/lib/food-knowledge/domain';
import { foodLabelGrade } from '../src/lib/food-knowledge/grade';

interface CorpusProduct {
  code: string;
  categories?: string;
  ingredients_text?: string;
}

const corpus = JSON.parse(
  readFileSync(new URL('../data/ma-corpus-off.json', import.meta.url), 'utf8'),
) as { count: number; products: CorpusProduct[] };

/** Records whose stored "ingredients" are marketing copy, not an ingredient list. */
const NO_INGREDIENT_LIST = new Set(['6111018903161', '6111024002186', '6111101001361']);

describe('Moroccan barcode corpus', () => {
  it('is a real corpus, not an empty fixture', () => {
    assert.equal(corpus.products.length, 203);
    assert.ok(corpus.products.every((p) => typeof p.code === 'string' && p.code.length > 0));
  });

  it('grades every product that actually prints an ingredient list', () => {
    const failures: string[] = [];
    let graded = 0;
    let waters = 0;
    let empty = 0;

    for (const product of corpus.products) {
      const text = (product.ingredients_text ?? '').trim();
      if (!text) {
        empty += 1;
        continue;
      }
      const analysis = analyzeFoodText(text, { category: product.categories ?? '' });
      if (detectFoodKind({ category: product.categories ?? '', text }) === 'water') {
        waters += 1;
        continue;
      }
      if (NO_INGREDIENT_LIST.has(product.code)) {
        // Label noise (hotline/URL/nutrition claim): withholding is correct.
        assert.equal(foodLabelGrade(analysis), null, `${product.code} should stay withheld`);
        continue;
      }
      const grade = foodLabelGrade(analysis);
      if (grade) {
        graded += 1;
      } else {
        failures.push(`${product.code} — ${analysis.recognized}/${analysis.total} recognized: ${text.slice(0, 70)}`);
      }
    }

    assert.deepEqual(failures, [], `products without a grade:\n${failures.join('\n')}`);
    // Guard against the fixture silently degrading (e.g. a truncated corpus).
    assert.ok(graded >= 160, `expected at least 160 graded products, got ${graded}`);
    assert.ok(waters >= 25, `expected the water share of the corpus, got ${waters}`);
    assert.equal(empty, 7);
  });

  it('reads Arabic labels with no unrecognized rows', () => {
    // A representative all-Arabic processed-cheese label (OFF 6111203006653).
    const product = corpus.products.find((p) => p.code === '6111203006653');
    assert.ok(product);
    const analysis = analyzeFoodText(product!.ingredients_text!, {
      category: product!.categories ?? '',
    });
    assert.equal(analysis.recognized, analysis.total, `unknown: ${analysis.unknownNames.join(', ')}`);
    assert.ok(analysis.allergens.some((hit) => hit.group === 'milk'));
    assert.deepEqual(
      [...analysis.additives.map((a) => a.code)].sort(),
      ['E202', 'E341', 'E450', 'E452'],
    );
  });

  it('does not invent a grade for the labels that carry no ingredients', () => {
    for (const code of NO_INGREDIENT_LIST) {
      const product = corpus.products.find((p) => p.code === code);
      assert.ok(product, `missing fixture ${code}`);
      const analysis = analyzeFoodText(product!.ingredients_text!, { category: product!.categories ?? '' });
      assert.equal(analysis.recognized, 0, `${code} unexpectedly recognized something`);
      assert.equal(foodLabelGrade(analysis), null);
    }
  });
});
