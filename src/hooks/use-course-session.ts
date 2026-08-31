'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isFirebaseConfigured } from '@/lib/firebase';
import {
  deleteCourseSession,
  saveCourseSession,
  saveProduct,
  subscribeActiveCourseSession,
  subscribeCourseSessions,
  subscribeProductCatalog,
} from '@/lib/db';
import {
  addItemToSession,
  completeSession,
  createSession,
  createSessionItem,
  markSessionLogged,
  normalizeBarcode,
  removeSessionItem,
  resolveProduct,
  setItemName,
  setItemPrice,
  setItemQty,
  type ProductResolution,
} from '@/lib/course-session';
import { lookupOffProduct } from '@/lib/product-lookup';
import { lookupMaSeed } from '@/lib/ma-product-seed';
import type { CourseSession, MoneyPlace, Product } from '@/lib/store';

const CATALOG_KEY = 'flousy_course_catalog';
const SESSIONS_KEY = 'flousy_course_sessions';

function readLocalJson<T>(key: string, fallback: T): T {
  try {
    const raw = typeof window === 'undefined' ? null : window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked/full — in-memory state keeps working */
  }
}

export type BarcodeScanResult =
  | { ok: false; reason: 'invalid-code' }
  | { ok: true; barcode: string; resolution: ProductResolution };

/**
 * Course session store: product catalog + active session + finished history.
 *
 * Persistence mirrors the rest of the app: live Firestore subscriptions when
 * Firebase is configured, `localStorage` (demo mode) otherwise. All mutations
 * are optimistic — state updates first, the save follows.
 */
export function useCourseSession(uid: string | null | undefined) {
  const firebaseOn = isFirebaseConfigured && !!uid;

  const [catalog, setCatalog] = useState<Product[]>([]);
  const [sessions, setSessions] = useState<CourseSession[]>([]);
  const [loaded, setLoaded] = useState(false);

  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const uidRef = useRef(uid);
  uidRef.current = uid;

  const active = useMemo(() => sessions.find((s) => s.status === 'active') ?? null, [sessions]);
  const history = useMemo(
    () =>
      sessions
        .filter((s) => s.status === 'completed')
        .sort((a, b) => (b.endedAt ?? b.startedAt).localeCompare(a.endedAt ?? a.startedAt)),
    [sessions],
  );

  // Demo mode (no Firebase): hydrate from localStorage.
  useEffect(() => {
    if (firebaseOn) return;
    setSessions(readLocalJson<CourseSession[]>(SESSIONS_KEY, []));
    setCatalog(readLocalJson<Product[]>(CATALOG_KEY, []));
    setLoaded(true);
  }, [firebaseOn]);

  // Firebase mode: live subscriptions.
  useEffect(() => {
    if (!firebaseOn || !uid) return;
    let cancelled = false;

    const unsubs = [
      subscribeProductCatalog(uid, (products) => {
        if (!cancelled) setCatalog(products);
      }),
      subscribeActiveCourseSession(uid, (session) => {
        if (cancelled) return;
        setSessions((prev) => {
          // Firestore sends null when there is no active session. Do not
          // dereference it while removing a previously active local copy.
          if (!session) return prev.filter((s) => s.status !== 'active');
          const rest = prev.filter((s) => s && s.id !== session.id);
          return [session, ...rest];
        });
        setLoaded(true);
      }),
      subscribeCourseSessions(uid, (list) => {
        if (cancelled) return;
        setSessions((prev) => {
          const incoming = new Set(list.map((s) => s.id));
          const keep = prev.filter((s) => !incoming.has(s.id));
          return [...list, ...keep];
        });
        setLoaded(true);
      }),
    ];
    return () => {
      cancelled = true;
      unsubs.forEach((unsubscribe) => unsubscribe());
    };
  }, [firebaseOn, uid]);

  const persistSession = useCallback((session: CourseSession) => {
    const currentUid = uidRef.current;
    if (isFirebaseConfigured && currentUid) {
      saveCourseSession(currentUid, session).catch((err) => console.error(err));
    } else {
      const all = readLocalJson<CourseSession[]>(SESSIONS_KEY, []).filter((s) => s.id !== session.id);
      writeLocalJson(SESSIONS_KEY, [session, ...all]);
    }
  }, []);

  const upsertProduct = useCallback((product: Product) => {
    setCatalog((prev) => {
      const rest = prev.filter((p) => p.barcode !== product.barcode);
      const next = [product, ...rest];
      if (!isFirebaseConfigured) writeLocalJson(CATALOG_KEY, next);
      return next;
    });
    const currentUid = uidRef.current;
    if (isFirebaseConfigured && currentUid) {
      saveProduct(currentUid, product).catch((err) => console.error(err));
    }
  }, []);

  const startSession = useCallback(
    (opts: { currency: string; place: MoneyPlace }) => {
      const session = createSession(opts);
      setSessions((prev) => [session, ...prev.filter((s) => s.status !== 'active')]);
      persistSession(session);
    },
    [persistSession],
  );

  const mutateActive = useCallback(
    (fn: (session: CourseSession) => CourseSession) => {
      const current = sessionsRef.current.find((s) => s.status === 'active');
      if (!current) return;
      const next = fn(current);
      setSessions((prev) => prev.map((s) => (s.id === next.id ? next : s)));
      persistSession(next);
    },
    [persistSession],
  );

  /** Complete the active session; returns the completed (bill) session. */
  const finishSession = useCallback((): CourseSession | null => {
    const current = sessionsRef.current.find((s) => s.status === 'active');
    if (!current) return null;
    const next = completeSession(current);
    setSessions((prev) => prev.map((s) => (s.id === next.id ? next : s)));
    persistSession(next);
    return next;
  }, [persistSession]);

  /** Move the paid-from place onto any session (active or completed). */
  const setSessionPlace = useCallback(
    (sessionId: string, place: MoneyPlace) => {
      const target = sessionsRef.current.find((s) => s.id === sessionId);
      if (!target) return;
      const next = { ...target, place };
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? next : s)));
      persistSession(next);
    },
    [persistSession],
  );

  const discardSession = useCallback(
    (id: string) => {
      setSessions((prev) => prev.filter((s) => s.id !== id));
      const currentUid = uidRef.current;
      if (isFirebaseConfigured && currentUid) {
        deleteCourseSession(currentUid, id).catch((err) => console.error(err));
      } else {
        writeLocalJson(
          SESSIONS_KEY,
          readLocalJson<CourseSession[]>(SESSIONS_KEY, []).filter((s) => s.id !== id),
        );
      }
    },
    [],
  );

  /**
   * Link a finished session to the variable expense its total was logged as
   * (idempotency guard — the bill shows "added" instead of a second button).
   */
  const markLogged = useCallback(
    (sessionId: string, expenseId: string) => {
      const target = sessionsRef.current.find((s) => s.id === sessionId);
      if (!target || target.loggedExpenseId) return;
      const next = markSessionLogged(target, expenseId);
      setSessions((prev) => prev.map((s) => (s.id === next.id ? next : s)));
      persistSession(next);
    },
    [persistSession],
  );

  /** Add a line for a resolved product, then remember its price in the catalog. */
  const addScannedLine = useCallback(
    (input: { barcode?: string; name: string; category?: string; unitPrice: number; qty?: number }) => {
      const item = createSessionItem(input);
      mutateActive((session) => addItemToSession(session, item));

      if (input.barcode) {
        const nowIso = new Date().toISOString();
        const existing = catalog.find((p) => p.barcode === input.barcode);
        upsertProduct({
          barcode: input.barcode,
          name: input.name,
          ...(input.category ? { category: input.category } : existing?.category ? { category: existing.category } : {}),
          ...(existing?.brand ? { brand: existing.brand } : {}),
          ...(existing?.imageUrl ? { imageUrl: existing.imageUrl } : {}),
          lastPrice: item.unitPrice,
          priceUpdatedAt: nowIso,
          source: existing?.source ?? 'session',
          ...(existing?.origin ? { origin: existing.origin } : {}),
          createdAt: existing?.createdAt ?? nowIso,
          updatedAt: nowIso,
        });
      }
    },
    [catalog, mutateActive, upsertProduct],
  );

  /** Resolve raw scanner/manual input through the catalog → remote cascade. */
  const resolveBarcode = useCallback(
    async (raw: string): Promise<BarcodeScanResult> => {
      const { barcode } = normalizeBarcode(raw);
      if (!barcode) return { ok: false, reason: 'invalid-code' };
      const resolution = await resolveProduct({
        barcode,
        catalog,
        lookupSeed: lookupMaSeed,
        lookupRemote: lookupOffProduct,
      });
      return { ok: true, barcode, resolution };
    },
    [catalog],
  );

  return {
    loaded,
    catalog,
    active,
    history,
    startSession,
    resolveBarcode,
    addScannedLine,
    upsertProduct,
    setQty: (key: string, qty: number) => mutateActive((s) => setItemQty(s, key, qty)),
    setPrice: (key: string, price: number) => mutateActive((s) => setItemPrice(s, key, price)),
    setName: (key: string, name: string) => mutateActive((s) => setItemName(s, key, name)),
    setPlace: (place: MoneyPlace) => mutateActive((s) => ({ ...s, place })),
    setSessionPlace,
    removeLine: (key: string) => mutateActive((s) => removeSessionItem(s, key)),
    finishSession,
    discardSession,
    markLogged,
  };
}

export type CourseStore = ReturnType<typeof useCourseSession>;
