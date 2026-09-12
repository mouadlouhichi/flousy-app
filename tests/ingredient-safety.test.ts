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

/** A listed restriction may never be averaged into a clean-looking index. */
function resultIsCappedAtRestriction(score: number | null): boolean {
  return typeof score === 'number' && score <= 59;
}

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

  it('publishes a fully read clean list as a no-listed-finding result, never as a safety certificate', () => {
    const result = analyzeInciText('Aqua, Glycerin, Niacinamide, Dimethicone', { form: 'leave-on' });
    assert.equal(result.coverage, 1);
    assert.equal(result.assessmentCoverage, 0);
    assert.ok(result.ingredients.every((item) => item.assessmentState === 'identified-no-assessment'));
    assert.ok(result.ingredients.every((item) => item.tier === null));
    // The whole label was read and nothing matched, so the index is published…
    assert.equal(result.score, 100);
    assert.equal(result.band, 'excellent');
    assert.equal(result.scoreStatus, 'available');
    // …but the absence of a match is stated as what it is, and it never reads
    // as strong as a label whose rows were actively assessed.
    assert.ok(result.flags.some((flag) => flag.code === 'no-listed-signal'));
    assert.equal(result.confidence, 'partial');
  });

  it('withholds a clean verdict on a label the corpus only partly read', () => {
    // Coverage clears the 0.6 publication gate, but a third of the list is
    // unidentified and no row carries a finding: the missing rows could hold
    // it, so "nothing matched" is not publishable.
    const result = analyzeInciText(
      'Aqua, Glycerin, Niacinamide, Dimethicone, Zzz Mystery Polymer, Qqq Unknown Resin',
      { form: 'leave-on' },
    );
    assert.ok(result.coverage >= 0.6 && result.coverage < 0.9);
    assert.equal(result.assessmentCoverage, 0);
    assert.equal(result.scoreStatus, 'withheld-insufficient-evidence');
    assert.equal(result.score, null);
  });

  it('publishes the worst-band index for an exact Annex II match and keeps the verify flag', () => {
    // An unconditional Annex II name match is the one case where the dated
    // corpus states a prohibition directly, so withholding the index would hide
    // the finding. The score is floored at the prohibition cap and the
    // "verify identity/exceptions" flag stays visible: a name match is still
    // not a product-compliance determination.
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
      assert.equal(result.score, 35, `${name} is floored at the prohibition cap`);
      assert.equal(result.band, 'avoid', name);
      assert.equal(result.worstTier, 'prohibited', name);
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
    // The Annex V/25 authorisation is preserved with its unresolved
    // conditions, and the published EU hazard assessment keeps the row out of
    // the reassuring "authorised preservative" bucket.
    assert.ok(triclosan.ingredients[0]?.signals.some((signal) => (
      signal.regulatory?.annex === 'V' &&
      signal.regulatory.entry === '25' &&
      signal.regulatory.legalRole === 'positive-list-with-conditions'
    )));
    assert.ok(triclosan.ingredients[0]?.signals.some((signal) => signal.code === 'published-hazard-assessment'));
    assert.ok(!triclosan.ingredients[0]?.signals.some((signal) => signal.regulatory?.legalRole === 'prohibited-list'));
    // Annex V/25 lists rinse-off-type product types only, so a leave-on
    // declaration is resolved as "not covered by the authorisation" — without
    // turning that into a prohibition claim.
    assert.equal(triclosan.ingredients[0]?.tier, 'restricted');
    assert.ok(triclosan.flags.some((flag) => flag.code === 'positive-list-form-conflict'));
    assert.equal(triclosan.scoreStatus, 'available');

    // In a rinse-off context the same annex entry has no form conflict, so the
    // unresolved concentration stays a caveat.
    const triclosanRinse = analyzeInciText('Triclosan', { form: 'rinse-off' });
    assert.ok(triclosanRinse.ingredients[0]?.signals.some((signal) => (
      signal.regulatory?.entry === '25' && signal.applicability === 'conditions-unknown'
    )));
    assert.equal(triclosanRinse.scoreStatus, 'available-with-unresolved-conditions');

    const triclocarban = analyzeInciText('Triclocarban', { form: 'rinse-off' });
    assert.equal(triclocarban.ingredients[0]?.tier, 'restricted');
    assert.ok(triclocarban.ingredients[0]?.signals.some((signal) => (
      signal.regulatory?.annex === 'III' && signal.regulatory.entry === '100'
    )));
    assert.ok(triclocarban.ingredients[0]?.signals.some((signal) => (
      signal.regulatory?.annex === 'V' && signal.regulatory.entry === '23'
    )));
    assert.ok(triclocarban.ingredients[0]?.signals.some((signal) => signal.applicability === 'conditions-unknown'));
    assert.equal(triclocarban.scoreStatus, 'available-with-unresolved-conditions');
    assert.ok(triclocarban.score !== null);
    assert.ok(resultIsCappedAtRestriction(triclocarban.score));
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
        // The concentration/use condition stays unresolved — it is published as
        // a caveat with reduced confidence instead of being silently resolved.
        assert.equal(result.scoreStatus, 'available-with-unresolved-conditions', `${name} (${form})`);
        assert.equal(result.confidence, 'partial', `${name} (${form})`);
        assert.ok(result.score !== null, `${name} (${form})`);
        assert.ok(resultIsCappedAtRestriction(result.score), `${name} (${form})`);
        assert.ok(result.flags.some((flag) => flag.code === 'regulatory-conditions-unknown'));
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
    // The outcome is "no listed finding on the dated corpus", not "DINP is
    // safe": no tier, an explicit caveat flag, and capped confidence.
    assert.equal(result.ingredients[0]?.tier, null);
    assert.equal(result.scoreStatus, 'available');
    assert.ok(result.flags.some((flag) => flag.code === 'no-listed-signal'));
    assert.equal(result.confidence, 'partial');
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
      // No row may be promoted to "resolved and compliant": a row either keeps
      // its unresolved EU condition or resolves to a listed form conflict.
      assert.ok(result.ingredients.slice(1).every((item) =>
        item.signals.some((signal) => signal.applicability === 'conditions-unknown')
        || item.signals.some((signal) => signal.regulatory?.legalRole === 'positive-list-with-conditions' && signal.applicability === 'applies')));
      // Linalool's Annex III concentration is never inferred from label order.
      const linalool = result.ingredients[2];
      assert.ok(linalool?.signals.some((signal) => signal.applicability === 'conditions-unknown'));
      // Conditions remain unresolved — the index is published with a caveat,
      // never as a statement that the concentration is compliant.
      assert.equal(result.scoreStatus, 'available-with-unresolved-conditions');
      assert.ok(result.score !== null);
      // A restriction on the label may never be averaged into a clean result.
      assert.ok(resultIsCappedAtRestriction(result.score));
    }
    // The rinse-off-only Annex V/57 wording resolves the leave-on case: the
    // dated annex does not cover a leave-on use, which is a listed fact and not
    // a compliance verdict.
    const mit = analyzeInciText('Aqua, Methylisothiazolinone', { form: 'leave-on' });
    const mitSignal = mit.ingredients[1]?.signals.find((signal) => signal.regulatory?.entry === '57');
    assert.equal(mitSignal?.applicability, 'applies');
    assert.equal(mitSignal?.regulatory?.legalRole, 'positive-list-with-conditions');
    assert.equal(mit.ingredients[1]?.tier, 'restricted');
    assert.ok(mit.flags.some((flag) => flag.code === 'positive-list-form-conflict'));
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

  it('withholds a score for unknown form and for lists the corpus cannot read', () => {
    const unknownForm = analyzeInciText('Cocos Nucifera Oil');
    assert.equal(unknownForm.scoreStatus, 'withheld-form-unknown');
    assert.equal(unknownForm.score, null);

    // Identity coverage, not signal coverage, is the gate: three of four rows
    // are identified and one carries a listed signal, so the index is
    // published — capped, because coverage is incomplete.
    const partial = analyzeInciText('Aqua, Glycerin, Cocos Nucifera Oil, Mystery Polymer', {
      form: 'leave-on',
    });
    assert.ok(partial.coverage > 0.5 && partial.coverage < 1);
    assert.ok(partial.assessmentCoverage < 0.8);
    assert.ok(partial.score !== null);
    assert.ok((partial.score ?? 100) <= 94, 'partial coverage may not read as clean');
    assert.equal(partial.confidence, 'partial');

    // A list the dated corpus cannot describe at all is still withheld.
    const unreadable = analyzeInciText('Aqua, Zzz Unobtainium Complex, Qqq Mystery Polymer', {
      form: 'leave-on',
    });
    assert.ok(unreadable.coverage < 0.6);
    assert.equal(unreadable.scoreStatus, 'withheld-insufficient-evidence');
    assert.equal(unreadable.score, null);
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

describe('ingredient analysis boundaries', () => {
  it('rejects oversized raw, pre-split, and context input at the core boundary', () => {
    assert.throws(() => analyzeInciText('A'.repeat(12_001)), /ingredient text is too long/);
    assert.throws(
      () => analyzeIngredientList(new Array(301).fill('Aqua')),
      /ingredient list is too long/,
    );
    assert.throws(
      () => analyzeInciText('Aqua', { label: 'A'.repeat(201) }),
      /ingredient analysis context is too long/,
    );
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

  it('keeps the explicit leave-on phrases ahead of generic rinse-off wording', () => {
    assert.equal(inferProductForm(undefined, 'Leave-in conditioner'), 'leave-on');
    assert.equal(inferProductForm(undefined, 'After shave balm'), 'leave-on');
    assert.equal(inferProductForm(undefined, 'Hair conditioner'), 'rinse-off');
  });

  it('does not let broad leave-on words capture wash-off products', () => {
    // "face"/"body" alone are leave-on cues, but the strong rinse-off wording
    // is checked first, so a wash product never becomes leave-on.
    assert.equal(inferProductForm(undefined, 'Face wash'), 'rinse-off');
    assert.equal(inferProductForm(undefined, 'Body wash'), 'rinse-off');
    assert.equal(inferProductForm(undefined, 'Cleansing milk'), 'rinse-off');
    assert.equal(inferProductForm(undefined, 'Face cream'), 'leave-on');
    assert.equal(inferProductForm(undefined, 'Body milk'), 'leave-on');
  });

  it('reads the common local-language wording on Moroccan shelves', () => {
    assert.equal(inferProductForm(undefined, 'شامبو بالأرغان'), 'rinse-off');
    assert.equal(inferProductForm(undefined, 'صابون الغار'), 'rinse-off');
    assert.equal(inferProductForm(undefined, 'كريم مرطب لليدين'), 'leave-on');
    assert.equal(inferProductForm('Soins du visage', 'Crème hydratante'), 'leave-on');
    assert.equal(inferProductForm('Gels douche', undefined), 'rinse-off');
  });
});

describe('ranked risk drivers — deduction transparency (ingredient-evidence-v3)', () => {
  it('records each row’s index contribution next to its tier', () => {
    const r = analyzeIngredientList(
      ['Quaternium-15', 'Parfum', 'Linalool', 'Aqua', 'Glycerin'],
      { form: 'leave-on' },
    );
    const quaternium = r.ingredients.find((i) => i.raw === 'Quaternium-15');
    assert.equal(quaternium?.tier, 'prohibited');
    // Regulatory signals carry full weight — the full penalty is recorded.
    assert.equal(quaternium?.deduction, 100);
    // Identified rows without a signal never contribute.
    assert.equal(r.ingredients.find((i) => i.raw === 'Aqua')?.deduction, undefined);
    // Curated signals are position-weighted and still recorded.
    const parfum = r.ingredients.find((i) => i.raw === 'Parfum');
    assert.ok((parfum?.deduction ?? 0) > 0);
    assert.ok((parfum?.deduction ?? 0) < 22, 'position weighting must reduce the curated penalty');
  });

  it('keeps row deductions informational while the score itself is withheld', () => {
    const r = analyzeIngredientList(['Quaternium-15'], { form: 'unknown' });
    // Withholding applies to the numeric index only: rows keep their tier and
    // their recorded contribution, and the UI never ranks them without a score.
    assert.equal(r.score, null);
    const quaternium = r.ingredients.find((i) => i.raw === 'Quaternium-15');
    assert.equal(quaternium?.tier, 'prohibited');
    assert.equal(quaternium?.deduction, 100);
  });
});

describe('cosmetic alias expansion (ingredient-evidence-v3)', () => {
  it('resolves common trade names and French label wording to glossary identity', () => {
    const r = analyzeIngredientList(
      ['Witch Hazel', 'Rose Water', 'Honey', 'Colloidal Oatmeal', 'Green Tea', 'Lavender Oil', 'Tea Tree Oil', 'Vitamin A Palmitate', 'Vitamin E Acetate'],
      { form: 'leave-on' },
    );
    const canonical = new Map(r.ingredients.map((i) => [i.raw, i.matchedInci]));
    assert.equal(canonical.get('Witch Hazel'), 'HAMAMELIS VIRGINIANA WATER');
    assert.equal(canonical.get('Rose Water'), 'ROSA DAMASCENA FLOWER WATER');
    assert.equal(canonical.get('Honey'), 'MEL');
    assert.equal(canonical.get('Colloidal Oatmeal'), 'AVENA SATIVA KERNEL EXTRACT');
    assert.equal(canonical.get('Green Tea'), 'CAMELLIA SINENSIS LEAF EXTRACT');
    assert.equal(canonical.get('Lavender Oil'), 'LAVANDULA ANGUSTIFOLIA OIL');
    assert.equal(canonical.get('Tea Tree Oil'), 'MELALEUCA ALTERNIFOLIA LEAF OIL');
    assert.equal(canonical.get('Vitamin A Palmitate'), 'RETINYL PALMITATE');
    assert.equal(canonical.get('Vitamin E Acetate'), 'TOCOPHERYL ACETATE');
    // Aliases expand identity only — a neutral alias set must not invent tiers.
    assert.ok(!r.ingredients.some((i) => i.tier === 'prohibited'), 'neutral aliases must stay verdict-free');
  });

  it('resolves French and Arabic cosmetic label wording', () => {
    const r = analyzeIngredientList(
      ['Glycérine Végétale', 'Huile d’olive', 'Beurre de cacao', 'Acide hyaluronique', 'زيت الزيتون', 'زيت جوز الهند'],
      { form: 'leave-on' },
    );
    assert.equal(r.recognized, r.total, `expected full alias recognition, unknown: ${r.ingredients.filter((i) => !i.matched).map((i) => i.raw).join(', ')}`);
  });
});

describe('production scoring readiness (ingredient-evidence-v4)', () => {
  /** Realistic supermarket labels. Before v4 every one of these returned a
   *  withheld index: any unresolved EU condition — i.e. any ordinary
   *  preservative — blocked the score, so the feature showed no number for
   *  real products. */
  const REAL_LABELS: Array<{ name: string; form: 'leave-on' | 'rinse-off'; text: string }> = [
    {
      name: 'Nivea-style cream',
      form: 'leave-on',
      text:
        'Aqua, Paraffinum Liquidum, Glycerin, Cera Microcristallina, Cetyl Alcohol, ' +
        'Sodium Carbomer, Phenoxyethanol, Methylparaben, Parfum, Linalool, Limonene, ' +
        'Citronellol, Geraniol',
    },
    {
      name: 'Garnier-style shampoo',
      form: 'rinse-off',
      text:
        'Aqua, Sodium Laureth Sulfate, Coco-Betaine, Glycerin, Sodium Chloride, Parfum, ' +
        'Citric Acid, Sodium Benzoate, Salicylic Acid, Limonene, Linalool, Hexyl Cinnamal',
    },
    {
      name: 'Sunscreen',
      form: 'leave-on',
      text:
        'Aqua, Homosalate, Octocrylene, Ethylhexyl Salicylate, Butyl Methoxydibenzoylmethane, ' +
        'Glycerin, Propanediol, Silica, Tocopherol, Phenoxyethanol, Caprylyl Glycol, Parfum',
    },
    {
      name: 'Argan cream',
      form: 'leave-on',
      text:
        'Aqua, Argania Spinosa Kernel Oil, Glyceryl Stearate, Cetearyl Alcohol, Glycerin, ' +
        'Butyrospermum Parkii Butter, Phenoxyethanol, Ethylhexylglycerin, Parfum, Tocopheryl Acetate',
    },
    {
      name: 'Syndet bar',
      form: 'rinse-off',
      text:
        'Sodium Lauroyl Isethionate, Stearic Acid, Sodium Palmitate, Lauric Acid, Aqua, ' +
        'Sodium Isethionate, Cocamidopropyl Betaine, Parfum, Glycerin, Sodium Chloride, ' +
        'Zinc Oxide, Tetrasodium EDTA, Citric Acid, Sodium Benzoate',
    },
  ];

  it('publishes an index for realistic supermarket cosmetics', () => {
    for (const label of REAL_LABELS) {
      const result = analyzeInciText(label.text, { label: label.name, form: label.form });
      assert.ok(result.score !== null, `${label.name} must be scoreable`);
      assert.ok(result.band !== null, `${label.name} must carry a band`);
      assert.ok(
        result.scoreStatus === 'available'
          || result.scoreStatus === 'available-with-unresolved-conditions',
        `${label.name}: ${result.scoreStatus}`,
      );
      assert.ok(result.total > 0 && result.recognized === result.total,
        `${label.name}: identity coverage ${result.recognized}/${result.total}`);
    }
  });

  it('ranks a heavily flagged label below a lightly flagged one', () => {
    const scores = REAL_LABELS.map((label) => ({
      name: label.name,
      score: analyzeInciText(label.text, { label: label.name, form: label.form }).score as number,
    }));
    const cream = scores.find((entry) => entry.name === 'Nivea-style cream')?.score ?? 100;
    const argan = scores.find((entry) => entry.name === 'Argan cream')?.score ?? 0;
    assert.ok(cream < argan, `parabens + four allergens (${cream}) must rank below a simple cream (${argan})`);
  });

  it('treats an EU positive-list entry as authorised-with-conditions, not a restriction', () => {
    const result = analyzeInciText('Aqua, Phenoxyethanol', { form: 'leave-on' });
    const signal = result.ingredients[1]?.signals[0];
    assert.equal(signal?.regulatory?.legalRole, 'positive-list-with-conditions');
    assert.equal(signal?.regulatory?.annex, 'V');
    assert.equal(result.ingredients[1]?.tier, 'watch');
    const banned = analyzeInciText('Aqua, Quaternium-15', { form: 'leave-on' });
    // A prohibited-list match still outweighs an authorised preservative.
    assert.ok((banned.score ?? 100) < (result.score ?? 0));
  });

  it('never lets a partially recognised list read as a clean result', () => {
    const partial = analyzeInciText('Aqua, Glycerin, Cocos Nucifera Oil, Unobtainium Complex', {
      form: 'leave-on',
    });
    assert.ok(partial.coverage < 0.9);
    assert.ok((partial.score ?? 100) <= 94);
    // Full coverage with the same signals is allowed to read higher.
    const full = analyzeInciText('Aqua, Glycerin, Cocos Nucifera Oil, Caprylic/Capric Triglyceride', {
      form: 'leave-on',
    });
    assert.ok((full.score ?? 0) > (partial.score ?? 100));
  });

  it('keeps the aggregate monotonic instead of saturating at zero', () => {
    const scoreFor = (text: string) => analyzeInciText(text, { form: 'leave-on' }).score ?? 0;
    const one = scoreFor('Aqua, Linalool');
    const two = scoreFor('Aqua, Linalool, Limonene');
    const four = scoreFor('Aqua, Linalool, Limonene, Citronellol, Geraniol');
    assert.ok(one > two && two > four, `${one} > ${two} > ${four}`);
    assert.ok(four > 0, 'a worse list must stay rankable against an even worse one');
  });

  it('still withholds the index when the list cannot be read or a ban is unresolved', () => {
    // A fully read list with no finding is published — see the clean-label rule.
    assert.equal(
      analyzeInciText('Aqua, Glycerin', { form: 'leave-on' }).scoreStatus,
      'available',
    );
    // Mostly unreadable.
    assert.equal(
      analyzeInciText('Aqua, Zzz Mystery Polymer, Qqq Unknown Resin', { form: 'leave-on' }).scoreStatus,
      'withheld-insufficient-evidence',
    );
    // Product form drives leave-on-only evidence and stays an explicit choice.
    assert.equal(analyzeInciText('Cocos Nucifera Oil').scoreStatus, 'withheld-form-unknown');
  });
});

describe('deployment data tracing', () => {
  it('traces every dataset the analysis route opens at runtime', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const loader = readFileSync(
      join(process.cwd(), 'src', 'lib', 'ingredient-safety', 'dataset.ts'),
      'utf8',
    );
    const config = readFileSync(join(process.cwd(), 'next.config.mjs'), 'utf8');
    const paths: string[] = [];
    for (const match of loader.matchAll(/join\(process\.cwd\(\),\s*((?:'[^']*',?\s*)+)\)/g)) {
      paths.push([...match[1].matchAll(/'([^']*)'/g)].map((part) => part[1]).join('/'));
    }
    assert.ok(paths.length > 0, 'the loader should open at least one dataset');
    for (const relative of paths) {
      assert.ok(
        config.includes(`./${relative}`),
        `${relative} is read at runtime but is not traced in next.config.mjs — deploys would 503`,
      );
    }
  });
});
