/**
 * Regression cover for the Moroccan (Open Food Facts `Morocco`) barcode corpus.
 *
 * These fixtures are real label strings harvested from the OFF Morocco facet
 * (see `data/ma-corpus-off.json`, `scripts/audit-ma-corpus.mts`). Before this
 * layer existed, Arabic-language labels scored "0 recognized" and could not be
 * graded at all — roughly a quarter of the corpus. Every case below failed at
 * some point during that audit.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFoodText } from '../src/lib/food-knowledge/analyze';
import { detectFoodKind } from '../src/lib/food-knowledge/domain';
import { foodGradeDrivers, foodLabelGrade } from '../src/lib/food-knowledge/grade';
import { foldForMatch, lookupAdditive, lookupFoodRow } from '../src/lib/food-knowledge/lists';

describe('Moroccan label — Arabic family rows', () => {
  const cases: ReadonlyArray<readonly [string, string]> = [
    ['حليب', 'dairy'],
    ['حليب نصف دسم', 'dairy'],
    ['حليب كامل الدسم', 'dairy'],
    ['مسحوق الحليب بدون قشدة', 'dairy'],
    ['قشدة', 'dairy'],
    ['زبدة', 'dairy'],
    ['بروتينات الحليب', 'dairy'],
    ['جبن أبيض', 'dairy'],
    ['أجبان', 'dairy'],
    ['زيت الصوجا', 'fat-oil'],
    ['زيوت نباتية', 'fat-oil'],
    ['مادة دسمة نباتية', 'fat-oil'],
    ['سكر', 'sugar'],
    ['ملح', 'salt'],
    ['ماء', 'water'],
    ['نشا', 'cereal'],
    ['دقيق القمح', 'cereal'],
    ['طماطم مركزة', 'fruit-veg'],
    ['التونة', 'meat-fish'],
    ['أصفر البيض', 'egg'],
    ['خمائر حليبية', 'culture'],
    ['نكهة', 'other'],
    ['خل المائدة', 'other'],
    ['خردل', 'herb-spice'],
    ['شاي أخضر', 'other'],
  ];

  for (const [name, family] of cases) {
    it(`recognizes "${name}" as ${family}`, () => {
      assert.equal(lookupFoodRow(foldForMatch(name))?.row.family, family);
    });
  }

  it('recognizes Spanish import wording', () => {
    assert.equal(lookupFoodRow(foldForMatch('azucar'))?.row.family, 'sugar');
    assert.equal(lookupFoodRow(foldForMatch('leche en polvo'))?.row.family, 'dairy');
    assert.equal(lookupFoodRow(foldForMatch('sal'))?.row.family, 'salt');
    assert.equal(lookupFoodRow(foldForMatch('aceite de girasol'))?.row.family, 'fat-oil');
  });
});

describe('Moroccan label — Arabic allergen detection', () => {
  const cases: ReadonlyArray<readonly [string, string]> = [
    ['حليب نصف دسم', 'milk'],
    ['زبدة', 'milk'],
    ['جبنة مذوبة', 'milk'],
    ['بروتينات الحليب', 'milk'],
    ['التونة', 'fish'],
    ['أصفر البيض', 'eggs'],
    ['دقيق القمح', 'gluten'],
    ['خردل', 'mustard'],
    ['جلجلان', 'sesame'],
    ['زيت الصوجا', 'soybeans'],
    ['اللوز', 'nuts'],
  ];

  for (const [name, group] of cases) {
    it(`flags "${name}" as ${group}`, () => {
      const analysis = analyzeFoodText(name);
      assert.ok(
        analysis.allergens.some((hit) => hit.group === group),
        `expected ${group}, got ${JSON.stringify(analysis.allergens)}`,
      );
    });
  }

  it('keeps coconut out of the nut allergen group in Arabic too', () => {
    const analysis = analyzeFoodText('جوز الهند');
    assert.equal(analysis.allergens.some((hit) => hit.group === 'nuts'), false);
  });
});

describe('Moroccan label — Arabic additive names', () => {
  it('maps Arabic additive names to their E numbers', () => {
    assert.equal(lookupAdditive('سوربات البوتاسيوم')?.code, 'E202');
    assert.equal(lookupAdditive('بنزوات الصوديوم')?.code, 'E211');
    assert.equal(lookupAdditive('حمض الستريك')?.code, 'E330');
    assert.equal(lookupAdditive('كاراجينان')?.code, 'E407');
    assert.equal(lookupAdditive('صمغ الزنتان')?.code, 'E415');
    assert.equal(lookupAdditive('ليسيتين الصوجا')?.code, 'E322');
    assert.equal(lookupAdditive('بيكربونات الأمونيوم')?.code, 'E503');
  });

  it('resolves subgroup E codes to the registered additive', () => {
    // "E160a"/"E150d"/"E500ii" name a subgroup; the label does disclose the
    // substance, so it must not be reported as unknown (nor as a vague colour).
    assert.equal(lookupAdditive('colorant e160a')?.code, 'E160');
    assert.equal(lookupAdditive('colorant e150d')?.code, 'E150');
    assert.equal(lookupAdditive('e500ii')?.code, 'E500');
    assert.equal(lookupAdditive('e999zz'), null);
  });
});

describe('Moroccan label — vague functional classes', () => {
  it('reads French thickener and emulsifier wording', () => {
    assert.equal(analyzeFoodText('épaississant').ingredients[0]?.unspecifiedClass, 'thickener');
    assert.equal(analyzeFoodText('émulsifiant').ingredients[0]?.unspecifiedClass, 'emulsifier');
  });

  it('reads Arabic functional wording', () => {
    assert.equal(analyzeFoodText('مادة حافظة').ingredients[0]?.unspecifiedClass, 'preservative');
    assert.equal(analyzeFoodText('ملونات').ingredients[0]?.unspecifiedClass, 'colour');
    assert.equal(analyzeFoodText('مثبتات').ingredients[0]?.unspecifiedClass, 'stabiliser');
    assert.equal(analyzeFoodText('مخثر').ingredients[0]?.unspecifiedClass, 'thickener');
    assert.equal(analyzeFoodText('مستحلب').ingredients[0]?.unspecifiedClass, 'emulsifier');
    assert.equal(analyzeFoodText('محمض').ingredients[0]?.unspecifiedClass, 'food-acid');
    assert.equal(analyzeFoodText('مضادات الأكسدة').ingredients[0]?.unspecifiedClass, 'antioxidant');
  });

  it('does not double-penalize a class the label enumerates', () => {
    // "مادة حافظة سوربات البوتاسيوم" names E202 → the vague-preservative
    // driver must drop out because the label does disclose the substance.
    const analysis = analyzeFoodText('ماء، سكر، مادة حافظة سوربات البوتاسيوم');
    assert.deepEqual(analysis.additives.map((a) => a.code), ['E202']);
    const keys = foodGradeDrivers(analysis).map((driver) => driver.key);
    assert.equal(keys.includes('preservative'), false);
  });
});

describe('Moroccan label — end-to-end grades', () => {
  it('grades an all-Arabic processed-cheese label', () => {
    // OFF 6111203006653 — La Hollandaise Cheddar.
    const text =
      'حليب خالي من الدسم مشكل، شيدر 25%، زبدة، أملاح مستحلبة (E452، E341، E450)، ' +
      'بروتينات الحليب، ملح، مادة حافظة: سوربات البوتاسيوم، الكالسيوم، فيتامين E,D,A';
    const analysis = analyzeFoodText(text, { category: 'Cheddar slices' });
    assert.equal(analysis.total, analysis.recognized, `unknown: ${analysis.unknownNames.join(', ')}`);
    const grade = foodLabelGrade(analysis);
    assert.ok(grade && grade.score > 0);
    assert.ok(analysis.allergens.some((hit) => hit.group === 'milk'));
  });

  it('grades an all-Arabic yogurt label', () => {
    // OFF 6111032001010 — Central Danone plain yogurt (stirred).
    const text =
      'يوغورت عاقد، قشدة، زبدة، نكهة، خمائر حليبية لليوغورت، ' +
      'المكونات حليب بدون قشدة، مسحوق الحليب بدون قشدة';
    const analysis = analyzeFoodText(text, { category: 'Yogurts' });
    assert.equal(analysis.total, analysis.recognized, `unknown: ${analysis.unknownNames.join(', ')}`);
    assert.ok(foodLabelGrade(analysis));
  });

  it('grades a bilingual French label with subgroup E codes', () => {
    // OFF 6111242100817 / 6111259342828 style list.
    const text =
      'Farine de blé, Sucre, Beurre 11%, Huiles végétales hydrogénée (Palme), ' +
      'Amidon, sel, émulsifiant (lécithines de soja), colorant E160a, arôme (vanilline).';
    const analysis = analyzeFoodText(text, { category: 'Biscuits' });
    assert.equal(analysis.total, analysis.recognized, `unknown: ${analysis.unknownNames.join(', ')}`);
    assert.deepEqual(analysis.additives.map((a) => a.code), ['E160']);
  });

  it('still withholds a grade when the label is marketing text, not ingredients', () => {
    // OFF 6111018903161 — the only stored "ingredients" are a hotline and a URL.
    const analysis = analyzeFoodText('Good Food Nescafé Classic. تحدث إلي نستله 080 105 10 10');
    assert.equal(analysis.recognized, 0);
    assert.equal(foodLabelGrade(analysis), null);
  });
});

describe('Moroccan label — water handling', () => {
  it('treats OFF English water categories as waters, not unreadable labels', () => {
    assert.equal(
      detectFoodKind({ category: 'Natural mineral waters', text: 'Sodium 26 Calcium 9' }),
      'water',
    );
    assert.equal(detectFoodKind({ category: 'Table waters', text: 'eau' }), 'water');
    assert.equal(detectFoodKind({ category: 'Spring waters' }), 'water');
  });

  it('does not call a fruit drink a water', () => {
    assert.equal(detectFoodKind({ category: 'Fruit juices', text: "jus et pulpe d'orange" }), 'drink');
    assert.notEqual(detectFoodKind({ category: 'Orange juices', text: 'jus et pulpe d orange' }), 'water');
  });
});
