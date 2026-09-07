/**
 * Curated local knowledge lists for the food-label analysis:
 *  - EU allergen group aliases (Annex II of Reg. (EU) No 1169/2011),
 *  - a food-additive registry (E numbers; Reg. (EC) No 1333/2008 context),
 *  - a common-ingredient family table (FR/EN spellings found on EU & MA
 *    labels).
 *
 * Everything is a plain, versioned, deterministic local table — the analysis
 * never depends on a hosted service. New terms are added by code review, the
 * same way the CosIng snapshot is pinned.
 */

import type {
  AdditiveBand,
  AdditiveHit,
  AdditiveRole,
  AllergenGroup,
  FoodFamily,
  FoodKnowledgeRow,
} from './types';

/** Lowercase + strip diacritics + collapse whitespace → stable match key. */
export function foldForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when `term` appears in `hay` on word-ish boundaries (no false hit in
 *  "laitue" for "lait", "noix" swallowed by "noix de coco" excluded). */
export function includesTerm(hay: string, term: string, excluded: string[] = []): boolean {
  if (!term) return false;
  for (const ex of excluded) {
    if (hay.includes(ex)) return false;
  }
  const re = new RegExp(`(^|\\s)${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s|$)`, 'i');
  return re.test(hay);
}

export function allergenTermMatches(hay: string, terms: readonly string[]): boolean {
  return terms.some((t) => includesTerm(hay, t));
}

// --- EU 1169/2011 Annex II allergen groups ----------------------------------
// Terms are label spellings in FR + EN (+ a few ES/DE/IT common on imported
// goods). "Guard" phrases prevent false positives (noix de coco ≠ "nuts").
const ALLERGEN_TERMS: Record<AllergenGroup, { terms: string[]; guard: string[] }> = {
  gluten: {
    terms: [
      'gluten', 'blé', 'froment', 'wheat', 'seigle', 'rye', 'orge', 'barley',
      'avoine', 'oats', 'épeautre', 'spelt', 'kamut', 'triticale',
    ],
    guard: [],
  },
  crustaceans: {
    terms: [
      'crevette', 'crevettes', 'shrimp', 'crabe', 'crab', 'langouste', 'lobster',
      'homard', 'écrevisse', 'crayfish', 'crustacés', 'crustacean', 'crustaceans',
    ],
    guard: [],
  },
  eggs: {
    terms: ['œuf', 'oeuf', 'egg', 'eggs', 'ovo', 'albumine', 'albumen', 'ovoproduit', 'jaune d’œuf'],
    guard: [],
  },
  fish: {
    terms: [
      'poisson', 'fish', 'saumon', 'salmon', 'thon', 'tuna', 'cabillaud', 'cod',
      'anchois', 'anchovy', 'sardine', 'sardines', 'merlu', 'hake', 'truite', 'trout',
    ],
    guard: [],
  },
  peanuts: {
    terms: ['arachide', 'arachides', 'cacahuète', 'cacahuete', 'peanut', 'peanuts'],
    guard: [],
  },
  soybeans: {
    terms: ['soja', 'soya', 'soybean', 'soybeans', 'soy', 'tofu', 'edamame', 'sauce soja'],
    guard: [],
  },
  milk: {
    terms: [
      'lait', 'milk', 'lactosérum', 'lactoserum', 'whey', 'petit-lait', 'buttermilk',
      'babeurre', 'crème', 'creme', 'cream', 'beurre', 'butter', 'ghee', 'caséine',
      'casein', 'caseinate', 'lactose', 'protéines du lait', 'protéines de lait',
      'milk protein', 'yaourt', 'yogurt', 'yoghurt', 'fromage', 'cheese', 'crème fraîche',
      'creme fraiche', 'lait de vache', 'lait écrémé', 'lait entier', 'lait en poudre',
    ],
    guard: ['crème de riz', 'crème de marron', 'crème de coco', 'cream cheese frosting'],
  },
  nuts: {
    terms: [
      'noix', 'walnut', 'noisette', 'hazelnut', 'amande', 'almond', 'pistache',
      'pistachio', 'noix de cajou', 'cashew', 'noix de pécan', 'pecan', 'noix du brésil',
      'brazil nut', 'noix de macadamia', 'macadamia', 'noix de pacane',
    ],
    guard: ['noix de coco', 'coconut', 'huile de coco', 'coco râpé', 'coco rape'],
  },
  celery: {
    terms: ['céleri', 'celeri', 'celery', 'graines de céleri', 'celery seed', 'céleri-rave'],
    guard: [],
  },
  mustard: {
    terms: ['moutarde', 'mustard', 'moutarde de dijon', 'graines de moutarde'],
    guard: [],
  },
  sesame: {
    terms: ['sésame', 'sesame', 'tahini', 'tahin', 'sesam'],
    guard: [],
  },
  sulphites: {
    terms: ['sulfites', 'sulphites', 'sulfite', 'sulphite', 'sulfur dioxide', 'anhydride sulfureux', 'métabisulfite', 'metabisulfite'],
    guard: [],
  },
  lupin: {
    terms: ['lupin', 'lupine', 'lupini'],
    guard: [],
  },
  molluscs: {
    terms: [
      'mollusques', 'mollusc', 'molluscs', 'moules', 'mussels', 'huître', 'huîtres',
      'oyster', 'oysters', 'calamar', 'squid', 'seiche', 'cuttlefish', 'poulpe',
      'octopus', 'coquille saint-jacques', 'scallop', 'bigorneau', 'whelk', 'palourde',
      'clam',
    ],
    guard: [],
  },
};

export const ALLERGEN_GROUPS: AllergenGroup[] = [
  'gluten', 'crustaceans', 'eggs', 'fish', 'peanuts', 'soybeans', 'milk',
  'nuts', 'celery', 'mustard', 'sesame', 'sulphites', 'lupin', 'molluscs',
];

export function detectAllergenGroups(foldedText: string): AllergenGroup[] {
  const found: AllergenGroup[] = [];
  for (const group of ALLERGEN_GROUPS) {
    const { terms, guard } = ALLERGEN_TERMS[group];
    if (allergenTermMatches(foldedText, terms) && !allergenTermMatches(foldedText, guard)) {
      found.push(group);
    }
  }
  return found;
}

// --- Additive registry (Reg. (EC) No 1333/2008) ------------------------------
interface AdditiveDef {
  e: string;
  /** Alternative spellings incl. the plain name ("acide citrique"). */
  names: string[];
  band: AdditiveBand;
  role: AdditiveRole;
  /** EU notice codes (rendered via localized keys). */
  notices?: string[];
  note?: string;
}

const ADDITIVES: AdditiveDef[] = [
  // Colours
  { e: 'E100', names: ['curcumine', 'curcumin'], band: 'neutral', role: 'colour' },
  { e: 'E102', names: ['tartrazine', 'tartrazin'], band: 'watch', role: 'colour', notices: ['eu-children-warning'], note: 'Yellow azo dye; Annex V warning (activity/attention in children).' },
  { e: 'E104', names: ['jaune de quinoléine', 'quinoline yellow'], band: 'watch', role: 'colour', notices: ['eu-children-warning'] },
  { e: 'E110', names: ['jaune orangé s', 'sunset yellow', 'orange yellow s'], band: 'watch', role: 'colour', notices: ['eu-children-warning'] },
  { e: 'E120', names: ['cochenille', 'carmin', 'acide carminique', 'cochineal', 'carmine'], band: 'neutral', role: 'colour' },
  { e: 'E122', names: ['azorubine', 'carmoisine', 'azorubine'], band: 'watch', role: 'colour', notices: ['eu-children-warning'] },
  { e: 'E124', names: ['ponceau 4r', 'ponceau 4r rouge', 'cochenille rouge a'], band: 'watch', role: 'colour', notices: ['eu-children-warning'] },
  { e: 'E129', names: ['rouge allura ac', 'allura red'], band: 'watch', role: 'colour', notices: ['eu-children-warning'] },
  { e: 'E131', names: ['bleu patenté v', 'patent blue v'], band: 'watch', role: 'colour' },
  { e: 'E132', names: ['indigotine', 'carmin d’indigo', 'indigo carmine'], band: 'neutral', role: 'colour' },
  { e: 'E133', names: ['bleu brillant fcf', 'brilliant blue fcf'], band: 'neutral', role: 'colour' },
  { e: 'E150', names: ['caramel', 'caramel e150', 'plain caramel'], band: 'neutral', role: 'colour' },
  { e: 'E153', names: ['noir végétal', 'vegetable carbon'], band: 'neutral', role: 'colour' },
  { e: 'E160', names: ['bêta-carotène', 'beta-carotene', 'carotènes'], band: 'neutral', role: 'colour' },
  { e: 'E160b', names: ['rocou', 'annatto', 'norbixine'], band: 'neutral', role: 'colour' },
  { e: 'E171', names: ['dioxyde de titane', 'titanium dioxide', 'e171'], band: 'avoid', role: 'colour', notices: ['eu-banned'], note: 'No longer authorised as a food additive in the EU (2022).' },
  // Preservatives
  { e: 'E200', names: ['acide sorbique', 'sorbic acid'], band: 'neutral', role: 'preservative' },
  { e: 'E202', names: ['sorbate de potassium', 'potassium sorbate'], band: 'neutral', role: 'preservative' },
  { e: 'E210', names: ['acide benzoïque', 'benzoic acid'], band: 'neutral', role: 'preservative' },
  { e: 'E211', names: ['benzoate de sodium', 'sodium benzoate'], band: 'watch', role: 'preservative', note: 'EU reviewed; see Reg. 1333/2008 Annex II conditions.' },
  { e: 'E220', names: ['anhydride sulfureux', 'sulfur dioxide'], band: 'watch', role: 'preservative' },
  { e: 'E221', names: ['sulfite de sodium', 'sodium sulfite'], band: 'watch', role: 'preservative' },
  { e: 'E223', names: ['métabisulfite de sodium', 'sodium metabisulfite'], band: 'watch', role: 'preservative' },
  { e: 'E224', names: ['métabisulfite de potassium', 'potassium metabisulfite'], band: 'watch', role: 'preservative' },
  { e: 'E249', names: ['nitrite de potassium', 'potassium nitrite'], band: 'watch', role: 'preservative', note: 'Nitrites: EU usage conditions strictly cap added amounts.' },
  { e: 'E250', names: ['nitrite de sodium', 'sodium nitrite'], band: 'watch', role: 'preservative', note: 'Nitrites: EU usage conditions strictly cap added amounts.' },
  { e: 'E251', names: ['nitrate de sodium', 'sodium nitrate'], band: 'watch', role: 'preservative' },
  { e: 'E252', names: ['nitrate de potassium', 'potassium nitrate'], band: 'watch', role: 'preservative' },
  // Antioxidants
  { e: 'E300', names: ['acide ascorbique', 'ascorbic acid', 'vitamine c'], band: 'neutral', role: 'antioxidant' },
  { e: 'E301', names: ['ascorbate de sodium', 'sodium ascorbate'], band: 'neutral', role: 'antioxidant' },
  { e: 'E304', names: ['palmitate d’ascorbyle', 'ascorbyl palmitate'], band: 'neutral', role: 'antioxidant' },
  { e: 'E306', names: ['extrait riche en tocophérols', 'tocopherol-rich extract'], band: 'neutral', role: 'antioxidant' },
  { e: 'E307', names: ['alpha-tocophérol', 'alpha-tocopherol'], band: 'neutral', role: 'antioxidant' },
  { e: 'E310', names: ['gallate de propyle', 'propyl gallate'], band: 'watch', role: 'antioxidant' },
  { e: 'E320', names: ['bha', 'butylhydroxyanisole'], band: 'watch', role: 'antioxidant' },
  { e: 'E321', names: ['bht', 'butylhydroxytoluène', 'butylhydroxytoluene'], band: 'watch', role: 'antioxidant' },
  // Emulsifiers / stabilisers / thickeners
  { e: 'E322', names: ['lécithine', 'lecithin', 'lécithine de tournesol', 'lécithine de soja'], band: 'neutral', role: 'emulsifier' },
  { e: 'E407', names: ['carraghénane', 'carrageenan', 'carraghénine'], band: 'watch', role: 'stabiliser' },
  { e: 'E410', names: ['farine de graines de caroube', 'carob gum', 'gomme de caroube'], band: 'neutral', role: 'stabiliser' },
  { e: 'E412', names: ['gomme de guar', 'guar gum'], band: 'neutral', role: 'thickener' },
  { e: 'E415', names: ['gomme xanthane', 'xanthan gum'], band: 'neutral', role: 'thickener' },
  { e: 'E440', names: ['pectine', 'pectin'], band: 'neutral', role: 'stabiliser' },
  { e: 'E460', names: ['cellulose', 'cellulose microcristalline'], band: 'neutral', role: 'stabiliser' },
  { e: 'E466', names: ['carboxyméthylcellulose', 'carboxymethylcellulose'], band: 'neutral', role: 'stabiliser' },
  { e: 'E471', names: ['mono- et diglycérides d’acides gras', 'mono- and diglycerides of fatty acids', 'monoglycérides'], band: 'neutral', role: 'emulsifier' },
  { e: 'E481', names: ['stéaroyl-2-lactylate de sodium', 'sodium stearoyl lactylate'], band: 'neutral', role: 'emulsifier' },
  // Sweeteners
  { e: 'E420', names: ['sorbitol', 'sirop de sorbitol'], band: 'neutral', role: 'sweetener' },
  { e: 'E951', names: ['aspartame', 'aspartam'], band: 'watch', role: 'sweetener', notices: ['phenylalanine'], note: 'Labels must state "contains a source of phenylalanine" (EU).' },
  { e: 'E950', names: ['acésulfame k', 'acesulfame potassium', 'acesulfame k'], band: 'neutral', role: 'sweetener' },
  { e: 'E954', names: ['saccharine', 'saccharin'], band: 'watch', role: 'sweetener' },
  { e: 'E955', names: ['sucralose'], band: 'neutral', role: 'sweetener' },
  { e: 'E960', names: ['glycosides de stéviol', 'stévia', 'steviol glycosides', 'stevia'], band: 'neutral', role: 'sweetener' },
  { e: 'E961', names: ['néotame', 'neotame'], band: 'neutral', role: 'sweetener' },
  // Acidity / raising / flavour enhancers / glazing / other
  { e: 'E270', names: ['acide lactique', 'lactic acid'], band: 'neutral', role: 'acidity' },
  { e: 'E296', names: ['acide malique', 'malic acid'], band: 'neutral', role: 'acidity' },
  { e: 'E297', names: ['acide fumarique', 'fumaric acid'], band: 'neutral', role: 'acidity' },
  { e: 'E330', names: ['acide citrique', 'citric acid'], band: 'neutral', role: 'acidity' },
  { e: 'E331', names: ['citrate de sodium', 'sodium citrate'], band: 'neutral', role: 'acidity' },
  { e: 'E332', names: ['citrate de potassium', 'potassium citrate'], band: 'neutral', role: 'acidity' },
  { e: 'E500', names: ['carbonate de sodium', 'bicarbonate de sodium', 'sodium carbonate', 'sodium bicarbonate'], band: 'neutral', role: 'raising' },
  { e: 'E503', names: ['carbonate d’ammonium', 'ammonium carbonate'], band: 'neutral', role: 'raising' },
  { e: 'E621', names: ['glutamate monosodique', 'monosodium glutamate', 'msg'], band: 'watch', role: 'flavour-enhancer' },
  { e: 'E901', names: ['cire d’abeille', 'beeswax'], band: 'neutral', role: 'glazing' },
  { e: 'E904', names: ['gomme laque', 'shellac'], band: 'neutral', role: 'glazing' },
];

const ADDITIVE_BY_CODE = new Map<string, AdditiveDef>();
const ADDITIVE_ALIASES = new Map<string, AdditiveDef>();
for (const def of ADDITIVES) {
  ADDITIVE_BY_CODE.set(def.e.toLowerCase(), def);
  ADDITIVE_ALIASES.set(foldForMatch(def.e), def);
  for (const name of def.names) ADDITIVE_ALIASES.set(foldForMatch(name), def);
}

export const CHILDREN_WARNING_CODES = new Set(['E102', 'E104', 'E110', 'E122', 'E124', 'E129']);

/** Read an additive out of one folded ingredient token, if any. */
export function lookupAdditive(folded: string): AdditiveHit | null {
  const direct = ADDITIVE_ALIASES.get(folded);
  if (direct) return toHit(direct, folded);
  // Prefixed phrasing ("acide citrique", "nitrite de sodium" after colons/roles).
  for (const [alias, def] of ADDITIVE_ALIASES) {
    if (alias.length >= 4 && alias !== foldForMatch(def.e) && folded.startsWith(`${alias} `)) {
      return toHit(def, folded);
    }
  }
  const eMatch = folded.match(/(^|\s)(e\d{3,4}[a-z]?)(\s|$)/);
  if (eMatch) {
    const def = ADDITIVE_BY_CODE.get(eMatch[2].toLowerCase());
    if (def) return toHit(def, folded);
  }
  return null;
}

function toHit(def: AdditiveDef, rawFolded: string): AdditiveHit {
  return {
    code: def.e,
    raw: rawFolded,
    band: def.band,
    role: def.role,
    notices: def.notices ?? [],
  };
}

export const ADDITIVE_COUNT = ADDITIVES.length;

// --- Common-ingredient family table ------------------------------------------
// Keys are accent-folded spellings; matching is longest-prefix/boundary-first
// so "crème fraîche" beats "crème" and "lait écrémé" beats "lait".
const ROWS: FoodKnowledgeRow[] = [
  { keys: ['lait de vache', 'lait de vache pasteurisé', 'lait entier', 'lait écrémé', 'lait demi-écrémé', 'lait en poudre', 'lait concentré'], family: 'dairy', allergens: ['milk'], roles: ['base'], note: 'Cow milk; source of dairy proteins, fat and lactose.' },
  { keys: ['lait'], family: 'dairy', allergens: ['milk'], roles: ['base'] },
  { keys: ['crème fraîche', 'creme fraiche', 'crème fraîche pasteurisée', 'crème liquide', 'cream', 'crème entière'], family: 'dairy', allergens: ['milk'], roles: ['fat', 'texture'], note: 'Pasteurised dairy cream; contributes fat and mouthfeel.' },
  { keys: ['crème'], family: 'dairy', allergens: ['milk'], roles: ['fat'] },
  { keys: ['lactosérum', 'lactoserum', 'petit-lait', 'whey', 'babeurre', 'buttermilk'], family: 'dairy', allergens: ['milk'], roles: ['by-product'] },
  { keys: ['beurre', 'butter'], family: 'dairy', allergens: ['milk'], roles: ['fat'] },
  { keys: ['yaourt', 'yogurt', 'yoghurt', 'yaourt nature'], family: 'dairy', allergens: ['milk'], roles: ['culture'] },
  { keys: ['fromage blanc', 'fromage', 'cheese', 'fromage frais'], family: 'dairy', allergens: ['milk'], roles: ['base'] },
  { keys: ['caséine', 'casein', 'lactose', 'protéines de lait'], family: 'dairy', allergens: ['milk'], roles: ['protein'] },
  { keys: ['ferments lactiques', 'lactic ferments', 'bactéries lactiques', 'ferments', 'cultures lactiques', 'lactic cultures'], family: 'culture', roles: ['ferment'], note: 'Live lactic bacteria used to acidify and flavour fermented dairy.' },
  { keys: ['présure', 'rennet', 'enzyme coagulante', 'coagulating enzyme'], family: 'other', roles: ['enzyme'], note: 'Coagulating enzyme (traditionally calf rennet, now often microbial).' },
  { keys: ['sel', 'sel de mer', 'sel fin', 'sel gemme', 'salt', 'sea salt', 'chlorure de sodium', 'sodium chloride'], family: 'salt', roles: ['seasoning'], note: 'Sodium chloride; seasoning and preservation.' },
  { keys: ['sucre', 'sucre blanc', 'sugar', 'saccharose'], family: 'sugar', roles: ['sweetener'], note: 'Sucrose.' },
  { keys: ['sucre de canne', 'cane sugar'], family: 'sugar', roles: ['sweetener'] },
  { keys: ['glucose', 'glucose syrup', 'sirop de glucose', 'dextrose', 'fructose'], family: 'sugar', roles: ['sweetener'] },
  { keys: ['miel', 'honey'], family: 'sugar', roles: ['sweetener', 'natural'] },
  { keys: ['eau', 'water'], family: 'water', roles: ['base'] },
  { keys: ['huile de tournesol', 'sunflower oil', 'huile de colza', 'rapeseed oil', 'huile de palme', 'palm oil', 'huile d’olive', 'olive oil', 'huile végétale', 'vegetable oil', 'huile de soja'], family: 'fat-oil', roles: ['fat'] },
  { keys: ['farine de blé', 'wheat flour', 'farine', 'flour', 'farine de froment'], family: 'cereal', allergens: ['gluten'], roles: ['base'] },
  { keys: ['blé complet', 'whole wheat', 'seigle', 'rye flour', 'orge', 'barley', 'avoine', 'oats', 'épeautre'], family: 'cereal', allergens: ['gluten'], roles: ['base'] },
  { keys: ['céréales', 'cereals', 'céréales complètes', 'wholegrain cereals'], family: 'cereal', roles: ['base'] },
  { keys: ['riz', 'rice', 'farine de riz'], family: 'cereal', roles: ['base'] },
  { keys: ['maïs', 'corn', 'farine de maïs'], family: 'cereal', roles: ['base'] },
  { keys: ['amidon', 'starch', 'amidon de maïs', 'fécule de pomme de terre', 'potato starch'], family: 'cereal', roles: ['texture'] },
  { keys: ['œuf', 'oeuf', 'egg', 'œufs', 'oeufs', 'jaune d’œuf', 'blanc d’œuf'], family: 'egg', allergens: ['eggs'], roles: ['protein', 'texture'] },
  { keys: ['arachide', 'peanut', 'cacahuète'], family: 'legume', allergens: ['peanuts'], roles: ['protein'] },
  { keys: ['soja', 'soya', 'soy', 'lécithine de soja'], family: 'legume', allergens: ['soybeans'], roles: ['protein'] },
  { keys: ['noix de coco', 'coconut'], family: 'fruit-veg', roles: ['fat', 'natural'] },
  { keys: ['noix', 'walnut', 'noisette', 'hazelnut', 'amande', 'almond', 'pistache', 'pistachio', 'noix de cajou', 'cashew'], family: 'nut-seed', allergens: ['nuts'], roles: ['fat'] },
  { keys: ['sésame', 'sesame'], family: 'nut-seed', allergens: ['sesame'], roles: ['seed'] },
  { keys: ['graines de tournesol', 'sunflower seeds', 'graines de lin', 'flaxseed'], family: 'nut-seed', roles: ['seed'] },
  { keys: ['tomate', 'tomato', 'concentré de tomate', 'purée de tomate'], family: 'fruit-veg', roles: ['vegetable'] },
  { keys: ['oignon', 'onion'], family: 'fruit-veg', roles: ['vegetable'] },
  { keys: ['ail', 'garlic'], family: 'fruit-veg', roles: ['vegetable'] },
  { keys: ['pomme', 'apple', 'jus de pomme', 'purée de pomme'], family: 'fruit-veg', roles: ['fruit'] },
  { keys: ['banane', 'banana'], family: 'fruit-veg', roles: ['fruit'] },
  { keys: ['fraise', 'strawberry'], family: 'fruit-veg', roles: ['fruit'] },
  { keys: ['citron', 'lemon', 'jus de citron'], family: 'fruit-veg', roles: ['fruit', 'acidity'] },
  { keys: ['orange', 'orange juice', 'jus d’orange'], family: 'fruit-veg', roles: ['fruit'] },
  { keys: ['raisin', 'grape'], family: 'fruit-veg', roles: ['fruit'] },
  { keys: ['pomme de terre', 'potato'], family: 'fruit-veg', roles: ['vegetable'] },
  { keys: ['carotte', 'carrot'], family: 'fruit-veg', roles: ['vegetable'] },
  { keys: ['champignon', 'mushroom', 'champignons'], family: 'fruit-veg', roles: ['vegetable'] },
  { keys: ['lentilles', 'lentils', 'pois chiches', 'chickpeas', 'haricots', 'beans'], family: 'legume', roles: ['protein'] },
  { keys: ['viande de bœuf', 'beef', 'viande bovine', 'bœuf'], family: 'meat-fish', roles: ['protein'] },
  { keys: ['viande de porc', 'pork'], family: 'meat-fish', roles: ['protein'] },
  { keys: ['poulet', 'chicken', 'volaille'], family: 'meat-fish', roles: ['protein'] },
  { keys: ['saumon', 'salmon', 'thon', 'tuna', 'cabillaud', 'cod', 'poisson', 'fish'], family: 'meat-fish', roles: ['protein'] },
  { keys: ['gélatine', 'gelatin'], family: 'other', roles: ['texture'], note: 'Usually of animal (bovine/porcine) origin.' },
  { keys: ['vanille', 'vanilla', 'extrait de vanille', 'arôme naturel de vanille'], family: 'herb-spice', roles: ['flavour', 'natural'] },
  { keys: ['cacao', 'cocoa', 'cacao en poudre', 'chocolat', 'chocolate'], family: 'herb-spice', roles: ['flavour'] },
  { keys: ['poivre', 'pepper', 'épices', 'spices', 'herbes', 'herbs', 'ail des ours', 'persil', 'parsley'], family: 'herb-spice', roles: ['seasoning'] },
  { keys: ['arôme', 'arômes', 'arome', 'arômes naturels', 'natural flavour', 'flavour', 'flavouring'], family: 'other', roles: ['flavour'] },
  { keys: ['maltodextrine', 'maltodextrin'], family: 'cereal', roles: ['texture'] },
  { keys: ['levure', 'yeast', 'levure de boulanger'], family: 'culture', roles: ['ferment'] },
  { keys: ['son', 'bran', 'fibres', 'fibre'], family: 'cereal', roles: ['fibre'] },
  { keys: ['amidon modifié', 'modified starch'], family: 'cereal', roles: ['texture'] },
];

/** Boundary-safe matching keys → row (longest key wins). */
const ROW_KEYS = ROWS.flatMap((row) => row.keys.map((k) => ({ key: foldForMatch(k), row }))).sort(
  (a, b) => b.key.length - a.key.length,
);

export interface FoodRowHit {
  row: FoodKnowledgeRow;
  key: string;
}

/** Look up the best family row for one folded ingredient token. */
export function lookupFoodRow(folded: string): FoodRowHit | null {
  if (!folded) return null;
  for (const { key, row } of ROW_KEYS) {
    if (folded === key) return { row, key };
    // Prefix on a word boundary: "crème fraîche" token hits key "crème".
    if (folded.startsWith(`${key} `)) return { row, key };
    // Key embedded on word boundaries: "protéines de lait" hits "lait".
    if (includesTerm(folded, key)) return { row, key };
  }
  return null;
}

export const FOOD_ROW_COUNT = ROWS.length;
export const FOOD_DATASET_VERSION = '2026-09-food-v1';
