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
  FoodUnspecifiedClass,
} from './types';

/** Lowercase + strip diacritics + collapse whitespace → stable match key. */
export function foldForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .normalize('NFD')
    // Strip every combining mark (Latin accents AND Arabic hamza/diacritics)
    // so 'é' → 'e' and 'أ' → 'ا' fold to one canonical spelling.
    .replace(/\p{M}+/gu, '')
    .replace(/[’']/g, ' ')
    // Keep every letter/digit of any script (Arabic market labels print
    // ingredient names in Arabic); only punctuation becomes a separator.
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when `term` appears in `hay` on word-ish boundaries (so "lait" does
 * not match "laitue"). Optional exclusions are retained for other callers. */
export function includesTerm(hay: string, term: string, excluded: string[] = []): boolean {
  if (!term) return false;
  for (const ex of excluded) {
    if (hay.includes(ex)) return false;
  }
  const re = new RegExp(`(^|\\s)${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s|$)`, 'i');
  return re.test(hay);
}

export function allergenTermMatches(hay: string, terms: readonly string[]): boolean {
  // Alias tables remain readable (accented, punctuated label spellings) while
  // the scanner always works on folded OCR text.
  return terms.some((term) => includesTerm(hay, foldForMatch(term)));
}

// --- EU 1169/2011 Annex II allergen groups ----------------------------------
// Terms are label spellings in FR + EN (+ a few ES/DE/IT common on imported
// goods). "Guard" phrases prevent false positives (noix de coco ≠ "nuts").
const ALLERGEN_TERMS: Record<AllergenGroup, { terms: string[]; guard: string[] }> = {
  gluten: {
    terms: [
      'gluten', 'blé', 'froment', 'wheat', 'seigle', 'rye', 'orge', 'barley',
      'avoine', 'oats', 'épeautre', 'spelt', 'kamut', 'triticale',
      'tarwe', 'rogge', 'haver', 'gerst',
    
      'قمح',
      'القمح',
      'طحين القمح',
      'دقيق القمح',
      'فرينة',
      'شعير',
      'الشعير',
      'شوفان',
      'الشوفان',
      'جاودار',
      'خبز',
      'جلوتين',
      'الجلوتين',
      'سميد',
      'كسكس',],
    guard: [],
  },
  crustaceans: {
    terms: [
      'crevette', 'crevettes', 'shrimp', 'crabe', 'crab', 'langouste', 'lobster',
      'homard', 'écrevisse', 'crayfish', 'crustacés', 'crustacean', 'crustaceans',
    
      'قريدس',
      'القريدس',
      'روبيان',
      'الروبيان',
      'جمبري',
      'الجمبري',
      'سلطعون',
      'كركند',
      'قشريات',],
    guard: [],
  },
  eggs: {
    terms: ['بيض', 'البيض', 'أصفر البيض', 'صفار البيض', 'بياض البيض', 'مسحوق البيض', 'œuf', 'oeuf', 'egg', 'eggs', 'ovo', 'albumine', 'albumen', 'ovoproduit', 'jaune d’œuf', 'ei', 'eieren', 'eigeel'],
    guard: [],
  },
  fish: {
    terms: [
      'poisson', 'fish', 'saumon', 'salmon', 'thon', 'tuna', 'cabillaud', 'cod',
      'anchois', 'anchovy', 'sardine', 'sardines', 'merlu', 'hake', 'truite', 'trout',
    
      'سمك',
      'السمك',
      'تونة',
      'التونة',
      'سردين',
      'السردين',
      'سلمون',
      'ماكريل',
      'قد',
      'أسماك',],
    guard: [],
  },
  peanuts: {
    terms: ['فول سوداني', 'الفول السوداني', 'كاكاوية', 'arachide', 'arachides', 'cacahuète', 'cacahuete', 'peanut', 'peanuts'],
    guard: [],
  },
  soybeans: {
    terms: ['صوجا', 'الصوجا', 'صويا', 'فول الصويا', 'ليسيتين الصوجا', 'ليستين الصوجا', 'زيت الصوجا', 'soja', 'soya', 'soybean', 'soybeans', 'soy', 'tofu', 'edamame', 'sauce soja'],
    guard: [],
  },
  milk: {
    terms: [
      'lait', 'milk', 'lactosérum', 'lactoserum', 'whey', 'petit-lait', 'buttermilk',
      'babeurre', 'crème', 'creme', 'cream', 'beurre', 'butter', 'ghee', 'caséine',
      'casein', 'caseinate', 'lactose', 'protéines du lait', 'protéines de lait',
      'milk protein', 'yaourt', 'yogurt', 'yoghurt', 'fromage', 'cheese', 'crème fraîche',
      'creme fraiche', 'lait de vache', 'lait écrémé', 'lait entier', 'lait en poudre',
      'melk', 'weipoeder', 'wei', 'magere melkpoeder', 'volle melkpoeder',
    
      'حليب',
      'الحليب',
      'لبن',
      'قشدة',
      'القشدة',
      'قشطة',
      'زبدة',
      'الزبدة',
      'جبن',
      'جبنة',
      'أجبان',
      'الأجبان',
      'مسحوق الحليب',
      'بروتينات الحليب',
      'مصل الحليب',
      'لاكتوز',
      'يوغورت',
      'ياغورت',
      'رايب',
      'سمن',
      'حليب مجفف',],
    guard: [
      'crème de riz', 'crème de marron', 'crème de coco', 'coconut cream',
      'lait de coco', 'coconut milk', 'lait d’amande', 'lait d amande', 'almond milk',
      'lait d’avoine', 'lait d avoine', 'oat milk', 'lait de soja', 'soy milk', 'soya milk',
    ],
  },
  nuts: {
    terms: [
      'noix', 'walnut', 'walnuts', 'noisette', 'noisettes', 'hazelnut', 'hazelnuts',
      'amande', 'amandes', 'almond', 'almonds', 'pistache', 'pistaches', 'pistachio',
      'pistachios', 'noix de cajou', 'cashew', 'cashews', 'noix de pécan',
      'noix de pecan', 'pecan', 'pecans', 'pecan nut', 'pecan nuts', 'noix du brésil',
      'noix du bresil', 'brazil nut', 'brazil nuts', 'noix de macadamia', 'macadamia',
      'macadamias', 'macadamia nut', 'macadamia nuts', 'queensland nut',
      'queensland nuts', 'noix de pacane',
    
      'لوز',
      'اللوز',
      'بندق',
      'البندق',
      'جوز',
      'الجوز',
      'فستق',
      'الفستق',
      'كاجو',
      'عين الجمل',
      'بيكان',],
    guard: [
      'noix de coco', 'coconut', 'huile de coco', 'coco râpé', 'coco rape',
      'noix de muscade', 'جوز الهند', 'زيت جوز الهند', 'حليب جوز الهند',
    ],
  },
  celery: {
    terms: ['كرفس', 'الكرفس', 'céleri', 'celeri', 'celery', 'graines de céleri', 'celery seed', 'céleri-rave'],
    guard: [],
  },
  mustard: {
    terms: ['خردل', 'الخردل', 'موتارد', 'moutarde', 'mustard', 'moutarde de dijon', 'graines de moutarde'],
    guard: [],
  },
  sesame: {
    terms: ['سمسم', 'السمسم', 'جلجلان', 'طحينة', 'الطحينة', 'sésame', 'sesame', 'tahini', 'tahin', 'sesam'],
    guard: [],
  },
  sulphites: {
    terms: ['سلفيت', 'سلفيتات', 'كبريتيت', 'ميتابيسلفيت', 'ثنائي أكسيد الكبريت', 'مواد كبريتية', 'sulfites', 'sulphites', 'sulfite', 'sulphite', 'sulfur dioxide', 'anhydride sulfureux', 'métabisulfite', 'metabisulfite'],
    guard: [],
  },
  lupin: {
    terms: ['ترمس', 'الترمس', 'lupin', 'lupine', 'lupini'],
    guard: [],
  },
  molluscs: {
    terms: [
      'mollusques', 'mollusc', 'molluscs', 'moules', 'mussels', 'huître', 'huîtres',
      'oyster', 'oysters', 'calamar', 'squid', 'seiche', 'cuttlefish', 'poulpe',
      'octopus', 'coquille saint-jacques', 'scallop', 'bigorneau', 'whelk', 'palourde',
      'clam',
    
      'رخويات',
      'محار',
      'المحار',
      'حلزون',
      'أخطبوط',
      'كاليماري',],
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
    // Remove only the guarded phrase, rather than suppressing the whole token.
    // A compound ingredient such as "almonds and coconut" must still report
    // nuts even though "coconut" itself is not an Annex II nut.
    const searchable = guard.reduce(
      (text, phrase) => text.replaceAll(foldForMatch(phrase), ' '),
      foldedText,
    ).replace(/\s+/g, ' ').trim();
    if (allergenTermMatches(searchable, terms)) found.push(group);
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
  { e: 'E150', names: ['caramel', 'caramel e150', 'plain caramel', 'كراميل', 'كرامل', ], band: 'neutral', role: 'colour' },
  { e: 'E153', names: ['noir végétal', 'vegetable carbon'], band: 'neutral', role: 'colour' },
  { e: 'E160', names: ['bêta-carotène', 'beta-carotene', 'carotènes', 'بيتا كاروتين', 'كاروتين', 'كاروتينات', 'carotenes', ], band: 'neutral', role: 'colour' },
  { e: 'E160b', names: ['rocou', 'annatto', 'norbixine', 'annatto norbixine'], band: 'neutral', role: 'colour' },
  { e: 'E171', names: ['dioxyde de titane', 'titanium dioxide', 'e171'], band: 'avoid', role: 'colour', notices: ['eu-banned'], note: 'No longer authorised as a food additive in the EU (2022).' },
  // Preservatives
  { e: 'E200', names: ['acide sorbique', 'sorbic acid', 'حمض السوربيك', 'حامض السوريك', ], band: 'neutral', role: 'preservative' },
  { e: 'E202', names: ['sorbate de potassium', 'potassium sorbate', 'سوربات البوتاسيوم', 'سوريات البوتاسيوم', 'سوربات البوتاسيوم (e202)', ], band: 'neutral', role: 'preservative' },
  { e: 'E210', names: ['acide benzoïque', 'benzoic acid'], band: 'neutral', role: 'preservative' },
  { e: 'E211', names: ['benzoate de sodium', 'sodium benzoate', 'بنزوات الصوديوم', 'بنزوات الصوديوم (e211)', ], band: 'watch', role: 'preservative', note: 'EU reviewed; see Reg. 1333/2008 Annex II conditions.' },
  { e: 'E220', names: ['anhydride sulfureux', 'sulfur dioxide'], band: 'watch', role: 'preservative' },
  { e: 'E221', names: ['sulfite de sodium', 'sodium sulfite'], band: 'watch', role: 'preservative' },
  { e: 'E223', names: ['métabisulfite de sodium', 'sodium metabisulfite'], band: 'watch', role: 'preservative' },
  { e: 'E224', names: ['métabisulfite de potassium', 'potassium metabisulfite'], band: 'watch', role: 'preservative' },
  { e: 'E249', names: ['nitrite de potassium', 'potassium nitrite'], band: 'watch', role: 'preservative', note: 'Nitrites: EU usage conditions strictly cap added amounts.' },
  { e: 'E250', names: ['nitrite de sodium', 'sodium nitrite'], band: 'watch', role: 'preservative', note: 'Nitrites: EU usage conditions strictly cap added amounts.' },
  { e: 'E251', names: ['nitrate de sodium', 'sodium nitrate'], band: 'watch', role: 'preservative' },
  { e: 'E252', names: ['nitrate de potassium', 'potassium nitrate'], band: 'watch', role: 'preservative' },
  // Antioxidants
  // NB: "vitamin c"/"فيتامين ج" are intentionally not E300 aliases — on a label they are
  // declared as nutrients (fortification rows), not as the additive ascorbic acid.
  { e: 'E300', names: ['acide ascorbique', 'ascorbic acid', 'vitamine c', 'حمض الأسكوربيك'], band: 'neutral', role: 'antioxidant' },
  { e: 'E301', names: ['ascorbate de sodium', 'sodium ascorbate'], band: 'neutral', role: 'antioxidant' },
  { e: 'E304', names: ['palmitate d’ascorbyle', 'ascorbyl palmitate'], band: 'neutral', role: 'antioxidant' },
  { e: 'E306', names: ['extrait riche en tocophérols', 'tocopherol-rich extract'], band: 'neutral', role: 'antioxidant' },
  { e: 'E307', names: ['alpha-tocophérol', 'alpha-tocopherol'], band: 'neutral', role: 'antioxidant' },
  { e: 'E310', names: ['gallate de propyle', 'propyl gallate'], band: 'watch', role: 'antioxidant' },
  { e: 'E320', names: ['bha', 'butylhydroxyanisole'], band: 'watch', role: 'antioxidant' },
  { e: 'E321', names: ['bht', 'butylhydroxytoluène', 'butylhydroxytoluene'], band: 'watch', role: 'antioxidant' },
  // Emulsifiers / stabilisers / thickeners
  { e: 'E322', names: ['lécithine', 'lecithin', 'lécithine de tournesol', 'lécithine de soja', 'ليسيتين الصوجا', 'ليستين الصوجا', 'لسيتين الصوجا', 'ليسيتين', 'ليسيتين عباد الشمس', ], band: 'neutral', role: 'emulsifier' },
  { e: 'E407', names: ['carraghénane', 'carrageenan', 'carraghénine', 'كاراجينان', 'كاراجينات', 'كاراگينان', 'كاراجينين', ], band: 'watch', role: 'stabiliser' },
  { e: 'E410', names: ['farine de graines de caroube', 'carob gum', 'gomme de caroube'], band: 'neutral', role: 'stabiliser' },
  { e: 'E412', names: ['gomme de guar', 'guar gum', 'صمغ الغوار', 'صمغ غوار', ], band: 'neutral', role: 'thickener' },
  { e: 'E415', names: ['gomme xanthane', 'xanthan gum', 'صمغ الزنتان', 'صمغ الزانثان', 'صمغ زنتان', ], band: 'neutral', role: 'thickener' },
  { e: 'E440', names: ['pectine', 'pectin', 'بكتين', 'بكتين الفواكه', ], band: 'neutral', role: 'stabiliser' },
  { e: 'E460', names: ['cellulose', 'cellulose microcristalline'], band: 'neutral', role: 'stabiliser' },
  { e: 'E466', names: ['carboxyméthylcellulose', 'carboxymethylcellulose'], band: 'neutral', role: 'stabiliser' },
  { e: 'E471', names: ['mono- et diglycérides d’acides gras', 'mono- and diglycerides of fatty acids', 'monoglycérides', 'أحادي وثنائي كليسريد', 'أحادي وثنائي كليسريد نباتي', 'مونو وديجليسريد', 'mono-diglycerides', ], band: 'neutral', role: 'emulsifier' },
  { e: 'E481', names: ['stéaroyl-2-lactylate de sodium', 'sodium stearoyl lactylate'], band: 'neutral', role: 'emulsifier' },
  // Sweeteners / humectants
  { e: 'E420', names: ['sorbitol', 'sirop de sorbitol'], band: 'neutral', role: 'sweetener' },
  { e: 'E422', names: ['glycérol', 'glycerol', 'glycérine', 'glycerin', 'glycerine'], band: 'neutral', role: 'other', note: 'Glycerol; permitted humectant/sweetener (E422).' },
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
  { e: 'E330', names: ['acide citrique', 'citric acid', 'citroenzuur', 'حمض الستريك', 'حامض الستريك', 'حمض السيتريك', 'حمض الليمون', ], band: 'neutral', role: 'acidity' },
  { e: 'E331', names: ['citrate de sodium', 'sodium citrate', 'سيترات الصوديوم', 'سترات الصوديوم', 'حمض الستريك الصوديوم', ], band: 'neutral', role: 'acidity' },
  { e: 'E332', names: ['citrate de potassium', 'potassium citrate'], band: 'neutral', role: 'acidity' },
  { e: 'E500', names: ['carbonate de sodium', 'bicarbonate de sodium', 'sodium carbonate', 'sodium bicarbonate', 'بيكربونات الصوديوم', 'بيكربونات الصودا', 'كربونات الصوديوم', ], band: 'neutral', role: 'raising' },
  { e: 'E503', names: ['carbonate d’ammonium', 'ammonium carbonate', 'بيكربونات الأمونيوم', 'كربونات الأمونيوم', 'bicarbonate d’ammonium', 'ammonium bicarbonate', ], band: 'neutral', role: 'raising' },
  { e: 'E621', names: ['glutamate monosodique', 'monosodium glutamate', 'msg', 'mononatriumglutamaat'], band: 'watch', role: 'flavour-enhancer' },
  { e: 'E627', names: ['natriumguanylaat', 'disodium guanylate', 'guanylate disodique'], band: 'watch', role: 'flavour-enhancer' },
  { e: 'E631', names: ['dinatriuminosinaat', 'disodium inosinate', 'inosinate disodique'], band: 'watch', role: 'flavour-enhancer' },
  { e: 'E901', names: ['cire d’abeille', 'beeswax'], band: 'neutral', role: 'glazing' },
  { e: 'E904', names: ['gomme laque', 'shellac'], band: 'neutral', role: 'glazing' },
  { e: 'E338', names: ['acide phosphorique', 'phosphoric acid', 'حمض الفوسفوريك'], band: 'neutral', role: 'acidity' },
  { e: 'E339', names: ['phosphates de sodium', 'sodium phosphates', 'فوسفات الصوديوم', 'orthophosphates de sodium'], band: 'neutral', role: 'emulsifier' },
  { e: 'E341', names: ['phosphates de calcium', 'calcium phosphates', 'فوسفات الكالسيوم', 'فوسفات ثلاثي الكالسيوم'], band: 'neutral', role: 'other' },
  { e: 'E385', names: ['calcium disodium edta', 'calcium disodium ethylenediaminetetraacetate', 'edta calcium disodique', 'كالسيوم دي صوديوم edta'], band: 'neutral', role: 'preservative' },
  { e: 'E414', names: ['gomme arabique', 'gum arabic', 'acacia gum', 'صمغ عربي', 'صمغ الأكاسيا'], band: 'neutral', role: 'thickener' },
  { e: 'E445', names: ['esters glycériques de résine de bois', 'glycerol esters of wood rosin', 'إسترات الجلسرين'], band: 'neutral', role: 'emulsifier' },
  { e: 'E450', names: ['diphosphates', 'pyrophosphates', 'pyrophosphate acide de sodium', 'بيروفوسفات', 'ثنائي الفوسفاط', 'أملاح مستحلبة'], band: 'neutral', role: 'raising' },
  { e: 'E451', names: ['triphosphates', 'triphosphate de sodium', 'ثلاثي الفوسفات'], band: 'neutral', role: 'emulsifier' },
  { e: 'E452', names: ['polyphosphates', 'متعدد الفوسفات', 'متعدد الفوسفاط', 'بولي فوسفات'], band: 'neutral', role: 'emulsifier' },
  { e: 'E472e', names: ['esters monoacétyltartriques', 'mono- and diacetyl tartaric acid esters', 'e472e'], band: 'neutral', role: 'emulsifier' },
  { e: 'E282', names: ['propionate de calcium', 'calcium propionate'], band: 'neutral', role: 'preservative' },
  { e: 'E234', names: ['nisine', 'nisin'], band: 'neutral', role: 'preservative' },
  { e: 'E1422', names: ['amidon modifié acétylé', 'acetylated distarch adipate', 'نشا معدل'], band: 'neutral', role: 'stabiliser' },
  { e: 'E1442', names: ['amidon hydroxypropylé', 'hydroxypropyl distarch phosphate', 'نشا معدل (e1442)'], band: 'neutral', role: 'stabiliser' },
  { e: 'E1450', names: ['amidon modifié', 'starch sodium octenyl succinate', 'نشا معدل (e1450)'], band: 'neutral', role: 'stabiliser' },
  { e: 'E491', names: ['monostéarate de sorbitane', 'sorbitan monostearate'], band: 'neutral', role: 'emulsifier' },
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
  return lookupAdditives(folded)[0] ?? null;
}

/**
 * Read EVERY distinct additive named in one folded ingredient token, in the
 * order they appear on the label. A single row can nest several additives —
 * e.g. the seasoning blend
 * "paprikakruiderij (… smaakversterkers {mononatriumglutamaat, natriumguanylaat,
 * dinatriuminosinaat} … citroenzuur …)" names E621, E627, E631 and E330.
 * Earlier code kept only the FIRST additive per token, silently dropping the
 * others from the summary and from the label grade.
 */
export function lookupAdditives(folded: string): AdditiveHit[] {
  const hay = foldForMatch(folded);
  if (!hay) return [];
  const found: { at: number; len: number; def: AdditiveDef }[] = [];
  // Named aliases anywhere in the token (leftmost wins per code, later ones
  // for the same code are deduped). Pure E-code aliases are skipped here and
  // matched separately below, word-boundary only.
  for (const [alias, def] of ADDITIVE_ALIASES) {
    if (alias === foldForMatch(def.e) || alias.length < 4) continue;
    let at = hay.indexOf(alias);
    while (at !== -1) {
      const beforeBoundary = at === 0 || hay[at - 1] === ' ';
      const end = at + alias.length;
      const afterBoundary = end === hay.length || hay[end] === ' ';
      if (beforeBoundary && afterBoundary) found.push({ at, len: alias.length, def });
      at = hay.indexOf(alias, at + 1);
    }
  }
  // Every E code in the token, in label order. Moroccan and French labels
  // routinely list several in one parenthetical — "(E452، E341، E450)" — where
  // an Arabic comma separates them, so whitespace boundaries are not enough.
  for (const match of hay.matchAll(/(?<![\p{L}\p{N}])e\d{3,4}[a-z]{0,2}(?![\p{L}\p{N}])/gu)) {
    const raw = match[0].toLowerCase();
    // "E160a"/"E500ii" name a subgroup of a registered additive. Fall back to
    // the parent entry so a label that does disclose its additive is not
    // reported as unknown (nor mistaken for vague "colour" wording).
    let candidate = raw;
    let def: AdditiveDef | undefined;
    while (candidate.length > 1) {
      def = ADDITIVE_BY_CODE.get(candidate);
      if (def) break;
      const shorter = candidate.replace(/[a-z]+$/, '');
      if (shorter === candidate) break;
      candidate = shorter;
    }
    if (def) found.push({ at: match.index ?? 0, len: raw.length, def });
  }
  found.sort((a, b) => a.at - b.at || b.len - a.len);
  const seen = new Set<string>();
  const hits: AdditiveHit[] = [];
  for (const { def } of found) {
    if (seen.has(def.e)) continue;
    seen.add(def.e);
    hits.push(toHit(def, hay));
  }
  return hits;
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
  { keys: ['lait', 'melk', 'melkpoeder'], family: 'dairy', allergens: ['milk'], roles: ['base'] },
  { keys: ['crème fraîche', 'creme fraiche', 'crème fraîche pasteurisée', 'crème liquide', 'cream', 'crème entière'], family: 'dairy', allergens: ['milk'], roles: ['fat', 'texture'], note: 'Pasteurised dairy cream; contributes fat and mouthfeel.' },
  { keys: ['crème'], family: 'dairy', allergens: ['milk'], roles: ['fat'] },
  { keys: ['lactosérum', 'lactoserum', 'petit-lait', 'whey', 'babeurre', 'buttermilk', 'wei', 'weipoeder', 'zoet weipoeder', 'zoete wei'], family: 'dairy', allergens: ['milk'], roles: ['by-product'] },
  { keys: ['beurre', 'butter'], family: 'dairy', allergens: ['milk'], roles: ['fat'] },
  { keys: ['yaourt', 'yogurt', 'yoghurt', 'yaourt nature'], family: 'dairy', allergens: ['milk'], roles: ['culture'] },
  { keys: ['fromage blanc', 'fromage', 'cheese', 'fromage frais'], family: 'dairy', allergens: ['milk'], roles: ['base'] },
  { keys: ['caséine', 'casein', 'lactose', 'protéines de lait'], family: 'dairy', allergens: ['milk'], roles: ['protein'] },
  { keys: ['ferments lactiques', 'lactic ferments', 'bactéries lactiques', 'ferments', 'cultures lactiques', 'lactic cultures'], family: 'culture', roles: ['ferment'], note: 'Live lactic bacteria used to acidify and flavour fermented dairy.' },
  { keys: ['présure', 'rennet', 'enzyme coagulante', 'coagulating enzyme'], family: 'other', roles: ['enzyme'], note: 'Coagulating enzyme (traditionally calf rennet, now often microbial).' },
  { keys: ['sel', 'sel de mer', 'sel fin', 'sel gemme', 'sel iodé', 'iodised salt', 'iodized salt', 'salt', 'sea salt', 'chlorure de sodium', 'sodium chloride', 'zout', 'keukenzout', 'zeezout', 'sal', 'sal marina', 'ملح'], family: 'salt', roles: ['seasoning'], note: 'Sodium chloride; seasoning and preservation.' },
  { keys: ['sucre', 'sucre blanc', 'sugar', 'saccharose', 'suiker', 'witte suiker', 'سكر'], family: 'sugar', roles: ['sweetener'], note: 'Sucrose.' },
  { keys: ['sucre de canne', 'cane sugar'], family: 'sugar', roles: ['sweetener'] },
  { keys: ['glucose', 'glucose syrup', 'sirop de glucose', 'dextrose', 'fructose'], family: 'sugar', roles: ['sweetener'] },
  { keys: ['miel', 'honey'], family: 'sugar', roles: ['sweetener', 'natural'] },
  { keys: ['eau', 'water', 'ماء', 'الماء'], family: 'water', roles: ['base'] },
  { keys: ['eau de source', 'spring water', 'eau minérale naturelle', 'eau minerale naturelle', 'natural mineral water', 'mineral water', 'eau gazeuse', 'eau minérale gazeuse', 'sparkling water', 'carbonated water', 'eau de table', 'table water'], family: 'water', roles: ['base'], note: 'Water itself — a base ingredient, not an additive.' },
  { keys: ['sirop de glucose-fructose', 'glucose-fructose syrup', 'sirop de fructose'], family: 'sugar', roles: ['sweetener'] },
  { keys: ['huile de tournesol', 'sunflower oil', 'zonnebloemolie', 'huile de colza', 'rapeseed oil', 'huile de palme', 'palm oil', 'huile d’olive', 'olive oil', 'huile végétale', 'huiles végétales', 'vegetable oil', 'vegetable oils', 'plant oil', 'plant oils', 'huile de soja', 'soybean oil', 'soya oil', 'cottonseed oil', 'partially hydrogenated oil', 'partly hydrogenated oil', 'huile partiellement hydrogénée', 'زيت النخيل', 'زيت دوار الشمس'], family: 'fat-oil', roles: ['fat'] },
  { keys: ['farine de blé', 'wheat flour', 'farine', 'flour', 'farine de froment', 'tarwebloem', 'tarwemeel', 'tarwezetmeel', 'volkorenmeel', 'tarwe', 'wheat'], family: 'cereal', allergens: ['gluten'], roles: ['base'] },
  { keys: ['blé complet', 'whole wheat', 'whole grain wheat', 'whole grain rolled wheat', 'rolled wheat', 'seigle', 'rye flour', 'orge', 'barley', 'avoine', 'oats', 'rolled oats', 'whole grain rolled oats', 'épeautre'], family: 'cereal', allergens: ['gluten'], roles: ['base'] },
  { keys: ['céréales', 'cereals', 'céréales complètes', 'wholegrain cereals'], family: 'cereal', roles: ['base'] },
  { keys: ['wheat starch'], family: 'cereal', allergens: ['gluten'], roles: ['texture'] },
  { keys: ['rice starch', 'corn starch', 'maize starch'], family: 'cereal', roles: ['texture'] },
  { keys: ['riz', 'rice', 'farine de riz', 'rice flour', 'rijst', 'rijstbloem', 'rijstmeel', 'rijstzetmeel'], family: 'cereal', roles: ['base'] },
  { keys: ['maïs', 'corn', 'farine de maïs', 'corn flour', 'maize flour', 'mais', 'maismeel', 'maiszetmeel', 'maisbloem', 'maisvlokken'], family: 'cereal', roles: ['base'] },
  { keys: ['amidon', 'starch', 'amidon de maïs', 'fécule de pomme de terre', 'potato starch'], family: 'cereal', roles: ['texture'] },
  { keys: ['œuf', 'oeuf', 'egg', 'œufs', 'oeufs', 'jaune d’œuf', 'blanc d’œuf'], family: 'egg', allergens: ['eggs'], roles: ['protein', 'texture'] },
  { keys: ['arachide', 'arachides', 'arachides grillées', 'peanut', 'peanuts', 'cacahuète', 'cacahuètes', 'cacahuètes grillées'], family: 'legume', allergens: ['peanuts'], roles: ['protein'] },
  { keys: ['soja', 'soya', 'soy', 'lécithine de soja'], family: 'legume', allergens: ['soybeans'], roles: ['protein'] },
  { keys: ['noix de coco', 'coconut'], family: 'fruit-veg', roles: ['fat', 'natural'] },
  { keys: ['noix', 'walnut', 'walnuts', 'noisette', 'noisettes', 'hazelnut', 'hazelnuts', 'amande', 'amandes', 'almond', 'almonds', 'pistache', 'pistaches', 'pistachio', 'pistachios', 'noix de cajou', 'cashew', 'cashews', 'pecan', 'pecans', 'brazil nut', 'brazil nuts', 'macadamia', 'macadamias'], family: 'nut-seed', allergens: ['nuts'], roles: ['fat'] },
  { keys: ['sésame', 'sesame'], family: 'nut-seed', allergens: ['sesame'], roles: ['seed'] },
  { keys: ['graines de tournesol', 'sunflower seeds', 'sunflower', 'tournesol', 'graines de lin', 'flaxseed'], family: 'nut-seed', roles: ['seed'] },
  { keys: ['tomate', 'tomato', 'concentré de tomate', 'purée de tomate', 'طماطم'], family: 'fruit-veg', roles: ['vegetable'] },
  // Common North-African / Moroccan market fruit.
  { keys: ['dattes', 'date sèche', 'dattes séchées', 'dates', 'dried dates', 'تمر'], family: 'fruit-veg', roles: ['fruit'] },
  { keys: ['figues', 'figue', 'figs', 'fig', 'تين'], family: 'fruit-veg', roles: ['fruit'] },
  { keys: ['oignon', 'onion', 'ui', 'uien', 'uienpoeder', 'ui poeder'], family: 'fruit-veg', roles: ['vegetable'] },
  { keys: ['ail', 'garlic', 'knoflook', 'knoflookpoeder'], family: 'fruit-veg', roles: ['vegetable'] },
  { keys: ['pomme', 'apple', 'jus de pomme', 'purée de pomme'], family: 'fruit-veg', roles: ['fruit'] },
  { keys: ['banane', 'banana'], family: 'fruit-veg', roles: ['fruit'] },
  { keys: ['fraise', 'strawberry'], family: 'fruit-veg', roles: ['fruit'] },
  { keys: ['abricot', 'abricots', 'abricot sec', 'abricots secs', 'apricot', 'apricots', 'dried apricot', 'dried apricots'], family: 'fruit-veg', roles: ['fruit'], note: 'Stone fruit; dried or in syrup form keeps the same food family.' },
  { keys: ['citron', 'lemon', 'jus de citron'], family: 'fruit-veg', roles: ['fruit', 'acidity'] },
  { keys: ['orange', 'orange juice', 'jus d’orange'], family: 'fruit-veg', roles: ['fruit'] },
  { keys: ['raisin', 'raisins', 'raisins secs', 'grape', 'grapes', 'dried raisin', 'dried raisins'], family: 'fruit-veg', roles: ['fruit'] },
  { keys: ['pomme de terre', 'potato', 'potatoes', 'dehydrated potato', 'dehydrated potatoes', 'dried potato', 'dried potatoes', 'potato flakes', 'aardappel', 'aardappelen', 'aardappelzetmeel', 'aardappelvlokken', 'aardappelmeel', 'gedehydrateerde aardappelen', 'gedroogde aardappelen'], family: 'fruit-veg', roles: ['vegetable'] },
  { keys: ['carotte', 'carrot'], family: 'fruit-veg', roles: ['vegetable'] },
  { keys: ['champignon', 'mushroom', 'champignons'], family: 'fruit-veg', roles: ['vegetable'] },
  { keys: ['lentilles', 'lentils', 'pois chiches', 'chickpeas', 'haricots', 'beans'], family: 'legume', roles: ['protein'] },
  { keys: ['viande de bœuf', 'beef', 'viande bovine', 'bœuf'], family: 'meat-fish', roles: ['protein'] },
  { keys: ['viande de porc', 'pork'], family: 'meat-fish', roles: ['protein'] },
  { keys: ['poulet', 'chicken', 'volaille'], family: 'meat-fish', roles: ['protein'] },
  { keys: ['saumon', 'salmon', 'thon', 'tuna', 'cabillaud', 'cod', 'poisson', 'fish', 'ماكريل', 'maquereau', 'mackerel'], family: 'meat-fish', roles: ['protein'] },
  { keys: ['gélatine', 'gelatin'], family: 'other', roles: ['texture'], note: 'Usually of animal (bovine/porcine) origin.' },
  { keys: ['plantaardig eiwit', 'gehydrolyseerd plantaardig eiwit', 'planteiwit', 'gehydrolyseerd eiwit', 'vegetable protein', 'hydrolyzed vegetable protein', 'hydrolysed vegetable protein'], family: 'other', roles: ['protein'], note: 'Protein of plant origin (EU phrase on savoury labels).' },
  { keys: ['vanille', 'vanilla', 'extrait de vanille', 'arôme naturel de vanille'], family: 'herb-spice', roles: ['flavour', 'natural'] },
  { keys: ['noix de muscade', 'nutmeg'], family: 'herb-spice', roles: ['seasoning'] },
  { keys: ['cacao', 'cocoa', 'cacao en poudre', 'chocolat', 'chocolate'], family: 'herb-spice', roles: ['flavour'] },
  { keys: ['poivre', 'poivre noir', 'black pepper', 'pepper', 'épices', 'spices', 'herbes', 'herbs', 'ail des ours', 'persil', 'parsley', 'فلفل اسود'], family: 'herb-spice', roles: ['seasoning'] },
  { keys: ['paprika', 'paprika powder', 'paprika seasoning', 'paprika spice mix', 'chili', 'chilli', 'chili extract', 'chilli extract', 'paprikapoeder', 'paprikakruiderij', 'paprikamix', 'فلفل احمر حلو', 'فلفل احمر'], family: 'herb-spice', roles: ['seasoning'] },
  // Common North-African / Moroccan market spices (FR + Arabic label wording).
  { keys: ['coriandre', 'coriander', 'كزبرة'], family: 'herb-spice', roles: ['seasoning'] },
  { keys: ['cumin', 'كمون'], family: 'herb-spice', roles: ['seasoning'] },
  { keys: ['curcuma', 'turmeric', 'كركم'], family: 'herb-spice', roles: ['seasoning'] },
  { keys: ['gingembre', 'ginger', 'زنجبيل'], family: 'herb-spice', roles: ['seasoning'] },
  { keys: ['fenugrec', 'fenugreek', 'حلبة'], family: 'herb-spice', roles: ['seasoning'] },
  { keys: ['anis', 'anise', 'يانسون'], family: 'herb-spice', roles: ['seasoning'] },
  { keys: ['glycérol', 'glycerol', 'glycérine', 'glycerin', 'glycerine'], family: 'other', roles: ['humectant'], note: 'Glycerol (E422), used to retain moisture.' },
  { keys: ['arôme', 'arômes', 'arome', 'arômes naturels', 'aromes naturels', 'arôme naturel', 'arome naturel', 'natural flavour', 'natural flavourings', 'natural flavouring', 'flavour', 'flavouring', 'flavourings', 'natural flavor', 'natural flavors', 'natural flavorings', 'aromatisants', 'aroma s', 'aromen', 'natuurlijke aroma s', 'natuurlijke aroma'], family: 'other', roles: ['flavouring'], note: 'Flavourings (EU Reg. 1334/2008). “Natural” refers to their origin, not to the absence of processing.' },
  { keys: ['maltodextrine', 'maltodextrin'], family: 'cereal', roles: ['texture'] },
  { keys: ['levure', 'yeast', 'levure de boulanger', 'gist', 'gistpoeder', 'bakkersgist', 'brouwersgist'], family: 'culture', roles: ['ferment'] },
  { keys: ['son', 'bran', 'fibres', 'fibre'], family: 'cereal', roles: ['fibre'] },
  { keys: ['amidon modifié', 'modified starch'], family: 'cereal', roles: ['texture'] },
  // Pantry staples frequent on Moroccan market labels (FR/EN/Arabic).
  { keys: ['vinaigre', 'vinegar', 'خل', 'alcool de vin', 'wine vinegar', 'vinaigre d alcool'], family: 'other', roles: ['acidulant'], note: 'Vinegar; acetic acid in water, used for acidity.' },
  // Declared micronutrients (fortified juices, cereals, dairy drinks). Identity
  // only: the declared form/amount lives on the nutrition panel, and a vitamin
  // wording must never read as an unrecognized mystery ingredient.
  { keys: ['vitamin c', 'vitamine c', 'فيتامين س'], family: 'other', roles: ['vitamin'], note: 'Vitamin C (ascorbic acid); antioxidant that protects colour and flavour.' },
  { keys: ['vitamin e', 'vitamine e', 'tocopherol', 'alpha tocopherol'], family: 'other', roles: ['vitamin'], note: 'Vitamin E (tocopherol); antioxidant.' },
  { keys: ['vitamin a', 'vitamine a'], family: 'other', roles: ['vitamin'] },
  { keys: ['vitamin d', 'vitamine d'], family: 'other', roles: ['vitamin'] },
  { keys: ['vitamin k', 'vitamine k'], family: 'other', roles: ['vitamin'] },
  { keys: ['vitamin b6', 'vitamin b12', 'vitamine b6', 'vitamine b12', 'riboflavine', 'thiamine', 'niacine', 'folic acid', 'acide folique'], family: 'other', roles: ['vitamin'] },
  { keys: ['café', 'coffee', 'قهوة', 'extrait de café', 'coffee extract'], family: 'other', roles: ['flavour'], note: 'Coffee; source of caffeine.' },
  { keys: ['chicorée', 'chicory', 'chicoree'], family: 'fruit-veg', roles: ['flavour'], note: 'Chicory root; common coffee extender.' },
  { keys: ['extrait de malt', 'malt extract', 'orge maltée', 'malted barley'], family: 'cereal', roles: ['flavour'], note: 'Malt extract from germinated barley.' },
// --- Arabic (Moroccan label) and Spanish (import) layer ----------------------
// A large share of Moroccan products print their ingredient list in Arabic,
// and imported lines print Spanish; without these rows those labels scored
// "0 recognized" and could not be ranked at all. Arabic nouns are listed with
// and without the definite article because row matching is word-boundary
// based and "الحليب" is a different string from "حليب".
{ keys: ['حليب', 'الحليب', 'حليب كامل الدسم', 'حليب نصف دسم', 'حليب شبه منزوع الدسم', 'حليب بدون قشدة', 'حليب منزوع الدسم', 'حليب خالي من الدسم', 'حليب مبستر', 'حليب معقم', 'حليب مجفف', 'حليب مركب', 'حليب طري', 'حليب طازج', 'لبن'], family: 'dairy', allergens: ['milk'], roles: ['base'] },
{ keys: ['مسحوق الحليب', 'مسحوق الحليب بدون قشدة', 'حليب مجفف منزوع الدسم', 'مسحوق الحليب المنزوع'], family: 'dairy', allergens: ['milk'], roles: ['base', 'dry'] },
{ keys: ['قشدة', 'القشدة', 'قشطة', 'قشطة الحليب', 'كريمة', 'كريم'], family: 'dairy', allergens: ['milk'], roles: ['fat'] },
{ keys: ['زبدة', 'الزبدة', 'سمن', 'سمنة', 'دهن حليبي'], family: 'dairy', allergens: ['milk'], roles: ['fat'] },
{ keys: ['جبن', 'جبنة', 'أجبان', 'الأجبان', 'جبن أبيض', 'جبن مذوب', 'جبنة مذوبة', 'جبن شيدر', 'شيدر'], family: 'dairy', allergens: ['milk'], roles: ['base'] },
{ keys: ['بروتينات الحليب', 'بروتين الحليب', 'مصل الحليب', 'مسحوق مصل الحليب', 'لاكتوز', 'اللاكتوز'], family: 'dairy', allergens: ['milk'], roles: ['protein'] },
{ keys: ['يوغورت', 'ياغورت', 'زبادي', 'رايب', 'حليب مخمر', 'منتوج حليبي'], family: 'dairy', allergens: ['milk'], roles: ['culture'] },
{ keys: ['خمائر حليبية', 'الخمائر اللبنية', 'خميرة', 'خمائر', 'تخمير الكفير', 'خمائر الكفير', 'بكتيريا', 'بروبيوتيك'], family: 'culture', roles: ['ferment'] },
{ keys: ['زيت', 'الزيت', 'زيوت', 'زيوت نباتية', 'زيوت نباتية مصفاة', 'زيت الزيتون', 'زيت زيتون', 'زيت عباد الشمس', 'زيت الصوجا', 'زيت الذرة', 'زيت الكانولا', 'زيت نباتي', 'دهون نباتية', 'دهن نباتي', 'مادة دهنية نباتية', 'مادة دهنية حليبية', 'مادة دسمة نباتية', 'مادة دسمة', 'مواد دسمة', 'مواد دهنية', 'دهون حليبية', 'شحم نباتي', 'مارغرين', 'مرغرين'], family: 'fat-oil', roles: ['fat'] },
{ keys: ['ماء معدني', 'ماء الشرب', 'ماء مصفى', 'مياه'], family: 'water', roles: ['base'] },
{ keys: ['السكر', 'سكر القصب', 'سكر ابيض', 'مسحوق السكر'], family: 'sugar', roles: ['sweetener'] },
{ keys: ['محليات', 'محلي', 'شراب الجلوكوز', 'مالتوديكسترين', 'مالتودكسترين', 'دكستروز'], family: 'sugar', roles: ['sweetener'] },
{ keys: ['الملح', 'ملح الطعام', 'ملح غذائي', 'كلورور الصوديوم'], family: 'salt', roles: ['seasoning'] },
{ keys: ['دقيق', 'طحين', 'فرينة', 'قمح', 'القمح', 'دقيق القمح', 'طحين القمح', 'خبز', 'شعير', 'شوفان', 'ذرة', 'أرز', 'سميد', 'نشا', 'نشا الذرة', 'نشا معدل'], family: 'cereal', roles: ['base'] },
{ keys: ['طماطم مركزة', 'معجون الطماطم', 'تفاح', 'موز', 'فراولة', 'فريز', 'مشمش', 'برتقال', 'ليمون', 'خوخ', 'عنب', 'زبيب', 'أناناس', 'مانجو', 'كيوي', 'إجاص'], family: 'fruit-veg', roles: ['base'] },
{ keys: ['بصل', 'ثوم', 'جزر', 'بطاطا', 'بطاطس', 'فلفل', 'فلفل أحمر', 'فلفل حلو', 'زيتون', 'خيار', 'سبانخ'], family: 'fruit-veg', roles: ['base'] },
{ keys: ['لحم', 'اللحم', 'دجاج', 'الدجاج', 'بقر', 'لحم البقر', 'ديك رومي', 'نقانق', 'مرتديلا'], family: 'meat-fish', roles: ['protein'] },
{ keys: ['سمك', 'السمك', 'تونة', 'التونة', 'سردين', 'السردين', 'سلمون', 'أسماك', 'ثون'], family: 'meat-fish', allergens: ['fish'], roles: ['protein'] },
{ keys: ['عدس', 'حمص', 'فول', 'فاصوليا', 'لوبيا', 'فول الصويا', 'بازلاء'], family: 'legume', roles: ['protein'] },
{ keys: ['لوز', 'اللوز', 'بندق', 'البندق', 'جوز', 'الجوز', 'فستق', 'الفستق', 'كاجو', 'عين الجمل', 'سمسم', 'جلجلان', 'بذور عباد الشمس', 'بذور الكتان', 'شيا'], family: 'nut-seed', roles: ['fat', 'protein'] },
{ keys: ['بيض', 'البيض', 'أصفر البيض', 'صفار البيض', 'بياض البيض'], family: 'egg', allergens: ['eggs'], roles: ['binder'] },
{ keys: ['كاكاو', 'الكاكاو', 'شوكولاتة', 'الشوكولاتة', 'شوكولاط', 'رقائق الشوكولاته', 'زبدة الكاكاو'], family: 'other', roles: ['flavour'] },
{ keys: ['القهوة', 'حبوب القهوة', 'قهوة سريعة التحضير', 'شاي', 'الشاي', 'شاي أخضر', 'شاي اسود', 'أتاي',
    'green tea', 'black tea', 'tea', 'the vert', 'the noir', 'cafe soluble', 'soluble coffee', 'instant coffee'],
    family: 'other', roles: ['stimulant'], note: 'Coffee and tea; caffeine-bearing infusions.' },
// NB: "flavour enhancer(s)" is deliberately not a row — it is a functional
  // class the rubric treats as vague, and a key of "flavor" would prefix-match
  // "flavor enhancers" and hide that vagueness. Only the declared ingredient
  // category itself ("arome", "aroma", "نكهة") belongs here.
  { keys: ['نكهة', 'نكهات', 'نكهة طبيعية', 'arome', 'aromes', 'aroma', 'aromas', 'vanilline', 'vanillina'], family: 'other', roles: ['flavouring'] },
{ keys: ['الخل', 'خل المائدة', 'خل التفاح', 'vinaigre de table'], family: 'other', roles: ['acid'] },
{ keys: ['خردل', 'الخردل', 'moutarde', 'mostaza'], family: 'herb-spice', allergens: ['mustard'], roles: ['condiment'] },
{ keys: ['عسل', 'العسل'], family: 'sugar', roles: ['sweetener', 'natural'] },
{ keys: ['كالسيوم', 'الكالسيوم', 'حديد', 'فيتامين', 'فيتامينات', 'vitamins', 'vitamine', 'vitamines', 'calcium', 'fer', 'manganese', 'magnésium', 'magnesium', 'potassium', 'sodium', 'zinc', 'phosphore'], family: 'other', roles: ['fortification'] },
{ keys: ['صمغ', 'صمغ الزنتان', 'صمغ الزانثان', 'صمغ الغوار', 'صمغ عربي', 'أغار', 'علكة', 'بكتين', 'كاراجينان', 'كاراجينات', 'كاراگينان'], family: 'other', roles: ['texture'] },
{ keys: ['fraises', 'fraises des bois', 'strawberries', 'tomates', 'tomatoes'], family: 'fruit-veg', roles: ['base'] },
{ keys: ['maquereaux', 'sardines'], family: 'meat-fish', allergens: ['fish'], roles: ['protein'] },
{ keys: ['ferment lactique', 'presure', 'culture lactique', 'bifidobacterium', 'bifidus', 'lactobacillus'], family: 'culture', roles: ['ferment'] },
{ keys: ['matière grasse laitière', 'matiere grasse laitiere', 'matière grasse végétale', 'matiere grasse vegetale', 'corps gras végétal', 'corps gras vegetal', 'graisse végétale', 'graisse vegetale', 'crème de lait', 'creme de lait'], family: 'fat-oil', roles: ['fat'] },
{ keys: ['sels de fonte', 'sel de fonte', 'emulsifying salts', 'sels émulsifiants', 'sel émulsifiant', 'phosphate', 'phosphates', 'polyphosphates', 'citrate', 'citrates'], family: 'other', roles: ['emulsifier', 'texture'] },
{ keys: ['caféine', 'cafeine', 'caffeine'], family: 'other', roles: ['stimulant'] },
{ keys: ['fromages', 'fromage fondu', 'cheeses', 'processed cheese'], family: 'dairy', allergens: ['milk'], roles: ['base'] },
// Spanish imports (Moroccan shelves carry Spanish-labelled lines)
{ keys: ['azucar', 'azúcar'], family: 'sugar', roles: ['sweetener'] },
  { keys: ['leche', 'leche en polvo', 'leche desnatada en polvo', 'queso', 'nata', 'mantequilla'], family: 'dairy', allergens: ['milk'], roles: ['base'] },
  { keys: ['aceite de girasol', 'aceite de nabina', 'grasa de palma', 'grasa vegetal', 'manteca de cacao'], family: 'fat-oil', roles: ['fat'] },
  { keys: ['harina de trigo', 'almidon', 'almidón de trigo', 'arroz', 'maiz', 'maíz', 'galleta', 'galletas'], family: 'cereal', roles: ['base'] },
  { keys: ['atun', 'atún', 'pescado'], family: 'meat-fish', allergens: ['fish'], roles: ['protein'] },
  { keys: ['huevo'], family: 'egg', allergens: ['eggs'], roles: ['binder'] },
  { keys: ['cacao magro en polvo', 'cacao desgrasado en polvo', 'mayonesa'], family: 'other', roles: ['flavour'] },
{ keys: ['املاح معدنية', 'أملاح معدنية', 'jarabe de glucosa', 'jarabe de glucosa y fructosa', 'gasificantes', 'levadura', 'suero', 'suero lacteo', 'lactosa', 'proteina', 'proteinas', 'fibra alimentaria', 'extracto de malta', 'aroma natural', 'aromas naturales', 'sal mineral'], family: 'other', roles: ['ingredient'] },];

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

/**
 * Generic label classes that do not identify the substance used. Matching is
 * exact on purpose: “colour (E160b)” is handled by the additive registry,
 * while a bare “colour” remains unresolved rather than being treated as a
 * known/authorized additive.
 */
const UNSPECIFIED_CLASS_TERMS: Record<FoodUnspecifiedClass, readonly string[]> = {
  'flavour-enhancer': [
    'flavour enhancer', 'flavour enhancers', 'flavor enhancer', 'flavor enhancers',
    'exhausteur de gout', 'exhausteurs de gout', 'smaakversterker', 'smaakversterkers',
  ],
  colour: [
    'colour', 'color', 'colouring', 'coloring', 'colourant', 'colorant',
    'colorant alimentaire', 'kleurstof', 'ملون', 'ملونات', 'ملون طبيعي', 'صبغة', 'صبغات',
  ],
  'food-acid': [
    'food acid', 'food acids', 'acidity regulator', 'acidity regulators',
    'acidulant', 'acidulants', 'acidifiant', 'acidifiants', 'voedingszuur',
    'محمض', 'محمضات', 'منظم الحموضة', 'مصحح الحموضة',
  ],
  'protein-source': [
    'protein', 'proteins', 'protein source', 'source of protein', 'proteine',
    'proteines', 'source de proteines', 'eiwit', 'eiwitten',
  ],
  preservative: [
    'preservative', 'preservatives', 'conservateur', 'conservateurs',
    'conservateur alimentaire', 'conservateurs alimentaires', 'preservatief',
    'مادة حافظة', 'مواد حافظة', 'حافظة', 'حافظات', 'عامل الحفظ',
  ],
  antioxidant: [
    'antioxidant', 'antioxidants', 'antioxydant', 'antioxydants',
    'مضادات الأكسدة', 'مضاد الأكسدة', 'مضاد للأكسدة',
  ],
  stabiliser: [
    'stabiliser', 'stabilisers', 'stabilizer', 'stabilizers',
    'stabilisant', 'stabilisants', 'stabilisator', 'مثبت', 'مثبتات',
  ],
  thickener: [
    'thickener', 'thickeners', 'epaississant', 'epaississants',
    'gelifiant', 'gelifiants', 'gelling agent', 'gelling agents',
    'verdikkingsmiddel', 'مخثر', 'مخثرات', 'مكثف', 'مثخن',
  ],
  emulsifier: [
    'emulsifier', 'emulsifiers', 'emulsifiant', 'emulsifiants',
    'emulgator', 'املاح مستحلبة', 'أملاح مستحلبة', 'مستحلب', 'مستحلبات',
  ],
  sweetener: [
    'sweetener', 'sweeteners', 'edulcorant', 'edulcorants',
    'edulcorant de table', 'zoetstof', 'zoetstoffen', 'محليات', 'محلي', 'محلى',
  ],
};

const UNSPECIFIED_CLASS_KEYS = Object.entries(UNSPECIFIED_CLASS_TERMS).flatMap(
  ([kind, terms]) => terms.map((term) => [foldForMatch(term), kind as FoodUnspecifiedClass] as const),
);

export function lookupUnspecifiedFoodClass(folded: string): FoodUnspecifiedClass | null {
  if (!folded) return null;
  return UNSPECIFIED_CLASS_KEYS.find(([term]) => folded === term)?.[1] ?? null;
}

export const FOOD_ROW_COUNT = ROWS.length;
export const FOOD_DATASET_VERSION = '2026-09-food-v5';

// --- Mineral-water composition parameters -----------------------------------
// Natural/spring/table waters print a mineral composition (mg/L) instead of an
// ingredient list. Each recognised line is informational only — a declared
// natural constituent, never an additive verdict. Keys are accent-folded.
export interface WaterParamDef {
  /** Stable code — localized client-side via foodKnowledge.waterParam* keys. */
  key: string;
  /** Label spellings (FR/EN, folded) found on water labels. */
  names: string[];
}

export const WATER_PARAMETERS: WaterParamDef[] = [
  { key: 'dry-residue', names: ['residu sec a 110 c', 'residu sec a 180 c', 'residu sec', 'dry residue', 'dry extract', 'total dissolved solids'] },
  { key: 'sodium', names: ['sodium'] },
  { key: 'calcium', names: ['calcium'] },
  { key: 'magnesium', names: ['magnesium'] },
  { key: 'potassium', names: ['potassium'] },
  { key: 'sulphates', names: ['sulfates', 'sulphates'] },
  { key: 'chlorides', names: ['chlorures', 'chlorides'] },
  { key: 'bicarbonates', names: ['bicarbonates', 'bicarbonate'] },
  { key: 'nitrates', names: ['nitrates'] },
];

/**
 * Detect a mineral parameter inside one folded water-label line, e.g.
 * "Résidu sec à 110°C: 186" → { key: 'dry-residue', value: '186' },
 * "Sodium 26" → { key: 'sodium', value: '26' }.
 * The value is the last number printed after the parameter name, as on the
 * label (OCRed values are kept as strings on purpose).
 */
export function detectWaterParameter(folded: string): { key: string; value?: string } | null {
  if (!folded) return null;
  let best: { key: string; at: number; len: number } | null = null;
  for (const def of WATER_PARAMETERS) {
    for (const name of def.names) {
      const at = folded.indexOf(name);
      if (at === -1) continue;
      if (!best || at < best.at || (at === best.at && name.length > best.len)) {
        best = { key: def.key, at, len: name.length };
      }
    }
  }
  if (!best) return null;
  const rest = folded.slice(best.at + best.len);
  const numbers = rest.match(/\d+(?:[.,]\d+)?/g);
  const value = numbers ? numbers[numbers.length - 1].replace(',', '.') : undefined;
  return value ? { key: best.key, value } : { key: best.key };
}

export const WATER_PARAMETER_COUNT = WATER_PARAMETERS.length;
