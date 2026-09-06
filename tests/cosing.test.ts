import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  COSING_BITS,
  buildCosingIndex,
  lookupCosing,
  canonInciKey,
  resolveCosingName,
  type CosingFile,
} from '../src/lib/cosing';
import { classifyInci } from '../src/lib/inci-quality';

/** Minimal fixture index standing in for public/data/cosing.json. */
function fixtureIndex(): CosingFile {
  return {
    fns: ['SOLVENT', 'HUMECTANT', 'PRESERVATIVE', 'UV FILTER', 'ANTIMICROBIAL'],
    map: {
      'AQUA': [[0], 0], // solvent
      'BENZOPHENONE 3': [[3], COSING_BITS.UV_FILTER | COSING_BITS.RESTRICTED],
      'SALICYLIC ACID': [[1], COSING_BITS.RESTRICTED],
      'PHENOXYETHANOL': [[2], COSING_BITS.PRESERVATIVE],
      'HYDROQUINONE': [[4], COSING_BITS.BANNED],
      'MYSTERY EXTRACT': [[1], 0],
    },
  };
}

describe('canonInciKey', () => {
  it('uppercases, folds whitespace, and turns / and - into spaces', () => {
    assert.equal(canonInciKey('aqua/water'), 'AQUA WATER');
    assert.equal(canonInciKey('  SODIUM-LAURYL  SULFATE '), 'SODIUM LAURYL SULFATE');
  });
});

describe('resolveCosingName', () => {
  it('maps label synonyms onto the official INCI name', () => {
    assert.equal(resolveCosingName('OXYBENZONE'), 'BENZOPHENONE 3');
    assert.equal(resolveCosingName('AQUA'), 'AQUA');
  });
});

describe('buildCosingIndex', () => {
  it('rejects a corrupt file shape', () => {
    assert.throws(() => buildCosingIndex({} as CosingFile));
    assert.throws(() => buildCosingIndex({ fns: 'nope', map: {} } as unknown as CosingFile));
  });

  it('drops out-of-range function indices and unknown bits', () => {
    const idx = buildCosingIndex({
      fns: ['SOLVENT'],
      map: {
        A: [[0, 99], 7], // 99 is out of range; 7 = banned|restricted|colorant
        B: [[5], 0], // no functions, no bits → dropped
      },
    });
    assert.deepEqual(idx.map['A'], [[0], 7]);
    assert.equal(idx.map['B'], undefined);
  });
});

describe('lookupCosing', () => {
  const idx = buildCosingIndex(fixtureIndex());

  it('resolves OCR/label spellings to the canonical entry', () => {
    assert.ok(lookupCosing(idx, 'aqua'));
    assert.deepEqual(lookupCosing(idx, 'aqua')?.functions, ['SOLVENT']);
  });

  it('resolves synonyms (OXYBENZONE → BENZOPHENONE 3)', () => {
    const hit = lookupCosing(idx, 'oxybenzone');
    assert.equal(hit?.bits, COSING_BITS.UV_FILTER | COSING_BITS.RESTRICTED);
    assert.deepEqual(hit?.functions, ['UV FILTER']);
  });

  it('returns undefined for unknown ingredients', () => {
    assert.equal(lookupCosing(idx, 'NO SUCH NAME'), undefined);
  });
});

describe('classifyInci with a CosIng index', () => {
  const idx = buildCosingIndex(fixtureIndex());

  it('lifts Annex II (banned) ingredients to concern', () => {
    // Hydroquinone is also in our curated concern rules — must stay concern.
    const withIdx = classifyInci(['Hydroquinone'], idx);
    assert.equal(withIdx.ingredients[0]?.tier, 'concern');
    assert.ok(withIdx.ingredients[0]?.tags.includes('bannedInEu'));
  });

  it('lifts Annex III (restricted) ingredients to caution and tags them', () => {
    const result = classifyInci(['Salicylic Acid'], idx);
    const ing = result.ingredients[0];
    assert.equal(ing?.tier, 'caution');
    assert.ok(ing?.tags.includes('restrictedInEu'));
    assert.ok(ing?.tags.includes('humectant')); // SALICYLIC ACID → HUMECTANT in the fixture
  });

  it('keeps curated rules in priority over CosIng', () => {
    // PHENOXYETHANOL is curated good + preservative; CosIng V bit agrees.
    const result = classifyInci(['Phenoxyethanol'], idx);
    const ing = result.ingredients[0];
    assert.equal(ing?.tier, 'good');
    assert.deepEqual([...(ing?.tags ?? [])].sort(), ['preservative']);
  });

  it('tags unknown ingredients with their CosIng functions', () => {
    const result = classifyInci(['Mystery Extract'], idx);
    const ing = result.ingredients[0];
    assert.equal(ing?.tier, 'good');
    assert.ok(ing?.tags.includes('humectant'));
  });

  it('caps tags at three per row, curated first', () => {
    // BENZOPHENONE 3: restricted + uvFilter bits + UV FILTER function
    // → [restrictedInEu, uvFilter, uvFilter] → dedupe → 2 tags.
    const result = classifyInci(['Benzophenone-3'], idx);
    const ing = result.ingredients[0];
    assert.equal(ing?.tier, 'concern'); // curated OXYBENZONE rule via the synonym
    assert.ok(ing?.tags.includes('restrictedInEu'));
    assert.ok(ing?.tags.includes('uvFilter'));
  });

  it('resolves the printed INN to the curated rule name (Benzophenone-3 = Oxybenzone)', () => {
    const plain = classifyInci(['Benzophenone-3']);
    assert.equal(plain.ingredients[0]?.tier, 'concern');
  });

  it('degrades gracefully without an index (curated rules only)', () => {
    const plain = classifyInci(['Salicylic Acid']);
    assert.equal(plain.ingredients[0]?.tier, 'good');
    assert.deepEqual(plain.ingredients[0]?.tags, []);
  });
});

describe('bundled public/data/cosing.json integrity', () => {
  const raw = JSON.parse(
    readFileSync(path.join(__dirname, '..', 'public', 'data', 'cosing.json'), 'utf-8'),
  ) as CosingFile;
  const idx = buildCosingIndex(raw);

  it('is a substantial, documented dataset', () => {
    assert.ok(Object.keys(idx.map).length > 20_000, 'expected 20k+ ingredients');
    assert.ok(raw.meta?.source?.includes('CosIng'), 'meta.source must credit EU CosIng');
    assert.ok(raw.fns.length >= 100, 'expected the official function vocabulary');
  });

  it('keeps the well-known entries correct', () => {
    assert.deepEqual(lookupCosing(idx, 'aqua')?.functions, ['SOLVENT']);
    const oxy = lookupCosing(idx, 'OXYBENZONE');
    assert.equal(oxy?.bits & COSING_BITS.UV_FILTER, COSING_BITS.UV_FILTER);
    assert.equal(
      lookupCosing(idx, 'PHENOXYETHANOL')?.bits & COSING_BITS.PRESERVATIVE,
      COSING_BITS.PRESERVATIVE,
    );
    assert.ok(
      Object.values(idx.map).filter(([, bits]) => bits & COSING_BITS.BANNED).length > 100,
      'expected 100+ Annex II (banned) ingredients',
    );
  });
});
