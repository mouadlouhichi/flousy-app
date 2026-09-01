/**
 * Curated Moroccan product seed — a small, static index of well-known MA
 * products keyed by EAN barcode.
 *
 * Why: the full OFF Morocco index is ~22.8k products and would need a CI
 * build + IndexedDB (design doc §3.5, "static MA seed", P2). This inline
 * slice is the first step of that plan — it makes the most common Moroccan
 * baskets resolve instantly and offline, before any network lookup.
 *
 * Every barcode below was pulled from the Open Food Facts public API
 * (search + product endpoints); `tests/product-lookup.test.ts` re-checks
 * each code's EAN checksum so a typo can never ship.
 */
import type { RemoteProductInfo } from './course-session';

interface MaSeedEntry {
  name: string;
  brand?: string;
  category?: string;
}

const SEED: Record<string, MaSeedEntry> = {
  // --- Eaux minérales (water) ---
  '6111035002175': { name: 'Sidi Ali', brand: 'Sidi Ali', category: 'Eaux' },
  '6111035000430': { name: 'Sidi Ali', brand: 'Sidi Ali', category: 'Eaux' },
  '6111035000058': { name: 'Sidi Ali', brand: 'Sidi Ali', category: 'Eaux' },
  '6111035001383': { name: 'Sidi Ali', brand: 'Sidi Ali', category: 'Eaux' },
  '6111035002359': { name: 'Sidi Ali Kids', brand: 'Sidi Ali', category: 'Eaux' },
  '6111035001659': { name: 'Aïn Atlas', brand: 'Aïn Atlas', category: 'Eaux' },
  '6111035001635': { name: 'Aïn Atlas', brand: 'Aïn Atlas', category: 'Eaux' },
  '6111035001673': { name: 'Aïn Atlas 50cl', brand: 'Aïn Atlas', category: 'Eaux' },
  '6111035001710': { name: 'Aïn Atlas', brand: 'Oulmès', category: 'Eaux' },
  '6111035502828': { name: 'Aïn Atlas', brand: 'Aïn Atlas', category: 'Eaux' },
  '6111128000026': { name: 'Sidi Harazem', brand: 'Sidi Harazem', category: 'Eaux' },
  '6111128000019': { name: 'Sidi Harazem', brand: 'Sidi Harazem', category: 'Eaux' },
  '6111128000200': { name: 'Sidi Harazem', brand: 'Sidi Harazem', category: 'Eaux' },
  '6111251420272': { name: 'Aïn Ifrane', brand: 'Aïn Ifrane', category: 'Eaux' },
  '6111251420135': { name: 'Aïn Ifrane', brand: 'Aïn Ifrane', category: 'Eaux' },

  // --- Boissons (soft drinks / juices) ---
  '6111035002052': { name: "Bul'tropicale", brand: 'Oulmès', category: 'Boissons' },
  '6111242100930': { name: 'Raïbi Jaouda', brand: 'Jaouda', category: 'Boissons' },
  '6111242102002': { name: 'Ghilal Blé', brand: 'Jaouda', category: 'Boissons' },
  '6111242105287': { name: 'Ghilal Panaché', brand: 'Jaouda', category: 'Boissons' },
  '6111032006954': { name: 'Jibbi Vanille', brand: 'Centrale Danone', category: 'Boissons' },
  '6111032007050': { name: 'Danup', brand: 'Centrale Danone', category: 'Boissons' },
  '6111032000938': { name: 'Danone Assiri Pêche Poire', brand: 'Centrale Danone', category: 'Boissons' },

  // --- Produits laitiers (dairy) — Jaouda / COPAG ---
  '6111242101180': { name: 'Lait UHT Jaouda 1L', brand: 'Jaouda', category: 'Produits laitiers' },
  '6111242100817': { name: 'Lait demi-écrémé Jaouda', brand: 'Jaouda', category: 'Produits laitiers' },
  '6111266962187': { name: 'Lait de la ferme Jaouda', brand: 'Jaouda', category: 'Produits laitiers' },
  '6111242101050': { name: 'Lben Jaouda', brand: 'Jaouda', category: 'Produits laitiers' },
  '6111242105331': { name: 'Beurre frais pasteurisé', brand: 'Jaouda', category: 'Produits laitiers' },
  '6111242106949': { name: 'Jben', brand: 'Jaouda', category: 'Produits laitiers' },
  '6111242103702': { name: 'Yaourt grec muesli', brand: 'Jaouda', category: 'Produits laitiers' },
  '6111242100992': { name: 'Perly', brand: 'Jaouda', category: 'Produits laitiers' },
  '6111266960336': { name: 'Perly fromage', brand: 'Jaouda', category: 'Produits laitiers' },
  '6111242100206': { name: 'Le Nature', brand: 'Jaouda', category: 'Produits laitiers' },
  '6111242100305': { name: 'Jaouda Crémy', brand: 'Jaouda', category: 'Produits laitiers' },
  '6111266963207': { name: 'Kéfir', brand: 'Jaouda', category: 'Produits laitiers' },
  '6111242102279': { name: 'Perly Chocolat', brand: 'Jaouda', category: 'Produits laitiers' },
  '6111242102842': { name: 'Mixy aux céréales', brand: 'Jaouda', category: 'Produits laitiers' },
  '6111266962576': { name: 'Délicieux Perly', brand: 'COPAG', category: 'Produits laitiers' },
  '6111266962583': { name: 'Luncheon Splendida', brand: 'COPAG', category: 'Produits laitiers' },

  // --- Produits laitiers (dairy) — Centrale Danone ---
  '6111206000733': { name: 'Jebli', brand: 'Centrale Danone', category: 'Produits laitiers' },
  '6111206000788': { name: 'Jebli Original', brand: 'Centrale Danone', category: 'Produits laitiers' },
  '6111206000863': { name: 'Jebli Ail & Thym', brand: 'Centrale Danone', category: 'Produits laitiers' },
  '6111032000372': { name: 'Lait frais pasteurisé', brand: 'Centrale Danone', category: 'Produits laitiers' },
  '6111032006442': { name: 'Lait frais pasteurisé', brand: 'Centrale Danone', category: 'Produits laitiers' },
  '6111032009382': { name: 'Danette flan vanille', brand: 'Centrale Danone', category: 'Desserts' },

  // --- Entretien (Mutandis: Magix / Maxi's) — household detergents, not in OFF ---
  '6111242926974': { name: 'Magix Pâte', brand: 'Magix', category: 'Entretien' },
  '6111242927506': { name: 'Magix Lessive 500 ml', brand: 'Magix', category: 'Entretien' },
  '6111242925540': { name: 'Magix Lessive liquide Fraîcheur Printemps 500 ml', brand: 'Magix', category: 'Entretien' },
  '6111242925502': { name: 'Magix Lessive liquide Savon de Marseille 500 ml', brand: 'Magix', category: 'Entretien' },
  '6111242925670': { name: 'Magix Matic 800 g', brand: 'Magix', category: 'Entretien' },
  '6111242922129': { name: "Maxi's Eau de javel Lavande 1 L", brand: "Maxi's", category: 'Entretien' },
  '6111242922105': { name: "Maxi's Eau de javel Citron 1 L", brand: "Maxi's", category: 'Entretien' },
  '6111242922082': { name: "Maxi's Eau de javel Neutre 1 L", brand: "Maxi's", category: 'Entretien' },
  '6111242922396': { name: "Maxi's Liquide vaisselle Aloe 750 ml", brand: "Maxi's", category: 'Entretien' },
  '6111242924048': { name: "Maxi's Liquide vaisselle Amande 750 ml", brand: "Maxi's", category: 'Entretien' },
  '6111242922372': { name: "Maxi's Liquide vaisselle Citrons 750 ml", brand: "Maxi's", category: 'Entretien' },
  '6111242923188': { name: "Maxi's Liquide vaisselle Lavande 750 ml", brand: "Maxi's", category: 'Entretien' },
  '6111242921559': { name: "Maxi's Liquide vaisselle Citrons 1 L", brand: "Maxi's", category: 'Entretien' },
  '6111242922228': { name: "Maxi's Nettoyant Aoud 1 L", brand: "Maxi's", category: 'Entretien' },
  '6111242922181': { name: "Maxi's Nettoyant Atlas 1 L", brand: "Maxi's", category: 'Entretien' },
  '6111242922204': { name: "Maxi's Nettoyant Brise Essaouira 1 L", brand: "Maxi's", category: 'Entretien' },
  '6111242921542': { name: "Maxi's Nettoyant Lavande 1 L", brand: "Maxi's", category: 'Entretien' },
  '6111242921504': { name: "Maxi's Nettoyant Orange 1 L", brand: "Maxi's", category: 'Entretien' },
  '6111242922143': { name: "Maxi's Nettoyant Rose M'gouna 1 L", brand: "Maxi's", category: 'Entretien' },
  '6111242923355': { name: "Maxi's Matic 750 g", brand: "Maxi's", category: 'Entretien' },
  '6111242926448': { name: 'Vitaïa Shampoing lissant', brand: 'Mutandis', category: 'Hygiène' },
};

export const MA_SEED_COUNT = Object.keys(SEED).length;

/** Resolve a barcode against the bundled Moroccan seed (offline, 0 ms). */
export function lookupMaSeed(barcode: string): RemoteProductInfo | null {
  const digits = barcode.replace(/\D/g, '');
  const entry =
    SEED[digits] ??
    (digits.length === 14 && digits.startsWith('1') ? SEED[digits.slice(1)] : undefined);
  if (!entry) return null;
  return {
    name: entry.name,
    ...(entry.brand ? { brand: entry.brand } : {}),
    ...(entry.category ? { category: entry.category } : {}),
  };
}
