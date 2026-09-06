import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyInci,
  INCI_SCORE_MAX,
  INCI_KNOWLEDGE,
  INCI_TIER_RULES,
  summarizeQuality,
} from '../src/lib/inci-quality';
import en from '../messages/en.json';

describe('classifyInci', () => {
  it('classifies an innocuous list as all good with a full score', () => {
    const result = classifyInci(['Aqua', 'Glycerin', 'Caprylic/Capric Triglyceride', 'Tocopherol']);
    assert.equal(result.total, 4);
    assert.deepEqual(result.counts, { concern: 0, caution: 0, good: 4 });
    assert.equal(result.score, INCI_SCORE_MAX);
    assert.ok(result.ingredients.every((i) => i.tier === 'good'));
  });

  it('counts unique ingredients and ignores duplicates/blank entries', () => {
    const result = classifyInci(['Aqua', 'AQUA', ' aQua ', '', '  ', 'Glycerin']);
    assert.equal(result.total, 2);
  });

  it('classifies sulfates as concern with sulfate + anionic surfactant tags', () => {
    const result = classifyInci(['Sodium Lauryl Sulfate', 'Sodium Laureth Sulfate']);
    assert.deepEqual(result.counts, { concern: 2, caution: 0, good: 0 });
    const sls = result.ingredients.find((i) => i.inci === 'Sodium Lauryl Sulfate');
    assert.equal(sls?.tier, 'concern');
    assert.deepEqual(sls?.tags, ['sulfate', 'anionicSurfactant']);
  });

  it('classifies parabens as caution with paraben + preservative tags', () => {
    const result = classifyInci(['Aqua', 'Propylparaben', 'Butylparaben']);
    assert.deepEqual(result.counts, { concern: 0, caution: 2, good: 1 });
    const flagged = result.ingredients.find((i) => i.tier === 'caution');
    assert.deepEqual(flagged?.tags, ['paraben', 'preservative']);
  });

  it('flags high-concern names (formaldehyde, MIT/CMIT, resorcinol, hydroquinone, talc, UV filters)', () => {
    const result = classifyInci([
      'Formaldehyde',
      'Methylisothiazolinone',
      'Methylchloroisothiazolinone',
      'Resorcinol',
      'Hydroquinone',
      'Oxybenzone',
      'Octocrylene',
      'Talc',
    ]);
    assert.deepEqual(result.counts, { concern: 8, caution: 0, good: 0 });
  });

  it('flags drying alcohols, fragrance, fragrance allergens and quats as caution', () => {
    const result = classifyInci(['Alcohol', 'Alcohol Denat.', 'Parfum', 'Limonene', 'Cocamidopropyl Betaine']);
    assert.deepEqual(result.counts, { concern: 0, caution: 5, good: 0 });
  });

  it('matches INCI names exactly: CETEARYL ALCOHOL must not flag as drying alcohol', () => {
    const result = classifyInci(['Aqua', 'Cetearyl Alcohol', 'Behenyl Alcohol']);
    assert.deepEqual(result.counts, { concern: 0, caution: 0, good: 3 });
  });

  it('attaches common names and function tags for known good ingredients', () => {
    const result = classifyInci(['AQUA/WATER', 'SODIUM CHLORIDE', 'DIMETHICONE']);
    const byName = new Map(result.ingredients.map((i) => [i.inci, i]));
    assert.equal(byName.get('AQUA/WATER')?.common, 'water'); // OBF dual notation
    assert.equal(byName.get('SODIUM CHLORIDE')?.common, 'salt');
    assert.deepEqual(byName.get('SODIUM CHLORIDE')?.tags, ['phAdjuster']);
    assert.equal(byName.get('DIMETHICONE')?.common, 'silicone');
  });

  it('leaves unknown ingredients as plain good-tier rows without tags', () => {
    const result = classifyInci(['UNHEARD-OF-INGREDIENT-9000']);
    assert.equal(result.total, 1);
    assert.equal(result.ingredients[0]?.tier, 'good');
    assert.equal(result.ingredients[0]?.common, undefined);
    assert.deepEqual(result.ingredients[0]?.tags, []);
  });

  it('computes the weighted score (good full, caution half, concern none)', () => {
    // 16 good + 11 caution + 3 concern: (16 + 5.5) / 30 * 20 = 14.3
    const controlled = [
      // 16 good (unknown names + well-known safe ones)
      'AQUA', 'GLYCERIN', 'SODIUM CHLORIDE', 'PANTHENOL', 'UREA', 'DUMMY-1', 'DUMMY-2', 'DUMMY-3',
      'DUMMY-4', 'DUMMY-5', 'DUMMY-6', 'DUMMY-7', 'DUMMY-8', 'DUMMY-9', 'DUMMY-10', 'DUMMY-11',
      // 11 caution
      'PARFUM', 'LIMONENE', 'LINALOOL', 'GERANIOL', 'CITRAL', 'ALCOHOL', 'ALCOHOL DENAT.',
      'METHYLPARABEN', 'PROPYLPARABEN', 'BUTYLPARABEN', 'COCAMIDOPROPYL BETAINE',
      // 3 concern
      'SODIUM LAURYL SULFATE', 'SODIUM LAURETH SULFATE', 'FORMALDEHYDE',
    ];
    const result = classifyInci(controlled);
    assert.deepEqual(result.counts, { concern: 3, caution: 11, good: 16 });
    assert.equal(result.score, 14.3);
  });

  it('returns a full score for an empty list', () => {
    const result = classifyInci([]);
    assert.equal(result.total, 0);
    assert.equal(result.score, INCI_SCORE_MAX);
    assert.deepEqual(result.ingredients, []);
  });

  it('keeps the original INCI spelling', () => {
    const result = classifyInci(['  AQUA  ', 'parfum']);
    const flagged = result.ingredients.find((i) => i.tier === 'caution');
    assert.equal(flagged?.inci, 'parfum');
  });
});

describe('summarizeQuality', () => {
  it('returns the score + tier counts for a mixed list', () => {
    const summary = summarizeQuality([
      'Aqua',
      'Propylparaben',
      'Butylparaben',
      'Sodium Lauryl Sulfate',
    ]);
    assert.deepEqual(summary, { score: 10, good: 1, caution: 2, concern: 1 });
  });

  it('returns a full-score summary for an innocuous list', () => {
    const summary = summarizeQuality(['Aqua', 'Glycerin', 'Tocopherol']);
    assert.deepEqual(summary, { score: INCI_SCORE_MAX, good: 3, caution: 0, concern: 0 });
  });

  it('accepts the CosIng index for a refined classification', () => {
    const plain = summarizeQuality(['BENZOPHENONE-3']);
    assert.equal(plain.concern, 1);
  });
});

describe('INCI knowledge base integrity', () => {
  const quality = (en as any).barcode.quality;

  it('every tier-rule name has a knowledge entry so flagged rows show tags', () => {
    for (const rule of INCI_TIER_RULES) {
      for (const name of rule.inci) {
        assert.ok(INCI_KNOWLEDGE[name], `missing knowledge entry for ${name}`);
      }
    }
  });

  it('every tag/common i18n key exists in the English catalog', () => {
    for (const entry of Object.values(INCI_KNOWLEDGE)) {
      for (const tag of entry.tags) {
        assert.ok(quality.tags[tag], `missing tag key ${tag}`);
      }
      if (entry.common) {
        assert.ok(quality.common[entry.common], `missing common key ${entry.common}`);
      }
    }
  });
});
