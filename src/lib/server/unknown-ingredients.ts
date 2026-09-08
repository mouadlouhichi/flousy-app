/** Privacy-minimized aggregate reporting for unidentified ingredient tokens. */

import { createHash, createHmac } from 'node:crypto';
import { normalizeInciToken } from '@/lib/ingredient-safety/normalize';
import { getAdminFirestore } from '@/lib/server/firebase-admin';

const MAX_TOKENS_PER_REPORT = 12;
const MAX_TOKEN_CANDIDATES = 300;
const MAX_NORMALIZED_LENGTH = 120;
const MAX_DATASET_VERSION_LENGTH = 160;
const MAX_MEMORY_BUCKETS = 2_000;

export interface UnknownIngredientReportContext {
  datasetVersion: string;
  form: 'leave-on' | 'rinse-off' | 'unknown';
  parserValid: boolean;
}

export interface UnknownIngredientAggregate {
  hash: string;
  count: number;
  datasetVersion: string;
  context: string;
}

const memoryAggregates = new Map<string, UnknownIngredientAggregate>();

function hashToken(normalized: string, datasetVersion: string): string {
  const secret = process.env.UNKNOWN_INGREDIENT_HASH_KEY?.trim();
  const digest = secret
    ? createHmac('sha256', secret).update(`${datasetVersion}\0${normalized}`).digest('hex')
    : createHash('sha256').update(`flousy-unknown-v1\0${datasetVersion}\0${normalized}`).digest('hex');
  // 128 bits is ample for aggregate document identity while bounding payloads.
  return digest.slice(0, 32);
}

function contextKey(context: UnknownIngredientReportContext): string {
  return `${context.form}:${context.parserValid ? 'valid' : 'invalid'}`;
}

function boundedUniqueTokens(tokens: readonly string[]): string[] {
  const unique = new Set<string>();
  let inspected = 0;
  for (const raw of tokens) {
    inspected += 1;
    if (inspected > MAX_TOKEN_CANDIDATES) break;
    const normalized = normalizeInciToken(raw);
    if (!normalized || normalized.length > MAX_NORMALIZED_LENGTH) continue;
    // Refuse numbers and very short/noisy OCR fragments.
    if (!/\p{L}{2,}/u.test(normalized)) continue;
    unique.add(normalized);
    if (unique.size >= MAX_TOKENS_PER_REPORT) break;
  }
  return [...unique];
}

/**
 * Aggregate unknown names without retaining labels, barcodes, product names,
 * account IDs, IPs, or images. The route rate-limits calls before invoking
 * this function. Firestore persistence is optional; an in-memory bounded
 * aggregate remains available in local/keyless deployments.
 */
export async function reportUnknownIngredientAggregates(
  tokens: readonly string[],
  context: UnknownIngredientReportContext,
): Promise<number> {
  const normalized = boundedUniqueTokens(tokens);
  if (normalized.length === 0) return 0;
  const datasetVersion = context.datasetVersion.normalize('NFKC').trim().slice(0, MAX_DATASET_VERSION_LENGTH) || 'unknown';
  const contextValue = contextKey(context);
  const buckets = normalized.map((token) => ({
    hash: hashToken(token, datasetVersion),
    context: contextValue,
  }));

  for (const bucket of buckets) {
    const key = `${datasetVersion}:${bucket.hash}:${bucket.context}`;
    const prior = memoryAggregates.get(key);
    if (prior) prior.count += 1;
    else {
      memoryAggregates.set(key, {
        hash: bucket.hash,
        count: 1,
        datasetVersion,
        context: bucket.context,
      });
    }
  }
  while (memoryAggregates.size > MAX_MEMORY_BUCKETS) {
    const oldest = memoryAggregates.keys().next().value;
    if (oldest === undefined) break;
    memoryAggregates.delete(oldest);
  }

  // Durable hashes require a deployment-specific HMAC key. Without one, keep
  // only the bounded process-local aggregate rather than writing a
  // dictionary-guessable unsalted token digest to Firestore.
  if (!process.env.UNKNOWN_INGREDIENT_HASH_KEY?.trim()) return buckets.length;
  const db = await getAdminFirestore();
  if (!db) return buckets.length;
  try {
    const { FieldValue } = await import('firebase-admin/firestore');
    const batch = db.batch();
    for (const bucket of buckets) {
      const id = `${bucket.hash}_${createHash('sha256').update(bucket.context).digest('hex').slice(0, 8)}`;
      const ref = db.collection('ingredientUnknownAggregates').doc(id);
      batch.set(ref, {
        schemaVersion: 1,
        tokenHash: bucket.hash,
        datasetVersion,
        context: bucket.context,
        count: FieldValue.increment(1),
        lastSeenAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    await batch.commit();
  } catch {
    // Reporting is best-effort and must never fail ingredient analysis.
  }
  return buckets.length;
}

export function unknownIngredientAggregateSnapshot(): UnknownIngredientAggregate[] {
  return [...memoryAggregates.values()].map((item) => ({ ...item }));
}

export function clearUnknownIngredientAggregatesForTests(): void {
  memoryAggregates.clear();
}
