import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  KeyboardWedgeCollector,
  armScannerGeneration,
  claimScannerCandidate,
  createScannerAcceptanceState,
  invalidateScannerGeneration,
} from '../src/lib/scanner-lifecycle';
import { parseGtin } from '../src/lib/gtin';

function enter(collector: KeyboardWedgeCollector, value: string, start = 1_000): string | null {
  [...value].forEach((digit, index) => collector.push(digit, start + index * 5));
  return collector.push('Enter', start + [...value].length * 5);
}

describe('scanner generation and acceptance lifecycle', () => {
  it('allows exactly one synchronous acceptance per armed generation', () => {
    const state = createScannerAcceptanceState();
    const generation = armScannerGeneration(state);
    assert.equal(claimScannerCandidate(state, generation, true), true);
    assert.equal(claimScannerCandidate(state, generation, true), false, 'a concurrent decoder must lose the mutex');
    assert.equal(state.armed, false);
  });

  it('rejects stale decoder callbacks after retry, stop, or visibility invalidation', () => {
    const state = createScannerAcceptanceState();
    const stale = armScannerGeneration(state);
    const current = armScannerGeneration(state);
    assert.notEqual(stale, current);
    assert.equal(claimScannerCandidate(state, stale, true), false);
    assert.equal(state.armed, true, 'a stale callback must not consume the current generation');
    assert.equal(claimScannerCandidate(state, current, true), true);

    const next = armScannerGeneration(state);
    invalidateScannerGeneration(state);
    assert.equal(claimScannerCandidate(state, next, true), false);
    assert.equal(state.armed, false);
  });

  it('does not consume an armed generation while the owning screen is disabled', () => {
    const state = createScannerAcceptanceState();
    const generation = armScannerGeneration(state);
    assert.equal(claimScannerCandidate(state, generation, false), false);
    assert.equal(state.armed, true);
    assert.equal(claimScannerCandidate(state, generation, true), true);
  });
});

describe('knowledge scan UX contract', () => {
  it('routes automatically without a domain selector and keeps the animated scan line', () => {
    const screen = readFileSync(
      new URL('../src/components/dashboard/screens/knowledge-screen.tsx', import.meta.url),
      'utf8',
    );
    const scanner = readFileSync(
      new URL('../src/components/ui/barcode-scanner-panel.tsx', import.meta.url),
      'utf8',
    );

    assert.doesNotMatch(screen, /domainOverride|domainSelector|DOMAINS\.map/);
    assert.match(screen, /const selectedDomain = product\?\.domain \?\? 'food'/);
    assert.match(screen, /<CoursesScannerPanel/);
    assert.match(scanner, /animate-scan-line/);
  });
});

describe('shared scanner camera UX contract', () => {
  const scanner = readFileSync(
    new URL('../src/components/ui/barcode-scanner-panel.tsx', import.meta.url),
    'utf8',
  );
  const hook = readFileSync(
    new URL('../src/hooks/use-barcode-scanner.ts', import.meta.url),
    'utf8',
  );

  it('keeps the original camera look: scan frame, sweeping line, zoom and hint always visible', () => {
    // The scan frame (corner brackets + animated line) is rendered whenever
    // the camera runs — never gated behind a decoder/ROI condition.
    assert.doesNotMatch(scanner, /roiActive/);
    assert.match(scanner, /animate-scan-line/);
    assert.match(scanner, /labels\.alignHint/);
    // The zoom control is part of the original panel: always rendered, with
    // a digital fallback when the camera track has no hardware zoom.
    assert.doesNotMatch(scanner, /hardwareZoomAvailable && \(\s*<div className="absolute bottom-3/);
    assert.match(scanner, /labels\.zoomIn/);
    assert.match(scanner, /labels\.zoomOut/);
    // Digital zoom fallback: the video feed is scaled in CSS exactly when
    // hardware zoom is unavailable, with the pre-audit 2× default.
    assert.match(scanner, /transform: `scale\(\$\{zoom\}\)`/);
    assert.match(hook, /initialZoom = 2/);
    assert.match(hook, /MAX_DIGITAL_ZOOM = 8/);
  });

  it('restores the panel without a camera-picker dropdown', () => {
    assert.doesNotMatch(scanner, /<select/);
    assert.doesNotMatch(scanner, /selectedDeviceId/);
    assert.doesNotMatch(scanner, /cameraSelect/);
  });

  it('keeps the camera preview live after a scan (main-branch UX)', () => {
    // accept() pauses the decoders but must NOT tear down the camera stream.
    const acceptBody = hook.slice(
      hook.indexOf('const accept ='),
      hook.indexOf('const getVideoTrack'),
    );
    assert.ok(acceptBody.length > 0, 'accept() block not found');
    assert.doesNotMatch(acceptBody, /tearDown\(\)/);
    assert.match(hook, /const pauseDecoders/);
    // A disabled panel softly pauses (stream stays attached) instead of a full
    // camera teardown, and start() reuses the live stream without re-acquiring.
    assert.match(hook, /startedForEnableRef\.current = false;\s*(?:\/\/[^\n]*\n\s*)*pause\(\);/);
    assert.match(hook, /isStreamLive\(\) && videoRef\.current\?\.srcObject/);
    // The panel no longer force-stops the camera when its enabled gate flips.
    assert.doesNotMatch(scanner, /if \(!enabled\) stop\(\);/);
    // The zxing fallback must decode from the video element, never from the
    // stream: decodeFromStream's controls.stop() disposes the MediaStream
    // tracks, which is what turned the camera off after a scan on iOS.
    assert.match(hook, /decodeFromVideoElement\(video,/);
    assert.doesNotMatch(hook, /decodeFromStream\(/);
  });

  it('re-arms decoding inside accept() — the camera never waits for an enabled flip', () => {
    // Main-branch behavior: once enabled, the camera decodes continuously.
    // accept() itself re-arms a new generation on the still-live stream, so
    // consumers no longer toggle `enabled` to resume after a scan.
    const acceptBody = hook.slice(
      hook.indexOf('const accept ='),
      hook.indexOf('const getVideoTrack'),
    );
    assert.ok(acceptBody.length > 0, 'accept() block not found');
    assert.match(acceptBody, /armScannerGeneration\(acceptanceRef\.current\)/);
    assert.match(acceptBody, /restartDecodersRef\.current\(rearmGeneration\)/);
    assert.match(hook, /restartDecodersRef = useRef/);
    // A stationary barcode must not machine-gun repeated accepts: the same
    // raw camera code is suppressed inside a short re-trigger window.
    assert.match(hook, /SAME_CODE_RETRIGGER_MS = 1500/);
    assert.match(acceptBody, /lastAcceptedAtRef\.current < SAME_CODE_RETRIGGER_MS/);
  });

  it('keeps the course scanner always on and re-scans increment quantity', () => {
    // The courses screen no longer gates `enabled` off during resolving,
    // pending card, or notice — the camera stays on (main parity) while the
    // screen simply ignores candidates it does not want.
    const courses = readFileSync(
      new URL('../src/components/dashboard/screens/courses-screen.tsx', import.meta.url),
      'utf8',
    );
    assert.match(courses, /<CoursesScannerPanel\s*\n\s*enabled\s*\n/);
    assert.doesNotMatch(courses, /!resolving && !pending && !notice/);
    // POS behavior: with a pending card open, scanning the SAME product
    // increments its quantity instead of failing or replacing the card.
    assert.match(courses, /pending\.gtin14 === canonical\.gtin14/);
    assert.match(courses, /setPendingQty\(nextQty\)/);
    assert.match(courses, /c\.scannedAdded/);
    // The manual code lookup must not stop the camera either.
    const panel = readFileSync(
      new URL('../src/components/ui/barcode-scanner-panel.tsx', import.meta.url),
      'utf8',
    );
    const submitBody = panel.slice(
      panel.indexOf('const submitManual'),
      panel.indexOf('const cameraErrorText'),
    );
    assert.doesNotMatch(submitBody, /stop\(\)/);
  });

  it('stop really stops: teardown resets the preview state so Start is reachable', () => {
    // The panel header button toggles on `running`; if teardown left the
    // stream marked live, the button stayed on Stop and the camera could
    // never be restarted.
    const tearDownBody = hook.slice(
      hook.indexOf('const tearDown ='),
      hook.indexOf('const stop ='),
    );
    assert.ok(tearDownBody.length > 0, 'tearDown() block not found');
    assert.match(tearDownBody, /setStreamLive\(false\)/);
    assert.match(scanner, /if \(running\) stop\(\);\s*else void start\(\);/);
  });

  it('offers a wrong-result report and keeps qty/price/add on one row', () => {
    const courses = readFileSync(
      new URL('../src/components/dashboard/screens/courses-screen.tsx', import.meta.url),
      'utf8',
    );
    // The pending card exposes the report control wired to the shared
    // submitter, with localized sent/saved-offline confirmations.
    assert.match(courses, /submitProductReport/);
    assert.match(courses, /c\.reportWrong\b/);
    assert.match(courses, /c\.reportSent/);
    assert.match(courses, /c\.reportSavedOffline/);
    // Qty + price + Add share a single non-wrapping row; the price field
    // flexes into the remaining space instead of wrapping to a second line.
    assert.match(courses, /mt-3 flex items-center gap-2">\s*\n\s*<QtyControl/);
    assert.match(courses, /min-w-0 flex-1 bg-surface text-right/);
    assert.doesNotMatch(courses, /mt-3 flex flex-wrap items-center gap-3/);
  });

  it('keeps the Add-Expense scan-product entry and its shared scanner', () => {
    const modal = readFileSync(
      new URL('../src/components/modals/ExpenseModal.tsx', import.meta.url),
      'utf8',
    );
    const expenseScanner = readFileSync(
      new URL('../src/components/modals/expense-barcode-scanner.tsx', import.meta.url),
      'utf8',
    );

    assert.match(modal, /isPro && !initialExpense && \(/);
    assert.match(modal, /m\.barcode\.scanProduct/);
    assert.match(modal, /<ExpenseBarcodeScanner/);
    assert.match(expenseScanner, /<BarcodeScannerPanel/);
    assert.match(expenseScanner, /onProduct\(found\.product\)/);
  });
});

describe('keyboard-wedge collection', () => {
  it('collects every strict GTIN length and leaves checksum validation to the shared parser', () => {
    for (const code of ['96385074', '012345678905', '4006381333931', '10012345678902']) {
      const collector = new KeyboardWedgeCollector();
      const value = enter(collector, code);
      assert.equal(value, code);
      const parsed = parseGtin({ rawValue: value ?? '', format: 'UNKNOWN', source: 'wedge' });
      assert.equal(parsed.ok, true, code);
    }

    const invalid = enter(new KeyboardWedgeCollector(), '4006381333932');
    assert.equal(invalid, '4006381333932');
    assert.deepEqual(
      parseGtin({ rawValue: invalid ?? '', format: 'UNKNOWN', source: 'wedge' }),
      { ok: false, error: 'bad-checksum', normalized: '4006381333932' },
    );
  });

  it('supports localized manual/wedge digits without permitting them at camera boundaries', () => {
    const value = enter(new KeyboardWedgeCollector(), '٤٠٠٦٣٨١٣٣٣٩٣١');
    assert.equal(value, '٤٠٠٦٣٨١٣٣٣٩٣١');
    assert.equal(parseGtin({ rawValue: value ?? '', source: 'wedge' }).ok, true);
    assert.equal(parseGtin({ rawValue: value ?? '', source: 'camera-native' }).ok, false);
  });

  it('resets incomplete, slow, and contaminated sequences instead of splicing them', () => {
    const incomplete = new KeyboardWedgeCollector();
    assert.equal(enter(incomplete, '1234567'), null);
    assert.equal(enter(incomplete, '96385074', 2_000), '96385074');

    const slow = new KeyboardWedgeCollector();
    '4006'.split('').forEach((digit, index) => slow.push(digit, 1_000 + index * 5));
    '381333931'.split('').forEach((digit, index) => slow.push(digit, 1_500 + index * 5));
    assert.equal(slow.push('Enter', 1_550), null, 'the pre-gap prefix must not be retained');

    const noisy = new KeyboardWedgeCollector();
    '400638'.split('').forEach((digit, index) => noisy.push(digit, 3_000 + index * 5));
    noisy.push('x', 3_035);
    '1333931'.split('').forEach((digit, index) => noisy.push(digit, 3_040 + index * 5));
    assert.equal(noisy.push('Enter', 3_080), null, 'printable noise must reset the partial code');
  });
});
