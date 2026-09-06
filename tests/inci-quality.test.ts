import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeInci, groupInciFlags } from '../src/lib/inci-quality';

describe('analyzeInci', () => {
  it('returns clean for an innocuous ingredient list', () => {
    const result = analyzeInci(['Aqua', 'Glycerin', 'Caprylic/Capric Triglyceride', 'Tocopherol']);
    assert.deepEqual(result, { total: 4, status: 'clean', flags: [] });
  });

  it('counts unique ingredients and ignores duplicates/blank entries', () => {
    const result = analyzeInci(['Aqua', 'AQUA', ' aQua ', '', '  ', 'Glycerin']);
    assert.equal(result.total, 2);
  });

  it('flags parabens (medium) and groups several paraben esters under one rule', () => {
    const result = analyzeInci(['Aqua', 'Propylparaben', 'Butylparaben']);
    assert.equal(result.status, 'caution');
    assert.equal(result.flags.length, 2);
    const groups = groupInciFlags(result.flags);
    assert.deepEqual(groups, [
      { key: 'paraben', severity: 'medium', incis: ['Propylparaben', 'Butylparaben'] },
    ]);
  });

  it('flags SLS/SLES sulfates', () => {
    const result = analyzeInci(['Sodium Lauryl Sulfate', 'Sodium Laureth Sulfate']);
    assert.deepEqual(groupInciFlags(result.flags).map((g) => g.key), ['sulfate']);
  });

  it('flags formaldehyde with high severity and concern status', () => {
    const result = analyzeInci(['Aqua', 'Formaldehyde', 'Parfum']);
    assert.equal(result.status, 'concern');
    const formaldehyde = result.flags.find((f) => f.key === 'formaldehyde');
    assert.equal(formaldehyde?.severity, 'high');
    // The medium fragrance flag coexists but does not upgrade the status beyond concern.
    assert.ok(result.flags.some((f) => f.key === 'fragrance'));
  });

  it('matches INCI names exactly: CETEARYL ALCOHOL must not flag as drying alcohol', () => {
    const result = analyzeInci(['Aqua', 'Cetearyl Alcohol', 'Behenyl Alcohol']);
    assert.equal(result.status, 'clean');
    assert.deepEqual(result.flags, []);
  });

  it('flags plain ALCOHOL and ALCOHOL DENAT.', () => {
    assert.deepEqual(
      groupInciFlags(analyzeInci(['Alcohol', 'Alcohol Denat.']).flags).map((g) => g.key),
      ['alcohol'],
    );
  });

  it('flags PARFUM/FRAGRANCE and common fragrance allergens under distinct rules', () => {
    const result = analyzeInci(['Parfum', 'Limonene', 'Linalool']);
    const groups = groupInciFlags(result.flags).map((g) => g.key);
    assert.deepEqual(groups, ['fragrance', 'fragranceAllergen']);
  });

  it('flags high-severity preservatives MIT/CMIT, resorcinol, hydroquinone, talc, UV filters', () => {
    const result = analyzeInci([
      'Methylisothiazolinone',
      'Methylchloroisothiazolinone',
      'Resorcinol',
      'Hydroquinone',
      'Oxybenzone',
      'Octocrylene',
      'Talc',
    ]);
    assert.equal(result.status, 'concern');
    // Groups follow rule priority order (high-severity rules first).
    const keys = groupInciFlags(result.flags).map((g) => g.key);
    assert.deepEqual(keys, ['hydroquinone', 'mit', 'resorcinol', 'uvFilter', 'talc']);
    assert.ok(result.flags.every((f) => f.severity === 'high'));
  });

  it('keeps the original INCI spelling in flags', () => {
    const result = analyzeInci(['  AQUA  ', 'parfum']);
    const flagged = result.flags.find((f) => f.key === 'fragrance');
    assert.equal(flagged?.inci, 'parfum');
  });

  it('returns clean for an empty list', () => {
    assert.deepEqual(analyzeInci([]), { total: 0, status: 'clean', flags: [] });
  });
});
