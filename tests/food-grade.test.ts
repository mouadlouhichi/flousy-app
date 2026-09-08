import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFoodText } from '../src/lib/food-knowledge/analyze';
import {
  additiveGrade,
  foodLabelGrade,
  FOOD_GRADE_AVOID_CAP,
  FOOD_GRADE_HIGH_CONCERN_CAP,
  gradeBandFor,
} from '../src/lib/food-knowledge/grade';

describe('food label-signal grade', () => {
  it('starts plain foods at 100 / excellent (no E-numbers)', () => {
    const r = analyzeFoodText('Lait de vache pasteurisé, crème fraîche, ferments lactiques, sel');
    assert.equal(r.additives.length, 0);
    assert.deepEqual(additiveGrade(r), { score: 100, band: 'excellent' });
  });

  it('drops the Dutch crisps list to 55 / caution for its THREE watch flavour enhancers', () => {
    const r = analyzeFoodText(
      [
        'Gedehydrateerde aardappelen',
        'zonnebloemolie',
        'TARWEMEEL',
        'maïsmeel',
        'rijstbloem',
        'paprikakruiderij (suiker, paprikapoeder, smaakversterkers {mononatriumglutamaat, natriumguanylaat, dinatriuminosinaat}, dextrose, gistpoeder, uienpoeder, zout, zoet weipoeder MELK)',
        'maltodextrine',
        'emulgator (E471)',
        'zout',
        'kleurstof (annatto norbixine)',
      ].join(', '),
    );
    // MSG (E621) AND its usual companions sodium guanylate (E627) and
    // disodium inosinate (E631) are all named in the seasoning sub-list and
    // all flagged watch — none may be dropped. E471/E160b stay neutral.
    assert.deepEqual(
      r.additives.map((a) => a.code).sort(),
      ['E160b', 'E471', 'E621', 'E627', 'E631'],
    );
    assert.equal(r.additives.filter((a) => a.band === 'watch').length, 3);
    // 100 − 3 × 15 = 55 → caution.
    assert.deepEqual(additiveGrade(r), { score: 55, band: 'caution' });
  });

  it('penalizes several watch additives harder', () => {
    const r = analyzeFoodText('Eau, acide citrique, benzoate de sodium (E211), glutamate monosodique (E621), tartrazine (E102)');
    // watch: E211, E621, E102 → 100 − 45 = 55 → caution
    assert.equal(r.additives.filter((a) => a.band === 'watch').length, 3);
    assert.deepEqual(additiveGrade(r), { score: 55, band: 'caution' });
  });

  it('never lets a banned (avoid) additive read as anything better than avoid', () => {
    const r = analyzeFoodText('Bonbon: sucre, sirop de glucose, dioxyde de titane (E171)');
    const avoid = r.additives.find((a) => a.code === 'E171');
    assert.equal(avoid?.band, 'avoid');
    const grade = additiveGrade(r);
    assert.ok(grade, 'grade computed');
    assert.ok(grade.score <= FOOD_GRADE_AVOID_CAP);
    assert.equal(grade.band, 'avoid');
  });

  it('penalizes explicit partially hydrogenated oil wording outside the E-number bucket', () => {
    const r = analyzeFoodText(
      'Whole grain oats, vegetable oil (partially hydrogenated cottonseed and/or soybean oil), almonds',
    );
    assert.equal(r.additives.length, 0);
    assert.equal(r.concerns[0]?.code, 'partially-hydrogenated-oil');
    const grade = foodLabelGrade(r);
    assert.ok(grade, 'grade computed');
    assert.ok(grade.score <= FOOD_GRADE_HIGH_CONCERN_CAP);
    assert.equal(grade.band, 'caution');
  });

  it('never awards a perfect score to a wholly or partly unassessed list', () => {
    const unknown = analyzeFoodText('Farrothus Exoticus');
    assert.equal(foodLabelGrade(unknown), null);

    const partial = analyzeFoodText('Milk, Farrothus Exoticus');
    assert.deepEqual(foodLabelGrade(partial), { score: 79, band: 'moderate' });
  });

  it('keeps the original additiveGrade export as a compatibility alias', () => {
    const r = analyzeFoodText('Milk, salt');
    assert.deepEqual(additiveGrade(r), foodLabelGrade(r));
  });

  it('does not grade waters (no ingredient list) and empty lists', () => {
    const water = analyzeFoodText('Composition minérale en mg, Sodium 26, Calcium 12', {
      label: 'Sidi Ali',
      category: 'fr:eaux-minerales-naturelles',
    });
    assert.equal(water.kind, 'water');
    assert.equal(additiveGrade(water), null);
  });

  it('maps bands with the documented thresholds', () => {
    assert.equal(gradeBandFor(100), 'excellent');
    assert.equal(gradeBandFor(95), 'excellent');
    assert.equal(gradeBandFor(94), 'good');
    assert.equal(gradeBandFor(80), 'good');
    assert.equal(gradeBandFor(79), 'moderate');
    assert.equal(gradeBandFor(60), 'moderate');
    assert.equal(gradeBandFor(59), 'caution');
    assert.equal(gradeBandFor(40), 'caution');
    assert.equal(gradeBandFor(39), 'avoid');
  });
});
