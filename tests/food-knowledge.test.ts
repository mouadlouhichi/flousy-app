import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeFoodIngredientList,
  analyzeFoodText,
  stripIngredientsHeading,
} from '../src/lib/food-knowledge/analyze';
import { foldForMatch, lookupAdditive, lookupAdditives, lookupFoodRow } from '../src/lib/food-knowledge/lists';
import { detectFoodKind, detectLabelDomain } from '../src/lib/food-knowledge/domain';
import { additiveGrade } from '../src/lib/food-knowledge/grade';
import { sanitizeLabelText, splitInciList } from '../src/lib/ingredient-safety/normalize';

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

  it('reads Dutch additive names — also when nested in a compound token', () => {
    assert.equal(lookupAdditive('mononatriumglutamaat')?.code, 'E621');
    assert.equal(lookupAdditive('natriumguanylaat')?.code, 'E627');
    assert.equal(lookupAdditive('dinatriuminosinaat')?.code, 'E631');
    assert.equal(lookupAdditive('citroenzuur')?.code, 'E330');
    assert.equal(lookupAdditive('kleurstof (annatto norbixine)')?.code, 'E160b');
    // A single seasoning token may name SEVERAL additives — all must be
    // surfaced (the row chip shows the first, the summary counts all).
    const season =
      'paprikakruiderij (smaakversterkers {mononatriumglutamaat, natriumguanylaat, dinatriuminosinaat}, voedingszuur {citroenzuur})';
    assert.deepEqual(
      lookupAdditives(season).map((a) => a.code),
      ['E621', 'E627', 'E631', 'E330'],
    );
    assert.equal(lookupAdditive(season)?.code, 'E621');
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

describe('recognising more ingredients (Dutch / imported labels)', () => {
  it('recognises the Dutch crisps label end-to-end (10/10)', () => {
    const r = analyzeFoodText(
      [
        'Gedehydrateerde aardappelen',
        'zonnebloemolie',
        'TARWEMEEL',
        'maïsmeel',
        'rijstbloem',
        'paprikakruiderij (suiker, paprikapoeder, smaakversterkers {mononatriumglutamaat, natriumguanylaat, dinatriuminosinaat}, dextrose, gistpoeder, uienpoeder, zout, gegranuleerde bouillon {zout, gehydrolyseerd plantaardig eiwit, zonnebloemolie}, aroma\'s, knoflookpoeder, kleurstof {paprika-extract}, voedingszuur {citroenzuur}, zoet weipoeder MELK)',
        'maltodextrine',
        'emulgator (E471)',
        'zout',
        'kleurstof (annatto norbixine)',
      ].join(', '),
    );
    assert.equal(r.total, 10);
    assert.equal(r.recognized, 10);
    assert.equal(r.coverage, 1);
    assert.deepEqual(r.unknownNames, []);
    assert.ok(r.allergenGroups.includes('gluten'), 'wheat flour is gluten');
    assert.ok(r.allergenGroups.includes('milk'), 'sweet whey powder / MELK is milk');
    const codes = r.additives.map((a) => a.code);
    assert.ok(codes.includes('E621'));
    assert.ok(codes.includes('E627'), 'MSG companion sodium guanylate is not dropped');
    assert.ok(codes.includes('E631'), 'MSG companion disodium inosinate is not dropped');
    assert.ok(codes.includes('E471'));
    assert.ok(codes.includes('E160b'));
    const families = r.ingredients.map((i) => i.family);
    assert.deepEqual(
      [families[0], families[1], families[2], families[3], families[4], families[8]],
      ['fruit-veg', 'fat-oil', 'cereal', 'cereal', 'cereal', 'salt'],
    );
  });
});

describe('water regression — scanned Sidi Ali with a pasted composition', () => {
  it('routes a pasted mineral composition to the water view even when a plain name is present', () => {
    // OFF category missing and the name carries no "eau"/"water" token: the
    // composition text itself must still win (a scanned water without a
    // resolved category).
    const byKind = detectFoodKind({
      name: 'Sidi Ali 1,5 L',
      text: 'Composition minérale en mg, Résidu sec à 110°C: 186, Sodium 26',
    });
    assert.equal(byKind, 'water');

    const r = analyzeFoodText(
      'Composition minérale en mg, Résidu sec à 110°C: 186, Sodium 26, Calcium 12',
      { label: 'Sidi Ali 1,5 L' },
    );
    assert.equal(r.kind, 'water');
    assert.equal(r.water?.parameters.length, 3);
    assert.equal(r.water?.parameters[0].key, 'dry-residue');
    assert.equal(r.water?.parameters[1].key, 'sodium');
  });

  it('does not hijack a normal food label that merely mentions résidu sec', () => {
    // A cheese/cream label can mention dry matter without being a water —
    // the FOOD name/category wins.
    assert.equal(
      detectFoodKind({ category: 'fr:fromages', name: 'Fromage blanc', text: 'Lait, résidu sec 25%' }),
      'standard',
    );
  });
});

describe('audit regression — apricots and sesame products', () => {
  it('recognizes apricots as fruit (plural, dried, EN)', () => {
    for (const term of ['Abricots', 'abricot sec', 'apricots', 'dried apricots']) {
      const r = analyzeFoodText(term);
      assert.equal(r.recognized, 1, `${term} should be recognized`);
      assert.equal(r.ingredients[0].family, 'fruit-veg', `${term} should map to fruit`);
    }
  });

  it('keeps the additive grade at 100 for allergen-only and permitted-additive lists', () => {
    // The audit's two examples: no 'watch'/'avoid' additive ⇒ 100, even when
    // an EU allergen (sesame) is present — allergens are disclosure, not part
    // of the additive grade.
    const apricot = analyzeFoodText('Abricots, sucre, acidifiant : acide citrique');
    assert.equal(apricot.ingredients.find((i) => i.family === 'fruit-veg')?.raw, 'Abricots');
    assert.equal(additiveGrade(apricot)?.score, 100);

    const sesame = analyzeFoodText('Eau, sésame, sel, acidifiant : acide citrique');
    assert.deepEqual(sesame.allergenGroups, ['sesame']);
    assert.equal(sesame.additives.length, 1);
    assert.equal(sesame.additives[0].code, 'E330');
    assert.equal(additiveGrade(sesame)?.score, 100);
  });
});

describe('pasted/OCR text sanitizer (extra characters)', () => {
  it('removes branding, quotes, pipes and emoji from pasted label text', () => {
    const dirty = '© Marque | Lait « frais » ® — 2L ½™';
    const clean = sanitizeLabelText(dirty);
    assert.ok(!/[©®™«»|]/.test(clean), `no noise chars left: ${clean}`);
    assert.ok(clean.includes('Lait'), 'letters survive');
    assert.ok(clean.includes('2L'), 'digits survive');
    assert.ok(clean.includes('%') === false, 'no stray percent invented');
  });

  it('never turns noise into phantom ingredients (food + INCI)', () => {
    const r = analyzeFoodText('Lait de vache © pasteurisé |, Crème fraîche (30%)™, sel');
    assert.equal(r.total, 3);
    assert.deepEqual(
      r.ingredients.map((i) => i.raw),
      ['Lait de vache pasteurisé', 'Crème fraîche (30%)', 'sel'],
    );
    assert.equal(r.recognized, 3);

    const inci = splitInciList('Aqua 💧, Glycerin™ |, Cetearyl Alcohol');
    assert.deepEqual(inci, ['Aqua', 'Glycerin', 'Cetearyl Alcohol']);
  });

  it('keeps the characters INCI/food labels actually use', () => {
    // %/°C units, +, &, parens and hyphens (PEG-40, C.I. 77491) must survive.
    assert.equal(sanitizeLabelText('C.I. 77491, PEG-40 & Parfum (90%) — 0°C'), 'C.I. 77491, PEG-40 & Parfum (90%) — 0°C');
  });
});

describe('water scan regression — Sidi Ali under a generic beverages category', () => {
  it('still shows the mineral-water view when OFF files water under fr:boissons', () => {
    const compo =
      'Composition minérale en mg, Résidu sec à 110°C: 186, Sodium 26, Calcium 12';
    // Old bug: the generic "boisson(s)" drink category fired before the
    // composition text, so a scanned Sidi Ali degraded to a 0/N list.
    assert.equal(detectFoodKind({ name: 'Sidi Ali', category: 'fr:boissons', text: compo }), 'water');
    const r = analyzeFoodText(compo, { label: 'Sidi Ali', category: 'fr:boissons' });
    assert.equal(r.kind, 'water');
    assert.equal(r.water?.parameters.length, 3);
    assert.ok(r.water.parameters.some((p) => p.key === 'dry-residue'));
  });
});
