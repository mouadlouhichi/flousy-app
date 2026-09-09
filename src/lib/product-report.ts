export interface ProductReportInput {
  /** Scanned barcode (GTIN as printed / canonicalized by the scan flow). */
  barcode: string;
  /** Name the lookup resolved to — the result the user says is wrong. */
  resolvedName: string;
  /** Free-text note: what the product actually is / what should change. */
  note?: string;
  /** Routing hint captured from the pending card ('food' | 'cosmetic' | ...). */
  domain?: string;
  /** UI language the report was filed in ('en' | 'fr' | 'ar'). */
  locale?: string;
}

export interface ProductReportRecord {
  barcode: string;
  resolvedName: string;
  note?: string;
  domain?: string;
  locale?: string;
  /** ISO timestamp — the rules cap the string at 40 chars. */
  createdAt: string;
}

/** 'stored' = written to Firestore; 'saved-offline' = kept on-device only. */
export type ProductReportOutcome = 'stored' | 'saved-offline';

const QUEUE_KEY = 'smartjib.productReports.v1';
const QUEUE_LIMIT = 50;

function readQueue(): ProductReportRecord[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ProductReportRecord => {
      const record = item as ProductReportRecord;
      return Boolean(record)
        && typeof record.barcode === 'string'
        && typeof record.resolvedName === 'string'
        && typeof record.createdAt === 'string';
    });
  } catch {
    return [];
  }
}

/** The on-device mirror: offline proof and the signed-out fallback. */
export function readQueuedProductReports(): ProductReportRecord[] {
  return readQueue();
}

function appendToQueue(record: ProductReportRecord): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const next = [...readQueue(), record].slice(-QUEUE_LIMIT);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(next));
  } catch {
    // Quota exceeded — the Firestore write below is still attempted.
  }
}

function buildRecord(input: ProductReportInput): ProductReportRecord {
  const note = input.note?.trim();
  return {
    barcode: input.barcode,
    resolvedName: input.resolvedName.trim(),
    ...(note ? { note: note.slice(0, 500) } : {}),
    ...(input.domain ? { domain: input.domain.slice(0, 32) } : {}),
    ...(input.locale ? { locale: input.locale.slice(0, 8) } : {}),
    createdAt: new Date().toISOString(),
  };
}

export interface ProductReportDeps {
  /** Signed-in account the report is attributed to; null = queue only. */
  uid?: string | null;
  /** Injectable Firestore submitter (tests); defaults to the real path. */
  submit?: (record: ProductReportRecord, uid: string) => Promise<void>;
}

/**
 * Persists a "wrong result" report for a scanned product. The record is
 * ALWAYS mirrored to the on-device queue first (offline/signed-out proof),
 * then written to Firestore `users/{uid}/productReports` when an account is
 * available. Firestore failures degrade to the queue instead of blocking the
 * checkout flow.
 */
export async function submitProductReport(
  input: ProductReportInput,
  deps: ProductReportDeps = {},
): Promise<ProductReportOutcome> {
  const record = buildRecord(input);
  appendToQueue(record);
  const uid = deps.uid ?? null;
  if (!uid) return 'saved-offline';
  try {
    if (deps.submit) {
      await deps.submit(record, uid);
    } else {
      const { db, auth, isFirebaseConfigured } = await import('./firebase');
      if (!isFirebaseConfigured || !db || !auth?.currentUser) {
        return 'saved-offline';
      }
      const { collection, addDoc } = await import('firebase/firestore');
      await addDoc(collection(db, 'users', uid, 'productReports'), record);
    }
    return 'stored';
  } catch {
    return 'saved-offline';
  }
}
