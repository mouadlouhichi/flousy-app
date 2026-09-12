/** Pure scanner lifecycle primitives shared by camera and keyboard-wedge paths. */

export interface ScannerAcceptanceState {
  generation: number;
  armed: boolean;
}

export function createScannerAcceptanceState(): ScannerAcceptanceState {
  return { generation: 0, armed: false };
}

/** Begin one camera/acquisition generation. Any callback holding an older
 * generation becomes stale immediately. */
export function armScannerGeneration(state: ScannerAcceptanceState): number {
  state.generation += 1;
  state.armed = true;
  return state.generation;
}

/** Invalidate every outstanding decoder callback before asynchronous teardown. */
export function invalidateScannerGeneration(state: ScannerAcceptanceState): number {
  state.generation += 1;
  state.armed = false;
  return state.generation;
}

/** Synchronous one-generation mutex. JavaScript callbacks cannot both claim an
 * armed generation because the first claim disarms it before returning. */
export function claimScannerCandidate(
  state: ScannerAcceptanceState,
  callbackGeneration: number,
  enabled: boolean,
): boolean {
  if (!enabled || !state.armed || callbackGeneration !== state.generation) return false;
  state.armed = false;
  return true;
}

const WEDGE_DIGIT = /^[0-9٠-٩۰-۹]$/u;
const GTIN_LENGTHS = new Set([8, 12, 13, 14]);

/** Stateful collector for fast keyboard-wedge input. It does not establish
 * GTIN validity; the shared strict parser remains the only acceptance boundary. */
export class KeyboardWedgeCollector {
  private buffer = '';
  private lastKeyAt = 0;

  constructor(private readonly maxGapMs = 100) {}

  reset(): void {
    this.buffer = '';
    this.lastKeyAt = 0;
  }

  push(key: string, now = Date.now()): string | null {
    if (this.lastKeyAt > 0 && now - this.lastKeyAt > this.maxGapMs) this.buffer = '';
    this.lastKeyAt = now;

    if (WEDGE_DIGIT.test(key)) {
      if ([...this.buffer].length >= 14) this.buffer = '';
      this.buffer += key;
      return null;
    }

    if (key === 'Enter') {
      const value = GTIN_LENGTHS.has([...this.buffer].length) ? this.buffer : null;
      this.reset();
      return value;
    }

    // A scanner payload is digits followed by Enter. Any printable noise must
    // invalidate the partial buffer rather than silently splice two sequences.
    if (key.length === 1) this.reset();
    return null;
  }
}
