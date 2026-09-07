import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeFoodIngredientList,
  analyzeFoodText,
  stripIngredientsHeading,
} from '../src/lib/food-knowledge/analyze';
import { foldForMatch, lookupAdditive, lookupFoodRow } from '../src/lib/food-knowledge/lists';
import { detectFoodKind, detectLabelDomain } from '../src/lib/food-knowledge/domain';

describe('food-knowledge lists', () => {
  it('folds French labels for stable matching', () => {
    assert.equal(foldForMatch('Crème Fraîche — Pasteurisée'), 'creme fraiche pasteurisee');
    assert.equal(foldForMatch('Œuf'), 'oeuf');
  });

  it('matches families by longest key and avoids coconut-as-nut traps', () => {
    assert.equal(lookupFoodRow(foldForMatch('crème fraîche pasteurisée'))?.row.family, 'dairy');
    assert.equal(lookupFoodRow(foldForMatch('lait de vache pasteurisé'))?.row.family, 'dairy');
    assert.equal(lookupFoodRow(foldForMatch('sel'))?.row.family, 'salt');
    assert.equal(lookupFoodRow(foldForMatch('noix de coco'))?.row.family, 'fruit-veg');
    assert.equal(lookupFoodRow(foldForMatch('noix'))?.row.family, 'nut-seed');
  });

  it('reads additives from E codes and plain names', () => {
    assert.equal(lookupAdditive('acide citrique')?.code, 'E330');
    assert.equal(lookupAdditive('tartrazine')?.code, 'E102');
    assert.equal(lookupAdditive('nitrite de sodium')?.code, 'E250');
    assert.equal(lookupAdditive('caramel')?.code, 'E150');
    assert.equal(lookupAdditive('persil'), null);
  });
});

describe('food knowledge engine', () => {
  it('explains the photographed dairy label end-to-end', () => {
    const label =
      'Lait de vache pasteurisé, Crème fraîche pasteurisée, ferments lactiques, Présure, Sel';
    const r = analyzeFoodText(label);
    assert.equal(r.total, 5);
    assert.equal(r.recognized, 5);
    assert.equal(r.coverage, 1);
    assert.deepEqual(r.allergenGroups, ['milk']);
    assert.deepEqual(
      r.ingredients.map((i) => i.family),
      ['dairy', 'dairy', 'culture', 'other', 'salt'],
    );
    assert.equal(r.additives.length, 0);
    assert.ok(r.flags.some((f) => f.code === 'short-label'));
    assert.ok(r.flags.some((f) => f.code === 'no-additives'));
    // Food analysis never fabricates a numeric score.
    assert.ok(!('score' in r));
  });

  it('detects EU allergen groups from plain labels and ignores lookalikes', () => {
    const r = analyzeFoodText('Farine de blé, œuf, lait, noix de coco râpée');
    assert.deepEqual(r.allergenGroups, ['gluten', 'eggs', 'milk']);
    const nuts = analyzeFoodText('Cocktail de fruits exotiques (ananas, noix de coco)');
    assert.ok(!nuts.allergenGroups.includes('nuts'));
  });

  it('flags watch/avoid additives with their EU notices', () => {
    const r = analyzeFoodText('Eau, sucre, acide citrique, tartrazine (E102), dioxyde de titane');
    const codes = r.additives.map((a) => a.code);
    assert.deepEqual(codes, ['E330', 'E102', 'E171']);
    const e102 = r.additives.find((a) => a.code === 'E102');
    assert.equal(e102?.band, 'watch');
    assert.ok(e102?.notices.includes('eu-children-warning'));
    const e171 = r.additives.find((a) => a.code === 'E171');
    assert.equal(e171?.band, 'avoid');
    assert.ok(r.flags.some((f) => f.code === 'additive-children-warning'));
    assert.ok(r.flags.some((f) => f.code === 'additive-not-permitted'));
  });

  it('keeps unknowns visible and caps confidence wording via coverage', () => {
    const r = analyzeFoodText('Lait entier, mystère-botanique 3000, polyglycérine poliricinéolate');
    assert.equal(r.recognized, 1);
    assert.equal(r.total, 3);
    assert.equal(r.unknownNames.length, 2);
    assert.ok(r.flags.some((f) => f.code === 'unknown-ingredients'));
  });

  it('strips the Ingredients heading and honours OFF allergen tags', () => {
    assert.equal(stripIngredientsHeading('Ingrédients: Lait, Sel'), 'Lait, Sel');
    assert.equal(stripIngredientsHeading('Ingredients\nLait'), 'Ingredients\nLait'); // no colon → untouched
    const r = analyzeFoodIngredientList(['Lait entier'], { offAllergenTags: ['en:milk'] });
    assert.deepEqual(r.allergenGroups, ['milk']);
  });

  it('is deterministic for identical input', () => {
    const text = 'Lait, crème, sucre, émulsifiant : lécithine (E322), arômes';
    assert.equal(JSON.stringify(analyzeFoodText(text)), JSON.stringify(analyzeFoodText(text)));
  });
});

describe('detectLabelDomain', () => {
  it('classifies beauty products as cosmetics and groceries as food', () => {
    assert.equal(
      detectLabelDomain({ category: 'Face moisturizers', name: 'Crème de jour' }),
      'cosmetic',
    );
    assert.equal(detectLabelDomain({ category: 'Fromages', name: 'Fromage blanc' }), 'food');
    assert.equal(
      detectLabelDomain({ category: 'Dairies', name: 'Lait demi-écrémé' }),
      'food',
    );
  });

  it('defaults unknown labels to food, but spots INCI-like text', () => {
    assert.equal(detectLabelDomain({}), 'food');
    assert.equal(detectLabelDomain({ name: 'Produit frais' }), 'food');
    assert.equal(
      detectLabelDomain({ ingredientsText: 'Aqua, Glycerin, Cetearyl Alcohol, Parfum' }),
      'cosmetic',
    );
  });
});

describe('detectFoodKind — waters & drinks', () => {
  it('classifies Sidi Ali-like mineral waters as water', () => {
    assert.equal(detectFoodKind({ category: 'fr:eaux-minerales-naturelles', name: 'Sidi Ali' }), 'water');
    assert.equal(detectFoodKind({ category: 'en:natural-mineral-waters' }), 'water');
    assert.equal(detectFoodKind({ name: 'Oulmès eau minérale naturelle' }), 'water');
    assert.equal(detectFoodKind({ name: 'Sidi Ali eau minérale naturelle 1,5 L' }), 'water');
    assert.equal(detectFoodKind({ category: 'fr:eaux-de-source' }), 'water');
    assert.equal(detectFoodKind({ category: 'fr:eaux-gazeuses' }), 'water');
  });

  it('classifies other drinks (juices, sodas, plant drinks) as drinks', () => {
    assert.equal(detectFoodKind({ category: 'fr:jus-de-fruits' }), 'drink');
    assert.equal(detectFoodKind({ category: 'fr:sodas' }), 'drink');
    assert.equal(detectFoodKind({ category: 'fr:boissons-gazeuses' }), 'drink');
    assert.equal(detectFoodKind({ name: "Lait d'avoine" }), 'drink');
    assert.equal(detectFoodKind({ name: "Jus d'orange 100%" }), 'drink');
  });

  it('keeps flavoured waters and ordinary foods on the right side', () => {
    assert.equal(detectFoodKind({ category: 'en:flavoured-waters' }), 'drink');
    assert.equal(detectFoodKind({ category: 'fr:eaux-gazeuses', name: 'Eau aromatisée citron' }), 'drink');
    assert.equal(detectFoodKind({ category: 'fr:yaourts', name: 'Yaourt nature' }), 'standard');
    assert.equal(detectFoodKind({ category: 'fr:fromages', name: 'Fromage blanc' }), 'standard');
  });
});

describe('water composition analysis (products like Sidi Ali)', () => {
  it('parses a mineral composition instead of failing as ingredients', () => {
    const r = analyzeFoodText(
      [
        'Composition minérale en mg',
        'Résidu sec à 110°C: 186',
        'Sodium 26',
        'Calcium 12',
        'Magnésium 9',
        'Sulfates 42',
        'Chlorures 14',
        'Potassium 1',
        'Bicarbonates 104',
        'Nitrates 4',
      ].join(', '),
      { label: 'Sidi Ali', category: 'fr:eaux-minerales-naturelles' },
    );
    assert.equal(r.kind, 'water');
    assert.ok(r.water, 'water parameters parsed');
    assert.deepEqual(
      r.water.parameters.map((p) => p.key),
      ['dry-residue', 'sodium', 'calcium', 'magnesium', 'sulphates', 'chlorides', 'potassium', 'bicarbonates', 'nitrates'],
    );
    assert.equal(r.water.parameters.find((p) => p.key === 'dry-residue')?.value, '186');
    assert.equal(r.water.parameters.find((p) => p.key === 'sodium')?.value, '26');
    assert.equal(r.water.parameters.find((p) => p.key === 'magnesium')?.value, '9');
    // Informational only: no allergen/additive noise and never a numeric score.
    assert.equal(r.allergenGroups.length, 0);
    assert.equal(r.additives.length, 0);
    assert.ok(!('score' in r));
  });

  it('detects water from a pasted composition alone (no barcode metadata)', () => {
    const r = analyzeFoodText('Composition minérale en mg, Résidu sec à 110°C: 186, Sodium 26');
    assert.equal(r.kind, 'water');
    assert.equal(r.water?.parameters.length, 2);
  });

  it('returns an adapted water analysis for a barcode with no label text', () => {
    const r = analyzeFoodIngredientList([], {
      label: 'Sidi Ali 1,5 L',
      category: 'fr:eaux',
    });
    assert.equal(r.kind, 'water');
    assert.deepEqual(r.water?.parameters ?? [], []);
    assert.equal(r.total, 0);
  });

  it('still shows a normal knowledge view for drinks that carry a real list', () => {
    const r = analyzeFoodText('Eau gazeuse, sucre, jus d’orange, acide citrique, arômes naturels', {
      category: 'fr:boissons-gazeuses',
    });
    assert.equal(r.kind, 'drink');
    assert.equal(r.recognized, r.total);
    assert.equal(r.ingredients.find((i) => i.family === 'water')?.raw, 'Eau gazeuse');
    assert.equal(r.additives.length, 1);
  });
});
