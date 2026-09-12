/**
 * Domain resolution for the label-knowledge panel: is this scanned/pasted
 * label describes food, cosmetics, household goods, pet products, or remains
 * unknown. Source database is provenance only; it never proves the domain.
 * Ambiguity stays `unknown` until the user chooses an analyzer.
 */

import type { FoodDomain, FoodProductKind } from './types';
import type { ProductDomain } from '../store';
import { foldForMatch } from './lists';

/**
 * Product-kind classification for the FOOD side: does this product carry a
 * classic ingredient list, or is it a water / another drink?
 *
 * - `water` — natural mineral / spring / sparkling / table waters: by
 *   regulation they have NO ingredient list; their label prints a mineral
 *   composition instead (mg/L). When such a product is scanned the UI shows
 *   an adapted "mineral water" view, never a failing ingredient parse.
 * - `drink` — fruit juices, nectars, sodas, plant drinks… usually DO carry an
 *   ingredient list, but water-based; recognised so the UI can stay coherent
 *   and future panels can special-case them.
 * - `standard` — everything else (a normal food ingredient list).
 *
 * Detection is deliberately conservative and uses the same signals the
 * barcode path already has: OFF category tags first (they are the most
 * reliable), then the product name, then — only for pasted labels — the text.
 */
export type { FoodProductKind };

const COSMETIC_MARKERS = [
  'shampoo', 'shampoing', 'shampooing', 'conditioner', 'apres-shampooing',
  'capillaire', 'gel douche', 'shower gel', 'savon', 'soap', 'lait corporel',
  'body lotion', 'corps', 'crème visage', 'creme visage', 'face cream',
  'crème de jour', 'creme de jour', 'day cream', 'crème de nuit', 'creme de nuit',
  'night cream', 'serum', 'sérum', 'soin', 'skincare', 'skin care', 'cosmetic',
  'cosmetics', 'maquillage', 'makeup', 'make-up', 'fond de teint', 'mascara',
  'rouge à lèvres', 'rouge a levres', 'lipstick', 'vernis à ongles', 'nail polish',
  'parfum', 'perfume', 'eau de toilette', 'deodorant', 'déodorant', 'dentifrice',
  'toothpaste', 'solaire', 'sunscreen', 'toner', 'tonique', 'cleanser',
  'nettoyant visage', 'moisturizer', 'crème hydratante', 'creme hydratante',
  'eye cream', 'contour des yeux', 'after shave', 'apres-rasage', 'body butter',
  'huile corporelle', 'hairspray', 'laque', 'coloration', 'hair dye', 'visage',
  'شامبو', 'كريم', 'مستحضرات التجميل', 'عطر', 'غسول الوجه', 'واقي الشمس',
];

const HOUSEHOLD_MARKERS = [
  'detergent', 'détergent', 'lessive', 'laundry', 'dishwashing', 'vaisselle',
  'household', 'entretien', 'nettoyant ménager', 'nettoyant menager', 'bleach',
  'javel', 'fabric softener', 'adoucissant', 'surface cleaner', 'منظف منزلي',
  'مسحوق الغسيل', 'سائل الجلي',
];

const PET_MARKERS = [
  'pet food', 'dog food', 'cat food', 'animal food', 'croquettes', 'pâtée pour chat',
  'patee pour chat', 'aliments pour chiens', 'aliments pour chats', 'كلاب', 'قطط',
  'طعام الحيوانات',
];

const FOOD_MARKERS = [
  'dairy', 'fromage', 'yaourt', 'yogurt', 'lait', 'milk', 'creme dessert',
  'produits laitiers', 'boisson', 'drink', 'snack', 'biscuit', 'chocolate',
  'chocolat', 'confiserie', 'cereal', 'céréale', 'bread', 'pain', 'pasta',
  'pâtes', 'rice', 'sauce', 'conserve', 'viande', 'volaille', 'poisson',
  'fruit', 'legume', 'légume', 'huile', 'oil', 'épice', 'epice', 'spice',
  'soupe', 'soup', 'dessert', 'salé', 'sale', 'sucré', 'sucre', 'sugar',
  'confiture', 'jambon', 'saucisson', 'fromage blanc', 'creme fraiche',
  'crème fraîche', 'beurre', 'conserve de', 'petit-déjeuner', 'breakfast',
  'غذاء', 'طعام', 'حليب', 'خبز', 'سكر', 'زيت نباتي', 'مكونات غذائية',
];

/** INCI-ish tokens that would never appear on a food label. */
const INCI_ONLY_TOKENS = [
  'aqua', 'dimethicone', 'lauryl', 'phenoxyethanol', 'niacinamide',
  'hyaluronic', 'squalane', 'cetearyl', 'peg-', 'coco-glucoside',
  'caprylyl', 'octyldodecanol', 'peg', 'ppg-', 'xanthan', 'allantoin',
  'panthenol', 'tocopheryl acetate', 'sodium laureth',
];

function hasMarker(folded: string, markers: string[]): boolean {
  return markers.some((m) => folded.includes(m));
}

/** Category strings OFF glues onto beauty/product records that are temporarily
 *  filed under the wrong database (and therefore often carry no readable
 *  category). Any of these is a strong hint that a barcode lookup should be
 *  treated as a candidate cosmetic even when the name is a code-like label. */
export function suggestsCosmeticRecord(input: {
  category?: string;
  name?: string;
  ingredientsText?: string;
}): boolean {
  const category = foldForMatch(input.category ?? '');
  const name = foldForMatch(input.name ?? '');
  const text = foldForMatch(input.ingredientsText ?? '');

  if (
    category.includes('incorrect product type') ||
    category.includes('non-food-products') ||
    category.includes('open beauty facts') ||
    category.includes('open-beauty-facts') ||
    category.includes('cosmetic') ||
    category.includes('beauty')
  ) {
    return true;
  }
  // Name-level markers only add signal when the text isn't already a clear
  // food list; otherwise a product name containing a common word can't be
  // trusted more than the category chain.
  if (!text) return hasMarker(name, COSMETIC_MARKERS);
  return hasMarker(text, INCI_ONLY_TOKENS);
}

/** WATER markers — folded category/name fragments (singular AND French plural). */
const WATER_MARKERS = [
  'eau minerale', 'eaux minerales', 'mineral water', 'mineral waters',
  'eau de source', 'eaux de source', 'spring water', 'spring waters',
  'eau gazeuse', 'eaux gazeuses', 'sparkling water', 'eau de table',
  'eaux de table', 'table water', 'table waters', 'natural mineral water',
  'mineralwasser', 'aqua',
  'composition minerale', 'residu sec',
];
/** Loose water markers used only on OFF categories, gated against drink tags. */
const WATER_CATEGORY_LOOSE = ['eaux', 'waters', 'eau', 'water'];
/** Famous still/sparkling water brand names (only counted beside 'eau'/'water'). */
const WATER_BRANDS = [
  'sidi ali', 'oulmes', 'sidi harazem', 'ain saiss', 'ain ifrane', 'ain atlas',
  'evian', 'volvic', 'vittel', 'contrex', 'perrier', 'cristaline', 'san pellegrino',
];
/** DRINK markers — categories/names of juices, nectars, sodas, plant drinks… */
const DRINK_MARKERS = [
  'jus de fruit', 'jus de fruits', 'fruit juice', 'jus d', 'nectar',
  'soda', 'soft drink', 'boisson gazeuse', 'boissons gazeuses', 'carbonated drink',
  'energy drink', 'boisson energetique', 'sirop', 'smoothie', 'limonade',
  'citronnade', 'iced tea', 'the glace', 'boisson vegetale', 'plant drink',
  'plant milk', 'boisson', 'drink', 'lait vegetal', 'lait d amande',
  'lait d avoine', 'lait de coco', 'coconut drink', 'flavoured water',
  'eau aromatisee', 'sparkling soft drink',
];

/**
 * Decide whether a food product is a water, another drink, or a standard
 * ingredient-list food. Order matters: flavoured/aromatised waters are
 * drinks (they have a real ingredient list) — but only when a flavour
 * marker is present, otherwise still a water.
 */
export function detectFoodKind(input: {
  category?: string;
  name?: string;
  text?: string;
}): FoodProductKind {
  const category = foldForMatch(input.category ?? '');
  const name = foldForMatch(input.name ?? '');
  const text = foldForMatch(input.text ?? '');

  // STRONGEST signal first: a mineral-composition table printed on the label
  // only ever belongs to a water ("Composition minérale en mg…", "Résidu sec
  // à 110 °C … mg/L"). A real food/drink ingredient list never contains it,
  // so it must win even when the OFF category is a generic "boissons /
  // beverages" (waters are frequently filed there) — otherwise a scanned
  // water degrades to a 0/N "not recognized" list.
  const waterComposition =
    text &&
    (text.includes('composition minerale') ||
      (text.includes('residu sec') && text.includes('mg')));

  const flavoured =
    name.includes('aromatisee') || name.includes('flavoured') ||
    category.includes('aromatisee') || category.includes('flavoured') ||
    name.includes('aromes') || name.includes('flavors');

  if (waterComposition && !flavoured) return 'water';

  // 1. OFF category tags are the most reliable signal.
  if (category) {
    const exactWater = WATER_MARKERS.some((m) => category.includes(m));
    const looseWater =
      !exactWater &&
      WATER_CATEGORY_LOOSE.some((m) => category.includes(m)) &&
      !DRINK_MARKERS.some((m) => category.includes(m));
    if ((exactWater || looseWater) && !flavoured) return 'water';
    if (DRINK_MARKERS.some((m) => category.includes(m))) return 'drink';
  }

  // 2. Product name (used when categories are missing/too generic).
  if (name) {
    const waterName = WATER_MARKERS.some((m) => name.includes(m));
    const brandWater =
      WATER_BRANDS.some((b) => name.includes(b)) &&
      (name.includes('eau') || name.includes('water') || category.includes('eau'));
    if ((waterName || brandWater) && !flavoured) return 'water';
    if (DRINK_MARKERS.some((m) => name.includes(m))) return 'drink';
  }

  // 3. A pasted text that mentions drinks but no water composition.
  if (text && DRINK_MARKERS.some((m) => text.includes(m))) return 'drink';

  return 'standard';
}

/**
 * True when a resolved record should be treated as a cosmetic (runs the INCI
 * engine, offers the ingredient panel): the source `beauty` hint wins, then
 * explicit domain detection, then the generic placeholder-category heuristic
 * (code-like OFF names that only carry the open-beauty-facts chain).
 */
export function isCosmeticRecord(input: {
  beauty?: boolean;
  domain?: ProductDomain;
  category?: string;
  name?: string;
  ingredientsText?: string;
}): boolean {
  if (input.domain && input.domain !== 'unknown') return input.domain === 'cosmetic';
  if (input.beauty) return true;
  if (detectLabelDomain(input) === 'cosmetic') return true;
  return suggestsCosmeticRecord(input);
}

export function detectLabelDomain(input: {
  domain?: ProductDomain;
  category?: string;
  name?: string;
  ingredientsText?: string;
}): FoodDomain {
  if (input.domain && input.domain !== 'unknown') return input.domain;
  const category = foldForMatch(input.category ?? '');
  const name = foldForMatch(input.name ?? '');
  const text = foldForMatch(input.ingredientsText ?? '');

  if (category) {
    if (hasMarker(category, PET_MARKERS)) return 'pet';
    if (hasMarker(category, HOUSEHOLD_MARKERS)) return 'household';
    if (hasMarker(category, COSMETIC_MARKERS)) return 'cosmetic';
    if (hasMarker(category, FOOD_MARKERS)) return 'food';
  }
  if (name) {
    if (hasMarker(name, PET_MARKERS)) return 'pet';
    if (hasMarker(name, HOUSEHOLD_MARKERS)) return 'household';
    if (hasMarker(name, COSMETIC_MARKERS) && !hasMarker(name, FOOD_MARKERS)) return 'cosmetic';
    if (hasMarker(name, FOOD_MARKERS)) return 'food';
  }
  if (text) {
    const hits = INCI_ONLY_TOKENS.filter((token) => text.includes(token)).length;
    if (hits >= 2) return 'cosmetic';
    if (hits === 1 && text.split(' ').length <= 8) return 'cosmetic';
  }
  return 'unknown';
}
