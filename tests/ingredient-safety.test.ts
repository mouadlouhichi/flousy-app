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

  it('supports Arabic and compatibility-width punctuation without dropping ingredient boundaries', () => {
    assert.deepEqual(splitInciList('ماء، جلسرين؛ عطر'), ['ماء', 'جلسرين', 'عطر']);
    assert.deepEqual(splitInciList('Aqua，Glycerin；Linalool'), ['Aqua', 'Glycerin', 'Linalool']);
  });

  it('expands nested parenthetical ingredient lists for mandatory row review', () => {
    assert.deepEqual(
      splitInciList('Aqua, Parfum (Linalool, Citral), Glycerin'),
      ['Aqua', 'Parfum', 'Linalool', 'Citral', 'Glycerin'],
    );
  });

  it('does not hide the suffix after an unmatched opening delimiter', () => {
    const parsed = splitInciList('Aqua, Glycerin (Parfum, Linalool, Hydroquinone');
    assert.ok(parsed.includes('Linalool'));
    assert.ok(parsed.includes('Hydroquinone'));
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
    assert.equal(ds.meta.version, 'ingredient-identity-2025-1175-v1');
    assert.equal(ds.meta.glossaryRows, 30_418);
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

  it('resolves the Lilial alias to current Annex II evidence and keeps comfort evidence context-bound', () => {
    const lilial = analyzeInciText('Lilial', { form: 'leave-on' }).ingredients[0];
    assert.equal(lilial?.matchedInci, 'BUTYLPHENYL METHYLPROPIONAL');
    assert.equal(lilial?.tier, 'prohibited');
    assert.ok(lilial?.signals.some((signal) => signal.regulatory?.legalRole === 'prohibited-list'));
    const coconut = lookupOverlay(normalizeInciToken('Cocos Nucifera Oil'));
    const comedogenic = coconut.find((m) => m.signal.code === 'comedogenic-history');
    assert.ok(comedogenic?.signal.leaveOnOnly, 'comfort evidence must be leave-on-only');
  });
});

describe('product analysis', () => {
  it('is deterministic for identical input and explicit assessment time', () => {
    const text = 'Aqua, Glycerin, Niacinamide, Parfum, Linalool';
    const options = { form: 'leave-on' as const, assessedAt: '2026-09-08T12:00:00.000Z' };
    assert.equal(JSON.stringify(analyzeInciText(text, options)), JSON.stringify(analyzeInciText(text, options)));
  });

  it('does not convert glossary identity into clean evidence or a positive score', () => {
    const result = analyzeInciText('Aqua, Glycerin, Niacinamide, Dimethicone', { form: 'leave-on' });
    assert.equal(result.coverage, 1);
    assert.equal(result.assessmentCoverage, 0);
    assert.ok(result.ingredients.every((item) => item.assessmentState === 'identified-no-assessment'));
    assert.ok(result.ingredients.every((item) => item.tier === null));
    assert.equal(result.score, null);
    assert.equal(result.band, null);
    assert.equal(result.scoreStatus, 'withheld-insufficient-evidence');
  });

  it('retains exact current Annex II evidence even when a numeric score is withheld', () => {
    for (const name of [
      'Quaternium-15',
      'Butylphenyl Methylpropional',
      'Trimethylbenzoyl Diphenylphosphine Oxide',
    ]) {
      const result = analyzeInciText(`Aqua, ${name}`, { form: 'leave-on' });
      const ingredient = result.ingredients[1];
      assert.equal(ingredient?.tier, 'prohibited', name);
      assert.ok(ingredient?.signals.some((signal) =>
        signal.regulatory?.annex === 'II' &&
        signal.regulatory.legalRole === 'prohibited-list' &&
        signal.applicability === 'applies'), name);
      assert.equal(result.score, null);
      assert.equal(result.band, null);
      assert.ok(result.flags.some((flag) => flag.code === 'eu-annex-ii-name-match'));
    }
  });

  it('matches the dated Annex II transition matrix for 4-MBC, Quaternium-15, and TPO', () => {
    const matrix = [
      ['4-Methylbenzylidene Camphor', '1730'],
      ['Quaternium-15', '1385'],
      ['Trimethylbenzoyl Diphenylphosphine Oxide', '1731'],
    ] as const;
    for (const [name, entry] of matrix) {
      const result = analyzeInciText(name, { form: 'leave-on' });
      const condition = result.ingredients[0]?.signals.find((signal) => signal.regulatory?.annex === 'II')?.regulatory;
      assert.equal(result.ingredients[0]?.tier, 'prohibited', name);
      assert.equal(condition?.entry, entry, name);
      assert.equal(condition?.effectiveAsOf, '2026-05-26', name);
      assert.equal(condition?.sourceUrl, 'https://eur-lex.europa.eu/eli/reg/2009/1223/2026-05-18/eng', name);
    }
  });

  it('keeps conditional Triclosan and Triclocarban entries out of universal prohibition', () => {
    const triclosan = analyzeInciText('Triclosan', { form: 'leave-on' });
    assert.equal(triclosan.ingredients[0]?.tier, 'restricted');
    assert.ok(triclosan.ingredients[0]?.signals.some((signal) => (
      signal.regulatory?.annex === 'V' &&
      signal.regulatory.entry === '25' &&
      signal.applicability === 'conditions-unknown'
    )));
    assert.equal(triclosan.scoreStatus, 'withheld-conditions-unknown');

    const triclocarban = analyzeInciText('Triclocarban', { form: 'rinse-off' });
    assert.equal(triclocarban.ingredients[0]?.tier, 'restricted');
    assert.ok(triclocarban.ingredients[0]?.signals.some((signal) => (
      signal.regulatory?.annex === 'III' && signal.regulatory.entry === '100'
    )));
    assert.ok(triclocarban.ingredients[0]?.signals.some((signal) => (
      signal.regulatory?.annex === 'V' && signal.regulatory.entry === '23'
    )));
    assert.ok(triclocarban.ingredients[0]?.signals.every((signal) => signal.applicability === 'conditions-unknown'));
    assert.equal(triclocarban.scoreStatus, 'withheld-conditions-unknown');
  });

  it('represents 2024 concentration/use restrictions without resolving missing formulation facts', () => {
    const matrix = [
      ['Retinol', '376'],
      ['Genistein', '373'],
      ['Daidzein', '374'],
      ['Kojic Acid', '375'],
      ['Alpha-Arbutin', '377'],
      ['Arbutin', '378'],
    ] as const;
    for (const form of ['leave-on', 'rinse-off'] as const) {
      for (const [name, entry] of matrix) {
        const result = analyzeInciText(name, { form });
        const signal = result.ingredients[0]?.signals.find((item) => item.regulatory?.entry === entry);
        assert.equal(result.ingredients[0]?.tier, 'restricted', `${name} (${form})`);
        assert.equal(signal?.regulatory?.annex, 'III', `${name} (${form})`);
        assert.equal(signal?.applicability, 'conditions-unknown', `${name} (${form})`);
        assert.equal(result.score, null, `${name} (${form})`);
        assert.equal(result.scoreStatus, 'withheld-conditions-unknown', `${name} (${form})`);
      }
    }
  });

  it('does not replace the unsupported DINP blanket claim with a positive verdict', () => {
    const result = analyzeInciText('Diisononyl Phthalate', { form: 'leave-on' });
    const ingredient = result.ingredients[0];
    assert.equal(ingredient?.identity.status, 'official-glossary');
    assert.equal(ingredient?.tier, null);
    assert.equal(ingredient?.assessmentState, 'identified-no-assessment');
    assert.equal(ingredient?.signals.some((signal) => signal.regulatory?.legalRole === 'prohibited-list'), false);
    assert.equal(result.score, null);
    assert.equal(result.scoreStatus, 'withheld-insufficient-evidence');
  });

  it('preserves Hydroquinone exception/use conditions instead of issuing a blanket compliance verdict', () => {
    const result = analyzeInciText('Aqua, Hydroquinone', { form: 'leave-on' });
    const ingredient = result.ingredients[1];
    assert.equal(ingredient?.tier, 'restricted');
    assert.ok(ingredient?.signals.some((signal) => signal.applicability === 'conditions-unknown'));
    assert.equal(result.scoreStatus, 'withheld-conditions-unknown');
    assert.equal(result.score, null);
    assert.ok(result.flags.some((flag) => flag.code === 'regulatory-conditions-unknown'));
  });

  it('does not infer concentration-dependent MIT or fragrance compliance from label order', () => {
    for (const form of ['leave-on', 'rinse-off'] as const) {
      const result = analyzeInciText('Aqua, Methylisothiazolinone, Linalool', { form });
      assert.equal(result.score, null);
      assert.equal(result.scoreStatus, 'withheld-conditions-unknown');
      assert.ok(result.ingredients.slice(1).every((item) =>
        item.signals.some((signal) => signal.applicability === 'conditions-unknown')));
    }
  });

  it('applies context-bound comfort evidence only for leave-on products', () => {
    const text = 'Cocos Nucifera Oil';
    const leaveOn = analyzeInciText(text, { form: 'leave-on' });
    assert.equal(leaveOn.ingredients[0]?.tier, 'watch');
    assert.ok(leaveOn.ingredients[0]?.signals.some((signal) => signal.code === 'comedogenic-history'));
    const rinseOff = analyzeInciText(text, { form: 'rinse-off' });
    assert.equal(rinseOff.ingredients[0]?.tier, null);
    assert.equal(rinseOff.ingredients[0]?.assessmentState, 'identified-no-assessment');
  });

  it('withholds a score for unknown form and insufficient assessed-evidence coverage', () => {
    const unknownForm = analyzeInciText('Cocos Nucifera Oil');
    assert.equal(unknownForm.scoreStatus, 'withheld-form-unknown');
    assert.equal(unknownForm.score, null);

    const partial = analyzeInciText('Aqua, Glycerin, Cocos Nucifera Oil, Mystery Polymer', {
      form: 'leave-on',
    });
    assert.ok(partial.coverage > 0.5 && partial.coverage < 1);
    assert.ok(partial.assessmentCoverage < 0.8);
    assert.equal(partial.scoreStatus, 'withheld-insufficient-evidence');
    assert.equal(partial.score, null);
  });

  it('requires explicit review before any OCR-derived score can be available', () => {
    const draft = analyzeInciText('Cocos Nucifera Oil', {
      form: 'leave-on',
      source: 'ocr',
      reviewed: false,
    });
    assert.equal(draft.score, null);
    assert.equal(draft.scoreStatus, 'withheld-review-required');
    assert.ok(draft.flags.some((flag) => flag.code === 'ocr-review-required'));
  });
});

describe('external provider evidence', () => {
  const vendorEvidence = new Map([
    [
      'PHLOGISTON ESSENCE',
      {
        provider: 'Example evidence provider',
        reportedName: 'PHLOGISTON ESSENCE',
        verdict: 'safe',
        found: true,
        informationalOnly: true as const,
      },
    ],
  ]);

  it('keeps the pure-local result bit-identical when no map is supplied', () => {
    const text = 'Aqua, Phlogiston Essence, Unobtainium Complex';
    const plain = analyzeInciText(text, { form: 'leave-on' });
    assert.equal(JSON.stringify(plain), JSON.stringify(analyzeInciText(text, { form: 'leave-on' })));
    assert.ok(!plain.vendorEnriched);
  });

  it('retains attributed provider output without converting it to local recognition or a verdict', () => {
    const text = 'Aqua, Glycerin, Phlogiston Essence';
    const plain = analyzeInciText(text, { form: 'leave-on' });
    const enriched = analyzeInciText(text, { form: 'leave-on', vendorEvidence });

    assert.equal(enriched.localRecognized, plain.localRecognized);
    assert.equal(enriched.externallyIdentified, 1);
    assert.equal(enriched.recognized, plain.recognized + 1);
    assert.ok(enriched.coverage > plain.coverage);
    assert.equal(enriched.assessmentCoverage, plain.assessmentCoverage);
    assert.equal(enriched.score, plain.score);
    assert.equal(enriched.band, plain.band);
    assert.ok(!enriched.unknownIngredients.includes('Phlogiston Essence'));
    const phlogiston = enriched.ingredients.find((i) => i.raw === 'Phlogiston Essence');
    assert.equal(phlogiston?.tier, null);
    assert.equal(phlogiston?.assessmentState, 'externally-identified');
    assert.deepEqual(phlogiston?.externalEvidence, [vendorEvidence.get('PHLOGISTON ESSENCE')]);
    assert.ok(enriched.vendorEnriched);
  });

  it('never lets provider output change a local regulatory assessment', () => {
    const text = 'Aqua, Hydroquinone';
    const plain = analyzeInciText(text, { form: 'leave-on' });
    const provider = new Map([
      ['HYDROQUINONE', {
        provider: 'Untrusted provider',
        reportedName: 'HYDROQUINONE',
        verdict: 'safe',
        informationalOnly: true as const,
      }],
    ]);
    const enriched = analyzeInciText(text, { form: 'leave-on', vendorEvidence: provider });
    assert.equal(enriched.score, plain.score);
    assert.equal(enriched.band, plain.band);
    assert.equal(enriched.worstTier, plain.worstTier);
    assert.equal(enriched.ingredients[1]?.tier, plain.ingredients[1]?.tier);
    assert.equal(enriched.ingredients[1]?.externalEvidence?.[0]?.verdict, 'safe');
  });

  it('ignores provider entries for names the map does not cover', () => {
    const r = analyzeInciText('Aqua, Unobtainium Complex', {
      form: 'leave-on',
      vendorEvidence,
    });
    assert.equal(r.recognized, 1);
    assert.ok(r.unknownIngredients.includes('Unobtainium Complex'));
    assert.equal(r.ingredients[1]?.externalEvidence, undefined);
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
