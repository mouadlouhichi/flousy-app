import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeInciText,
  analyzeIngredientList,
  inferProductForm,
} from '../src/lib/ingredient-safety/analyze';
import { lookupIngredient } from '../src/lib/ingredient-safety/dataset';
import { lookupOverlay, overlaySignalCount } from '../src/lib/ingredient-safety/eu-lists';
import { normalizeInciToken, splitInciList } from '../src/lib/ingredient-safety/normalize';

describe('normalizeInciToken', () => {
  it('folds case, NFKC and punctuation to a canonical uppercase key', () => {
    assert.equal(normalizeInciToken('  Aqua '), 'AQUA');
    assert.equal(normalizeInciToken('cetearyl alcohol'), 'CETEARYL ALCOHOL');
    assert.equal(normalizeInciToken('Sodium Laureth Sulfate'), 'SODIUM LAURETH SULFATE');
  });

  it('handles colour-index spellings (C.I. → CI)', () => {
    for (const spelling of ['C.I. 77491', 'CI 77491', 'C I 77491']) {
      assert.equal(normalizeInciToken(spelling), 'CI 77491');
    }
  });
});

describe('splitInciList', () => {
  it('strips headings, bullets and numbering', () => {
    assert.deepEqual(splitInciList('INGREDIENTS: Aqua, Glycerin'), ['Aqua', 'Glycerin']);
    assert.deepEqual(splitInciList('Ingredients:\n• Aqua\n• Glycerin'), ['Aqua', 'Glycerin']);
    assert.deepEqual(splitInciList('1. Aqua\n2. Glycerin'), ['Aqua', 'Glycerin']);
  });

  it('does not split on commas inside parentheses', () => {
    assert.deepEqual(
      splitInciList('Hydrolyzed (Citrus Aurantium Amara / Forsythia Viridissima) Fruit Extract, Aqua'),
      ['Hydrolyzed (Citrus Aurantium Amara / Forsythia Viridissima) Fruit Extract', 'Aqua'],
    );
  });

  it('drops pure-number residues and empty tokens', () => {
    assert.deepEqual(splitInciList('Aqua, 3%, , Glycerin, .'), ['Aqua', 'Glycerin']);
  });
});

describe('CosIng dataset lookup', () => {
  it('loads the committed snapshot (metadata sanity)', async () => {
    const { loadCosingDataset } = await import('../src/lib/ingredient-safety/dataset');
    const ds = loadCosingDataset();
    assert.ok(ds.meta.rows > 20_000, `expected >20k rows, got ${ds.meta.rows}`);
    assert.equal(ds.meta.version, 'cosing-tsv-1');
  });

  it('resolves exact INCI names with functions and annex codes', () => {
    const linalool = lookupIngredient('Linalool');
    assert.equal(linalool.via, 'exact');
    assert.equal(linalool.record?.inci, 'LINALOOL');
    assert.ok(linalool.record?.functions?.includes('PERFUMING'));

    const hydroquinone = lookupIngredient('Hydroquinone');
    assert.ok(
      hydroquinone.record?.annexCodes.some((c) => c.annex === 'II'),
      'hydroquinone should carry an Annex II code in the snapshot',
    );
  });

  it('resolves common-name aliases to their INCI keys', () => {
    const water = lookupIngredient('water');
    assert.equal(water.record?.inci, 'AQUA');
    const coconut = lookupIngredient('coconut oil');
    assert.equal(coconut.record?.inci, 'COCOS NUCIFERA OIL');
    const vitaminE = lookupIngredient('Vitamin E');
    assert.equal(vitaminE.record?.inci, 'TOCOPHEROL');
  });

  it('resolves parenthetical annotations, incl. (WATER) style', () => {
    const aqua = lookupIngredient('AQUA (WATER)');
    assert.equal(aqua.record?.inci, 'AQUA');
    const shea = lookupIngredient('BUTYROSPERMUM PARKII (SHEA) BUTTER');
    assert.ok(shea.record);
  });
});

describe('EU overlay', () => {
  it('indexes the curated signals', () => {
    assert.ok(overlaySignalCount() > 150, `got ${overlaySignalCount()}`);
  });

  it('flags fragrance allergens (2003 + 2023 generations)', () => {
    for (const name of ['Linalool', 'Citral', 'Eugenol']) {
      assert.ok(
        lookupOverlay(normalizeInciToken(name)).some((m) => m.signal.code === 'eu-fragrance-allergen'),
        `${name} should be an EU allergen`,
      );
    }
    // 2023/1545 additions (effective for new products July 2026).
    for (const name of ['Vanillin', 'Methyl Salicylate', 'Menthol', 'Linalyl Acetate']) {
      assert.ok(
        lookupOverlay(normalizeInciToken(name)).some((m) => m.signal.code === 'eu-fragrance-allergen'),
        `${name} should be flagged by the 2023/1545 allergen list`,
      );
    }
  });

  it('flags post-2019 bans (Lilial) and leave-on-only comfort signals', () => {
    assert.ok(
      lookupOverlay(normalizeInciToken('Lilial')).some((m) => m.signal.tier === 'prohibited'),
    );
    const coconut = lookupOverlay(normalizeInciToken('Cocos Nucifera Oil'));
    const comedogenic = coconut.find((m) => m.signal.code === 'comedogenic-history');
    assert.ok(comedogenic?.signal.leaveOnOnly, 'comedogenicity must be leave-on-only');
  });
});

describe('product analysis', () => {
  it('is deterministic for identical input', () => {
    const text = 'Aqua, Glycerin, Niacinamide, Parfum, Linalool';
    const a = analyzeInciText(text, { form: 'leave-on' });
    const b = analyzeInciText(text, { form: 'leave-on' });
    assert.equal(JSON.stringify(a), JSON.stringify(b));
  });

  it('scores a simple recognisable leave-on list as excellent', () => {
    const r = analyzeInciText('Aqua, Glycerin, Niacinamide, Dimethicone, Phenoxyethanol', {
      form: 'leave-on',
    });
    assert.equal(r.coverage, 1);
    assert.equal(r.confidence, 'full');
    assert.ok(r.score !== null && r.score >= 90);
    assert.equal(r.band, 'excellent');
  });

  it('hard-caps and flags an EU-prohibited ingredient (hydroquinone)', () => {
    const r = analyzeInciText('Aqua, Glycerin, Hydroquinone, Cetearyl Alcohol', { form: 'leave-on' });
    const hq = r.ingredients.find((i) => i.tier === 'prohibited');
    assert.ok(hq, 'hydroquinone should be tier=prohibited');
    assert.equal(r.cappedReason, 'prohibited-ingredient');
    assert.ok(r.score !== null && r.score <= 35);
    assert.equal(r.band, 'avoid');
    assert.ok(r.flags.some((f) => f.level === 'error' && f.code === 'contains-prohibited'));
  });

  it('distinguishes leave-on MIT (not permitted) from rinse-off MIT (capped)', () => {
    const text = 'Aqua, Glycerin, Methylisothiazolinone, Parfum';
    const leaveOn = analyzeInciText(text, { form: 'leave-on' });
    const mit = leaveOn.ingredients.find((i) => i.normalized === 'METHYLISOTHIAZOLINONE');
    assert.equal(mit?.tier, 'restricted');
    assert.ok(leaveOn.flags.some((f) => f.code === 'eu-restricted-ingredients'));

    const rinseOff = analyzeInciText(text, { form: 'rinse-off' });
    const mitRinse = rinseOff.ingredients.find((i) => i.normalized === 'METHYLISOTHIAZOLINONE');
    assert.equal(mitRinse?.tier, 'watch');
  });

  it('flags EU fragrance allergens and generic parfum; rinse-off downgrades them', () => {
    const text = 'Aqua, Glycerin, Parfum, Linalool, Limonene';
    const leaveOn = analyzeInciText(text, { form: 'leave-on' });
    assert.ok(leaveOn.flags.some((f) => f.code === 'fragrance-generic'));
    assert.ok(leaveOn.flags.some((f) => f.code === 'fragrance-allergens'));
    const rinseOff = analyzeInciText(text, { form: 'rinse-off' });
    const linaloolRinse = rinseOff.ingredients.find((i) => i.normalized === 'LINALOOL');
    assert.equal(linaloolRinse?.tier, 'watch');
    assert.ok(
      (leaveOn.score ?? 0) < (rinseOff.score ?? 100),
      'rinse-off should score better than leave-on for the same fragrance allergens',
    );
  });

  it('applies comedogenic / drying-alcohol flags only to leave-on', () => {
    const text = 'Cocos Nucifera Oil, Isopropyl Myristate, Aqua, Glycerin';
    const leaveOn = analyzeInciText(text, { form: 'leave-on' });
    const oil = leaveOn.ingredients.find((i) => i.normalized === 'COCOS NUCIFERA OIL');
    assert.equal(oil?.tier, 'watch');
    assert.ok(oil?.signals.some((s) => s.code === 'comedogenic-history'));

    const rinseOff = analyzeInciText(text, { form: 'rinse-off' });
    const oilRinse = rinseOff.ingredients.find((i) => i.normalized === 'COCOS NUCIFERA OIL');
    assert.equal(oilRinse?.tier, 'clean');
  });

  it('never lets an unrecognized list read as excellent (coverage caps)', () => {
    const r = analyzeInciText('Aqua, Glycerin, Phlogiston Essence, Unobtainium Complex');
    assert.equal(r.confidence, 'limited');
    assert.ok(r.score !== null && r.score <= 64, `score ${r.score} must be capped`);
    assert.ok(r.band === 'moderate' || r.band === 'caution' || r.band === 'avoid');
    assert.ok(r.flags.some((f) => f.code === 'unknown-ingredients'));
  });

  it('returns null score when nothing is recognizable', () => {
    const r = analyzeIngredientList(['Phlogiston Essence', 'ZzzyXaa 1'], {});
    assert.equal(r.recognized, 0);
    assert.equal(r.score, null);
    assert.equal(r.band, null);
    assert.equal(r.confidence, 'limited');
  });

  it('blends toward a neutral score, never punishes, for partial coverage', () => {
    const r = analyzeInciText('Aqua, Glycerin, Niacinamide, UnknownBotanical X, MysteryPolymer Y');
    assert.ok(r.coverage > 0.3 && r.coverage < 0.9);
    assert.equal(r.confidence, 'partial');
  });
});

describe('inferProductForm', () => {
  it('infers rinse-off vs leave-on from OBF categories', () => {
    assert.equal(inferProductForm('Shampoos'), 'rinse-off');
    assert.equal(inferProductForm('Body washes'), 'rinse-off');
    assert.equal(inferProductForm('Face moisturizers'), 'leave-on');
    assert.equal(inferProductForm('Sunscreens'), 'leave-on');
    assert.equal(inferProductForm('Cosmetics'), 'unknown');
  });
});
