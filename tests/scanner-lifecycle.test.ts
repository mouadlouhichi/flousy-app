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
