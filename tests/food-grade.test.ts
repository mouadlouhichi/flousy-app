import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFoodText } from '../src/lib/food-knowledge/analyze';
import {
  additiveGrade,
  FOOD_GRADE_AVOID_CAP,
  gradeBandFor,
} from '../src/lib/food-knowledge/grade';

describe('food additive grade', () => {
  it('starts plain foods at 100 / excellent (no E-numbers)', () => {
    const r = analyzeFoodText('Lait de vache pasteurisé, crème fraîche, ferments lactiques, sel');
    assert.equal(r.additives.length, 0);
    assert.deepEqual(additiveGrade(r), { score: 100, band: 'excellent' });
  });

  it('drops the Dutch crisps list to 85 / good for its watch additive (MSG)', () => {
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
    // Exactly one watch additive is surfaced (E621); E471/E160b are
    // EU-permitted so they do not subtract.
    assert.deepEqual(r.additives.map((a) => a.band).sort(), ['neutral', 'neutral', 'watch']);
    assert.deepEqual(additiveGrade(r), { score: 85, band: 'good' });
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
