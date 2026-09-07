/**
 * Domain resolution for the label-knowledge panel: is this scanned/pasted
 * label a COSMETIC (INCI) list or a FOOD ingredient list?
 *
 * The panel renders the existing INCI engine for cosmetics and the food
 * knowledge engine for food. Barcode lookups know the answer best (beauty vs
 * food mirrors), but catalog/seed/manual records only carry category + name +
 * optional text, so this module guesses from those. Guesses are conservative:
 * anything ambiguous defaults to FOOD (grocery context); the UI never shows a
 * misleading panel because each panel itself is domain-appropriate.
 */

import type { FoodDomain } from './types';
import { foldForMatch } from './lists';

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

export function detectLabelDomain(input: {
  category?: string;
  name?: string;
  ingredientsText?: string;
}): FoodDomain {
  const category = foldForMatch(input.category ?? '');
  const name = foldForMatch(input.name ?? '');
  const text = foldForMatch(input.ingredientsText ?? '');

  if (category) {
    if (hasMarker(category, COSMETIC_MARKERS)) return 'cosmetic';
    if (hasMarker(category, FOOD_MARKERS)) return 'food';
  }
  if (name) {
    if (hasMarker(name, COSMETIC_MARKERS) && !hasMarker(name, FOOD_MARKERS)) return 'cosmetic';
    if (hasMarker(name, FOOD_MARKERS)) return 'food';
  }
  if (text) {
    const hits = INCI_ONLY_TOKENS.filter((token) => text.includes(token)).length;
    if (hits >= 2) return 'cosmetic';
    if (hits === 1 && text.split(' ').length <= 8) return 'cosmetic';
  }
  return 'food';
}
