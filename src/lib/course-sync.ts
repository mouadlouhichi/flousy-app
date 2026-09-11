import type { AssessmentOrigin, CourseSession, SessionItemQuality } from './store';
import type { ProductAssessment } from './ingredient-safety/types';

export type CourseMutation =
  | {
      schemaVersion: 1;
      id: string;
      uid: string;
      kind: 'save';
      sessionId: string;
      expectedRevision: number;
      session: CourseSession;
      createdAt: string;
      attempts: number;
    }
  | {
      schemaVersion: 1;
      id: string;
      uid: string;
      kind: 'assessment';
      sessionId: string;
      expectedRevision: number;
      origin: AssessmentOrigin;
      quality?: SessionItemQuality | null;
      assessment: ProductAssessment;
      createdAt: string;
      attempts: number;
    }
  | {
      schemaVersion: 1;
      id: string;
      uid: string;
      kind: 'delete';
      sessionId: string;
      expectedRevision: number;
      createdAt: string;
      attempts: number;
    };

const MAX_MUTATIONS = 200;
const EVENT_NAME = 'flousy:course-outbox';

function key(uid: string): string {
  return `smartjib_course_outbox:v1:${encodeURIComponent(uid)}`;
}

export function newCourseMutationId(): string {
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  return `course-${id}`;
}

function validMutation(value: unknown, uid: string): value is CourseMutation {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<CourseMutation>;
  return item.schemaVersion === 1
    && item.uid === uid
    && typeof item.id === 'string'
    && (item.kind === 'save' || item.kind === 'assessment' || item.kind === 'delete')
    && typeof item.sessionId === 'string'
    && Number.isInteger(item.expectedRevision)
    && typeof item.createdAt === 'string'
    && typeof item.attempts === 'number'
    && (item.kind !== 'save' || Boolean(item.session && item.session.id === item.sessionId))
    && (item.kind !== 'assessment' || Boolean(
      item.origin
      && item.origin.sessionId === item.sessionId
      && item.assessment
      && typeof item.assessment === 'object',
    ));
}

export function listCourseMutations(uid: string): CourseMutation[] {
  try {
    const raw = localStorage.getItem(key(uid));
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => validMutation(item, uid)).slice(-MAX_MUTATIONS);
  } catch {
    return [];
  }
}

function write(uid: string, mutations: readonly CourseMutation[]): boolean {
  try {
    localStorage.setItem(key(uid), JSON.stringify(mutations.slice(-MAX_MUTATIONS)));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { uid } }));
    return true;
  } catch {
    return false;
  }
}

export function putCourseMutation(mutation: CourseMutation): boolean {
  const current = listCourseMutations(mutation.uid);
  if (current.some((item) => item.id === mutation.id)) return true;
  return write(mutation.uid, [...current, mutation]);
}

export function replaceCourseMutation(mutation: CourseMutation): boolean {
  const current = listCourseMutations(mutation.uid);
  return write(mutation.uid, current.map((item) => item.id === mutation.id ? mutation : item));
}

export function removeCourseMutation(uid: string, mutationId: string): boolean {
  return write(uid, listCourseMutations(uid).filter((item) => item.id !== mutationId));
}

export function clearCourseMutations(uid: string): boolean {
  return write(uid, []);
}

export function subscribeCourseOutbox(uid: string, listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === key(uid)) listener();
  };
  const onLocal = (event: Event) => {
    const detail = (event as CustomEvent<{ uid?: string }>).detail;
    if (detail?.uid === uid) listener();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(EVENT_NAME, onLocal);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(EVENT_NAME, onLocal);
  };
}

export interface AssessmentApplication {
  mutationId: string;
  sessionId: string;
  origin: AssessmentOrigin;
  quality?: SessionItemQuality | null;
  assessment: ProductAssessment;
}

/**
 * Rebase one delayed assessment onto the latest remote/local session only when
 * its immutable session, line, request, and canonical GTIN identity still
 * match. The current session revision may have advanced for unrelated edits.
 * Returning null is a real identity conflict, never a signal to retarget the
 * result to another active session.
 */
export function applyAssessmentToSession(
  remote: CourseSession | null,
  application: AssessmentApplication,
  updatedAt: string,
): CourseSession | null {
  if (!remote || remote.id !== application.sessionId) return null;
  if (remote.lastMutationId === application.mutationId) return remote;
  if (application.origin.sessionId !== application.sessionId) return null;

  const line = remote.items.find((item) => item.key === application.origin.lineItemId);
  if (!line || line.assessmentRequestId !== application.origin.requestId) return null;
  // Exact optional identity equality prevents a crafted origin that omits a
  // GTIN from attaching to a scanned line, while still supporting manual rows.
  if ((line.gtin14 ?? null) !== (application.origin.gtin14 ?? null)) return null;

  const remoteRevision = Number.isInteger(remote.revision) ? remote.revision! : 0;
  return {
    ...remote,
    items: remote.items.map((item) => item.key === application.origin.lineItemId ? {
      ...item,
      quality: application.quality ?? undefined,
      assessment: application.assessment,
      assessmentOrigin: application.origin,
      // Consume the pending request marker. Idempotent replay is recognized by
      // lastMutationId above; a second completion cannot overwrite this one.
      assessmentRequestId: undefined,
    } : item),
    revision: remoteRevision + 1,
    updatedAt,
    lastMutationId: application.mutationId,
  };
}

export type CourseSyncState = 'synced' | 'pending' | 'syncing' | 'conflict' | 'failed';
