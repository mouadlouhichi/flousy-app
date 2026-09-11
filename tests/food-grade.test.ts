import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFoodText } from '../src/lib/food-knowledge/analyze';
import {
  additiveGrade,
  foodGradeDrivers,
  foodLabelGrade,
  FOOD_GRADE_AVOID_CAP,
  FOOD_GRADE_AVOID_PENALTY,
  FOOD_GRADE_CONCERN_HIGH_PENALTY,
  FOOD_GRADE_HIGH_CONCERN_CAP,
  FOOD_GRADE_WATCH_PENALTY,
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

describe('food grade drivers (score transparency)', () => {
  it('ranks the signals that moved the grade, strongest contribution first', () => {
    const r = analyzeFoodText(
      'Huile de palme, farine de blé, sucre, colorant E171, colorant E102, lécithine de tournesol, huile partiellement hydrogénée',
    );
    const grade = foodLabelGrade(r);
    assert.ok(grade, 'expected a grade for a fully recognized list');
    const drivers = foodGradeDrivers(r);
    assert.ok(drivers.length >= 3, 'expected at least three drivers');
    for (let i = 1; i < drivers.length; i += 1) {
      assert.ok(
        drivers[i - 1].deduction >= drivers[i].deduction,
        'drivers must be ordered strongest first',
      );
    }
    // The rubric and the breakdown must agree exactly.
    const sum = drivers.reduce((total, driver) => total + driver.deduction, 0);
    assert.ok(sum > 0);
    const avoidDriver = drivers.find((driver) => driver.level === 'avoid');
    assert.ok(avoidDriver, 'E171 must surface as the strongest driver class');
    assert.equal(avoidDriver?.deduction, FOOD_GRADE_AVOID_PENALTY);
    const watchSum = drivers
      .filter((driver) => driver.level === 'watch' && driver.kind === 'additive')
      .reduce((total, driver) => total + driver.deduction, 0);
    assert.ok(watchSum % FOOD_GRADE_WATCH_PENALTY === 0, 'watch additive deductions must match the rubric');
  });

  it('surfaces an explicit high concern at its rubric penalty', () => {
    const r = analyzeFoodText('Sucre, huile partiellement hydrogénée, sel');
    const drivers = foodGradeDrivers(r);
    const concern = drivers.find((driver) => driver.kind === 'concern');
    assert.ok(concern, 'partially hydrogenated oil must be a driver');
    assert.equal(concern?.level, 'high');
    assert.equal(concern?.deduction, FOOD_GRADE_CONCERN_HIGH_PENALTY);
  });

  it('returns nothing when there is nothing to rank', () => {
    assert.deepEqual(foodGradeDrivers(null), []);
    const plain = analyzeFoodText('Lait de vache pasteurisé, sel');
    assert.deepEqual(foodGradeDrivers(plain), []);
  });
});

describe('label vagueness rubric (2026-09-food-v5)', () => {
  const TRANSPARENT =
    'Gedehydrateerde aardappelen, zonnebloemolie, TARWEMEEL, rijstbloem, paprikakruiderij (suiker, paprikapoeder, smaakversterkers {mononatriumglutamaat, natriumguanylaat, dinatriuminosinaat}, dextrose, gistpoeder, zout), emulgator (E471), kleurstof (annatto E160b)';
  const VAGUE =
    'Gedehydrateerde aardappelen, zonnebloemolie, TARWEMEEL, rijstbloem, paprikakruiderij (suiker, paprikapoeder, smaakversterkers, dextrose, gistpoeder, zout), emulgator (E471), kleurstof (annatto), voedingszuur, eiwit';

  it('never scores a vaguer label of the same product as safer than the transparent one', () => {
    const transparent = foodLabelGrade(analyzeFoodText(TRANSPARENT));
    const vague = foodLabelGrade(analyzeFoodText(VAGUE));
    assert.ok(transparent, 'transparent grade computed');
    assert.ok(vague, 'vague grade computed');
    assert.ok(
      (vague?.score ?? 100) <= (transparent?.score ?? 0),
      `vague ${vague?.score} must not read safer than transparent ${transparent?.score}`,
    );
  });

  it('suppresses a class penalty only when its E-range is enumerated on the label', () => {
    // "colour" bare + E160b named = one transparent declaration, no penalty.
    const withColour = analyzeFoodText('Salt, sugar, colour, colorant (annatto E160b)');
    assert.ok(!foodGradeDrivers(withColour).some((driver) => driver.kind === 'unspecified'));
    // Same bare "colour" without any declared colour additive stays penalized.
    const bareColour = analyzeFoodText('Salt, sugar, colour');
    assert.ok(foodGradeDrivers(bareColour).some((driver) => driver.kind === 'unspecified' && driver.key === 'colour'));
  });
});
