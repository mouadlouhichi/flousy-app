'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  commitCourseMutation,
  CourseConflictError,
  saveProduct,
  subscribeActiveCourseSession,
  subscribeCourseSessions,
  subscribeProductCatalog,
} from '@/lib/db';
import type {
  AssessmentOrigin,
  SessionItem,
  CourseSession,
  Product,
  SessionItemQuality,
} from '@/lib/store';
import type { ProductAssessment } from '@/lib/ingredient-safety/types';
import { lookupMaSeed } from '@/lib/ma-product-seed';
import { lookupOffProduct } from '@/lib/product-lookup';
import {
  resolveScan,
  type ResolvedProduct,
  type ResolveScanOptions,
  type ScanResolution,
} from '@/lib/scan-resolution';
import type { BarcodeCandidate } from '@/lib/gtin';
import { gtinIdentity } from '@/lib/gtin';
import {
  applyAssessmentToSession,
  listCourseMutations,
  newCourseMutationId,
  putCourseMutation,
  removeCourseMutation,
  replaceCourseMutation,
  subscribeCourseOutbox,
  type CourseMutation,
  type CourseSyncState,
} from '@/lib/course-sync';

export type { RemoteProductInfo } from '@/lib/course-session';

interface LocalCourseState {
  schemaVersion: 2;
  active: CourseSession | null;
  history: CourseSession[];
  catalog: Product[];
}

const EMPTY_LOCAL: LocalCourseState = {
  schemaVersion: 2,
  active: null,
  history: [],
  catalog: [],
};

function localKey(scope: string): string {
  return `smartjib_course_state:v2:${encodeURIComponent(scope)}`;
}

function revision(session: CourseSession | null | undefined): number {
  return Number.isInteger(session?.revision) ? session!.revision! : 0;
}

function productIdentity(product: Pick<Product, 'barcode' | 'gtin14'>): string | null {
  return product.gtin14 ?? gtinIdentity(product.barcode);
}

function readLocal(scope: string): LocalCourseState {
  try {
    const raw = localStorage.getItem(localKey(scope));
    if (!raw) return EMPTY_LOCAL;
    const parsed = JSON.parse(raw) as Partial<LocalCourseState>;
    if (parsed.schemaVersion !== 2) return EMPTY_LOCAL;
    return {
      schemaVersion: 2,
      active: parsed.active?.status === 'active' ? parsed.active : null,
      history: Array.isArray(parsed.history) ? parsed.history.slice(0, 100) : [],
      catalog: Array.isArray(parsed.catalog) ? parsed.catalog.slice(0, 2000) : [],
    };
  } catch {
    return EMPTY_LOCAL;
  }
}

function persistLocal(scope: string, state: LocalCourseState): boolean {
  try {
    localStorage.setItem(localKey(scope), JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

function lineKey(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function sessionId(): string {
  return `course-${newCourseMutationId().replace(/^course-/, '')}`;
}

function sortHistory(sessions: CourseSession[]): CourseSession[] {
  return [...sessions]
    .filter((session) => session.status === 'completed')
    .sort((a, b) => (b.endedAt ?? b.startedAt).localeCompare(a.endedAt ?? a.startedAt))
    .slice(0, 100);
}

function mergeCatalog(local: readonly Product[], incoming: readonly Product[]): Product[] {
  const byIdentity = new Map<string, Product>();
  for (const product of [...local, ...incoming]) {
    const identity = productIdentity(product);
    if (!identity) continue;
    const previous = byIdentity.get(identity);
    if (!previous) {
      byIdentity.set(identity, { ...product, gtin14: identity });
      continue;
    }
    const previousTime = Date.parse(previous.updatedAt ?? previous.retrievedAt ?? '') || 0;
    const nextTime = Date.parse(product.updatedAt ?? product.retrievedAt ?? '') || 0;
    byIdentity.set(identity, nextTime >= previousTime
      ? { ...previous, ...product, gtin14: identity }
      : { ...product, ...previous, gtin14: identity });
  }
  return [...byIdentity.values()].slice(-2000);
}

function replaceSession(
  active: CourseSession | null,
  history: readonly CourseSession[],
  next: CourseSession,
): { active: CourseSession | null; history: CourseSession[] } {
  const without = history.filter((session) => session.id !== next.id);
  if (next.status === 'active') return { active: next, history: without };
  return {
    active: active?.id === next.id ? null : active,
    history: sortHistory([next, ...without]),
  };
}

export interface CourseAssessmentResult {
  quality?: SessionItemQuality | null;
  assessment?: ProductAssessment | null;
}

export function useCourseSession(uid: string | null | undefined) {
  const scope = uid || 'local-demo';
  const initial = typeof window === 'undefined' ? EMPTY_LOCAL : readLocal(scope);
  const [active, setActive] = useState<CourseSession | null>(initial.active);
  const [history, setHistory] = useState<CourseSession[]>(initial.history);
  const [catalog, setCatalog] = useState<Product[]>(initial.catalog);
  const [syncState, setSyncState] = useState<CourseSyncState>('synced');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pendingMutations, setPendingMutations] = useState(0);

  const activeRef = useRef(active);
  const historyRef = useRef(history);
  const catalogRef = useRef(catalog);
  const scopeRef = useRef(scope);
  const flushRef = useRef(false);
  const mountedRef = useRef(true);

  const setAllSessions = useCallback((nextActive: CourseSession | null, nextHistory: CourseSession[]) => {
    activeRef.current = nextActive;
    historyRef.current = nextHistory;
    setActive(nextActive);
    setHistory(nextHistory);
  }, []);

  const applySession = useCallback((session: CourseSession) => {
    const next = replaceSession(activeRef.current, historyRef.current, session);
    setAllSessions(next.active, next.history);
  }, [setAllSessions]);

  const removeSessionLocally = useCallback((id: string) => {
    setAllSessions(
      activeRef.current?.id === id ? null : activeRef.current,
      historyRef.current.filter((session) => session.id !== id),
    );
  }, [setAllSessions]);

  const refreshPendingCount = useCallback(() => {
    if (!uid || typeof window === 'undefined') {
      setPendingMutations(0);
      return [] as CourseMutation[];
    }
    const pending = listCourseMutations(uid);
    setPendingMutations(pending.length);
    return pending;
  }, [uid]);

  const flushOutbox = useCallback(async () => {
    if (!uid || flushRef.current || typeof window === 'undefined') return;
    flushRef.current = true;
    setSyncError(null);
    try {
      let pending = listCourseMutations(uid);
      setPendingMutations(pending.length);
      if (pending.length === 0) {
        setSyncState('synced');
        return;
      }
      setSyncState('syncing');

      for (const mutation of pending) {
        if (!mountedRef.current || scopeRef.current !== uid) return;
        try {
          const committed = await commitCourseMutation(uid, mutation);
          removeCourseMutation(uid, mutation.id);
          if (committed) {
            const local = activeRef.current?.id === committed.id
              ? activeRef.current
              : historyRef.current.find((item) => item.id === committed.id);
            if (!local || revision(committed) >= revision(local)) applySession(committed);
          } else {
            removeSessionLocally(mutation.sessionId);
          }
        } catch (error) {
          if (error instanceof CourseConflictError) {
            setSyncState('conflict');
            setSyncError(error.message);
          } else {
            const attempted: CourseMutation = { ...mutation, attempts: mutation.attempts + 1 };
            replaceCourseMutation(attempted);
            setSyncState(typeof navigator !== 'undefined' && !navigator.onLine ? 'pending' : 'failed');
            setSyncError(error instanceof Error ? error.message : 'Shopping changes could not be synced.');
          }
          break;
        }
      }
      pending = listCourseMutations(uid);
      setPendingMutations(pending.length);
      if (pending.length === 0) setSyncState('synced');
      else setSyncState((current) => current === 'conflict' || current === 'failed' ? current : 'pending');
    } finally {
      flushRef.current = false;
    }
  }, [applySession, removeSessionLocally, uid]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    scopeRef.current = scope;
    const local = readLocal(scope);
    activeRef.current = local.active;
    historyRef.current = local.history;
    catalogRef.current = local.catalog;
    setActive(local.active);
    setHistory(local.history);
    setCatalog(local.catalog);
    setSyncError(null);

    if (!uid) {
      setSyncState('synced');
      setPendingMutations(0);
      return;
    }

    const applyRemote = (session: CourseSession) => {
      const localSession = activeRef.current?.id === session.id
        ? activeRef.current
        : historyRef.current.find((item) => item.id === session.id);
      if (localSession && revision(localSession) > revision(session)) return;
      applySession(session);
    };

    const unsubscribeCatalog = subscribeProductCatalog(uid, (products) => {
      const merged = mergeCatalog(catalogRef.current, products);
      catalogRef.current = merged;
      setCatalog(merged);
    });
    const unsubscribeActive = subscribeActiveCourseSession(uid, (session) => {
      if (session) applyRemote(session);
      else if (activeRef.current && !listCourseMutations(uid).some((mutation) => mutation.sessionId === activeRef.current?.id)) {
        setAllSessions(null, historyRef.current);
      }
    });
    const unsubscribeHistory = subscribeCourseSessions(uid, (sessions) => {
      for (const session of sessions) applyRemote(session);
    });
    const unsubscribeOutbox = subscribeCourseOutbox(uid, () => {
      refreshPendingCount();
      void flushOutbox();
    });
    const onOnline = () => void flushOutbox();
    window.addEventListener('online', onOnline);
    refreshPendingCount();
    void flushOutbox();

    return () => {
      unsubscribeCatalog();
      unsubscribeActive();
      unsubscribeHistory();
      unsubscribeOutbox();
      window.removeEventListener('online', onOnline);
    };
  }, [applySession, flushOutbox, refreshPendingCount, scope, setAllSessions, uid]);

  useEffect(() => {
    const ok = persistLocal(scope, { schemaVersion: 2, active, history, catalog });
    if (!ok) {
      setSyncState('failed');
      setSyncError('Shopping changes could not be saved on this device.');
    }
  }, [active, catalog, history, scope]);

  const enqueueSave = useCallback((base: CourseSession, changed: CourseSession): CourseSession => {
    const expectedRevision = revision(base);
    const mutationId = newCourseMutationId();
    const next: CourseSession = {
      ...changed,
      revision: expectedRevision + 1,
      updatedAt: new Date().toISOString(),
      lastMutationId: mutationId,
    };
    applySession(next);

    if (uid) {
      const stored = putCourseMutation({
        schemaVersion: 1,
        id: mutationId,
        uid,
        kind: 'save',
        sessionId: next.id,
        expectedRevision,
        session: next,
        createdAt: new Date().toISOString(),
        attempts: 0,
      });
      if (!stored) {
        setSyncState('failed');
        setSyncError('Shopping changes could not be queued on this device.');
      } else {
        setSyncState('pending');
        refreshPendingCount();
        void flushOutbox();
      }
    }
    return next;
  }, [applySession, flushOutbox, refreshPendingCount, uid]);

  const mutateSession = useCallback((id: string, updater: (session: CourseSession) => CourseSession): CourseSession | null => {
    const base = activeRef.current?.id === id
      ? activeRef.current
      : historyRef.current.find((session) => session.id === id) ?? null;
    if (!base) return null;
    return enqueueSave(base, updater(base));
  }, [enqueueSave]);

  const startSession = useCallback((params: { currency: string; place?: string }) => {
    if (activeRef.current) return activeRef.current;
    const now = new Date().toISOString();
    const base: CourseSession = {
      id: sessionId(),
      status: 'active',
      startedAt: now,
      date: now.slice(0, 10),
      currency: params.currency,
      place: params.place ?? '',
      items: [],
      total: 0,
      revision: 0,
    };
    return enqueueSave(base, base);
  }, [enqueueSave]);

  const addScannedLine = useCallback((line: Omit<SessionItem, 'key' | 'lineTotal'> & { key?: string }) => {
    const current = activeRef.current;
    if (!current) return null;
    const item: SessionItem = {
      ...line,
      key: line.key ?? lineKey(),
      lineTotal: line.unitPrice * line.qty,
    };
    return enqueueSave(current, {
      ...current,
      items: [...current.items, item],
      total: current.total + item.unitPrice * item.qty,
    });
  }, [enqueueSave]);

  const setQty = useCallback((key: string, qty: number) => {
    const current = activeRef.current;
    if (!current) return;
    const items = qty <= 0
      ? current.items.filter((line) => line.key !== key)
      : current.items.map((line) => line.key === key ? { ...line, qty, lineTotal: line.unitPrice * qty } : line);
    enqueueSave(current, { ...current, items, total: items.reduce((sum, line) => sum + line.qty * line.unitPrice, 0) });
  }, [enqueueSave]);

  const removeLine = useCallback((key: string) => setQty(key, 0), [setQty]);

  const applyAssessment = useCallback((origin: AssessmentOrigin, result: CourseAssessmentResult): boolean => {
    const current = activeRef.current?.id === origin.sessionId
      ? activeRef.current
      : historyRef.current.find((session) => session.id === origin.sessionId);
    if (!current || !result.assessment) return false;
    const expectedRevision = revision(current);
    const mutationId = newCourseMutationId();
    const next = applyAssessmentToSession(current, {
      mutationId,
      sessionId: origin.sessionId,
      origin,
      quality: result.quality,
      assessment: result.assessment,
    }, new Date().toISOString());
    if (!next) return false;
    applySession(next);

    if (uid) {
      const stored = putCourseMutation({
        schemaVersion: 1,
        id: mutationId,
        uid,
        kind: 'assessment',
        sessionId: origin.sessionId,
        expectedRevision,
        origin,
        ...(result.quality ? { quality: result.quality } : {}),
        assessment: result.assessment,
        createdAt: new Date().toISOString(),
        attempts: 0,
      });
      if (stored) {
        setSyncState('pending');
        refreshPendingCount();
        void flushOutbox();
      } else {
        setSyncState('failed');
        setSyncError('The ingredient assessment could not be queued on this device.');
      }
    }
    return true;
  }, [applySession, flushOutbox, refreshPendingCount, uid]);

  const setLineQuality = useCallback((barcode: string, quality: SessionItemQuality) => {
    const current = activeRef.current;
    if (!current) return;
    const identity = gtinIdentity(barcode);
    const line = current.items.find((item) => (item.gtin14 ?? gtinIdentity(item.barcode ?? '')) === identity);
    if (!line) return;
    enqueueSave(current, {
      ...current,
      items: current.items.map((item) => item.key === line.key ? { ...item, quality } : item),
    });
  }, [enqueueSave]);

  const finishSession = useCallback(() => {
    const current = activeRef.current;
    if (!current || current.items.length === 0) return null;
    return enqueueSave(current, { ...current, status: 'completed', endedAt: new Date().toISOString() });
  }, [enqueueSave]);

  const discardSession = useCallback((id: string) => {
    const current = activeRef.current?.id === id
      ? activeRef.current
      : historyRef.current.find((session) => session.id === id);
    if (!current) return;
    removeSessionLocally(id);
    if (!uid) return;
    const mutation: CourseMutation = {
      schemaVersion: 1,
      id: newCourseMutationId(),
      uid,
      kind: 'delete',
      sessionId: id,
      expectedRevision: revision(current),
      createdAt: new Date().toISOString(),
      attempts: 0,
    };
    if (putCourseMutation(mutation)) {
      setSyncState('pending');
      refreshPendingCount();
      void flushOutbox();
    } else {
      setSyncState('failed');
      setSyncError('The shopping-session deletion could not be queued.');
    }
  }, [flushOutbox, refreshPendingCount, removeSessionLocally, uid]);

  const markLogged = useCallback((id: string, expenseId: string) => {
    mutateSession(id, (session) => ({ ...session, loggedExpenseId: expenseId }));
  }, [mutateSession]);

  const setSessionPlace = useCallback((id: string, place: string) => {
    mutateSession(id, (session) => ({ ...session, place }));
  }, [mutateSession]);

  const upsertProduct = useCallback((product: Product | ResolvedProduct) => {
    const identity = productIdentity(product);
    if (!identity) return;
    const existing = catalogRef.current.find((item) => productIdentity(item) === identity);
    const now = new Date().toISOString();
    const normalized: Product = {
      ...product,
      gtin14: identity,
      createdAt: 'createdAt' in product ? product.createdAt : existing?.createdAt ?? now,
      updatedAt: 'updatedAt' in product ? product.updatedAt : now,
    };
    const merged = mergeCatalog(catalogRef.current, [normalized]);
    catalogRef.current = merged;
    setCatalog(merged);
    if (uid) void saveProduct(uid, normalized).catch((error) => console.error(error));
  }, [uid]);

  const resolveBarcode = useCallback(async (
    candidate: string | BarcodeCandidate,
    options: Partial<Pick<ResolveScanOptions, 'lang' | 'signal' | 'domainOverride' | 'restrictedCirculation'>> = {},
  ): Promise<ScanResolution> => {
    const result = await resolveScan({
      candidate: typeof candidate === 'string' ? { rawValue: candidate, source: 'manual' } : candidate,
      catalog: catalogRef.current,
      lookupSeed: lookupMaSeed,
      lookupRemote: (barcode, lookupOptions) => lookupOffProduct(barcode, lookupOptions),
      ...options,
    });
    if (result.kind === 'found') {
      upsertProduct(result.product);
      if (result.revalidate) {
        void result.revalidate.then((fresh) => {
          if (fresh) upsertProduct(fresh);
        });
      }
    }
    return result;
  }, [upsertProduct]);

  const retrySync = useCallback(() => {
    setSyncState('pending');
    void flushOutbox();
  }, [flushOutbox]);

  const discardConflictingMutation = useCallback(() => {
    if (!uid) return;
    const [first] = listCourseMutations(uid);
    if (first) removeCourseMutation(uid, first.id);
    setSyncError(null);
    refreshPendingCount();
    void flushOutbox();
  }, [flushOutbox, refreshPendingCount, uid]);

  return {
    active,
    history,
    catalog,
    syncState,
    syncError,
    pendingMutations,
    startSession,
    addScannedLine,
    setQty,
    removeLine,
    applyAssessment,
    setLineQuality,
    finishSession,
    discardSession,
    markLogged,
    acceptCommittedSession: applySession,
    setSessionPlace,
    resolveBarcode,
    upsertProduct,
    retrySync,
    discardConflictingMutation,
  };
}
