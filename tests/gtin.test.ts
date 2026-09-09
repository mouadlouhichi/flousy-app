import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateGtinCheckDigit,
  createUnverifiedManualBarcode,
  expandUpce,
  gtinIdentity,
  isAllocatedByGs1Morocco,
  isValidGtin,
  parseGtin,
} from '../src/lib/gtin';

describe('shared strict GTIN boundaries', () => {
  it('implements right-aligned GS1 Mod-10 for every supported GTIN length', () => {
    for (const code of [
      '96385074',          // GTIN-8
      '012345678905',      // GTIN-12 / UPC-A
      '4006381333931',     // GTIN-13
      '10012345678902',    // GTIN-14 / ITF-14 data
    ]) {
      assert.equal(isValidGtin(code), true, code);
      assert.equal(calculateGtinCheckDigit(code.slice(0, -1)), code.at(-1), code);
      const bad = `${code.slice(0, -1)}${(Number(code.at(-1)) + 1) % 10}`;
      assert.equal(isValidGtin(bad), false, bad);
    }
  });

  it('expands UPC-E only when decoder format proves UPC-E semantics', () => {
    assert.equal(expandUpce('04210007'), '042000001007');
    const upce = parseGtin({ rawValue: '04210007', format: 'UPC_E', source: 'camera-native' });
    assert.equal(upce.ok, true);
    if (upce.ok) {
      assert.equal(upce.value.gtin, '042000001007');
      assert.equal(upce.value.lookupCode, '042000001007');
      assert.equal(upce.value.gtin14, '00042000001007');
      assert.equal(upce.value.expandedFromUpce, '04210007');
    }

    const ean8 = parseGtin({ rawValue: '04210007', format: 'EAN_8', source: 'camera-native' });
    assert.equal(ean8.ok, false, 'the same digits are not a valid EAN-8');
  });

  it('enforces format/length agreement and rejects ambiguous Code 128 payloads', () => {
    assert.deepEqual(
      parseGtin({ rawValue: '4006381333931', format: 'EAN_8', source: 'camera-native' }),
      { ok: false, error: 'format-length-mismatch', normalized: '4006381333931' },
    );
    assert.deepEqual(
      parseGtin({ rawValue: '010400638133393117260908', format: 'GS1_128', source: 'camera-native' }),
      { ok: false, error: 'unsupported-symbology', normalized: '010400638133393117260908' },
    );
    assert.equal(
      parseGtin({ rawValue: 'LOT-A4006381333931Z', source: 'manual' }).ok,
      false,
      'arbitrary text must never be stripped into a valid GTIN',
    );
  });

  it('normalizes localized decimal digits only at manual/wedge boundaries', () => {
    const manual = parseGtin({ rawValue: '٤٠٠٦٣٨١٣٣٣٩٣١', source: 'manual' });
    assert.equal(manual.ok, true);
    const decoder = parseGtin({ rawValue: '٤٠٠٦٣٨١٣٣٣٩٣١', source: 'camera-native' });
    assert.deepEqual(decoder, { ok: false, error: 'invalid-character' });
  });

  it('uses zero-filled GTIN-14 for cross-format identity without mutating lookup semantics', () => {
    const upca = parseGtin({ rawValue: '012345678905', format: 'UPC_A', source: 'api' });
    const ean13 = parseGtin({ rawValue: '0012345678905', format: 'EAN_13', source: 'api' });
    const gtin14 = parseGtin({ rawValue: '00012345678905', format: 'ITF_14', source: 'api' });
    assert.ok(upca.ok && ean13.ok && gtin14.ok);
    if (upca.ok && ean13.ok && gtin14.ok) {
      assert.equal(upca.value.lookupCode, '012345678905');
      assert.equal(ean13.value.lookupCode, '0012345678905');
      assert.equal(upca.value.gtin14, ean13.value.gtin14);
      assert.equal(ean13.value.gtin14, gtin14.value.gtin14);
      assert.equal(gtinIdentity(upca.value.gtin), gtinIdentity(gtin14.value.gtin));
    }
  });

  it('keeps manual invalid-code overrides explicitly unverified and outside canonical identity', () => {
    const invalid = parseGtin({ rawValue: '4006381333932', source: 'manual' });
    assert.deepEqual(invalid, { ok: false, error: 'bad-checksum', normalized: '4006381333932' });
    const override = createUnverifiedManualBarcode('4006381333932', 'bad-checksum');
    assert.deepEqual(override, {
      value: '4006381333932',
      source: 'manual',
      verified: false,
      reason: 'bad-checksum',
    });
    assert.equal(gtinIdentity(override?.value ?? ''), null);
  });

  it('describes GS1 Morocco allocation only for complete verified identities', () => {
    assert.equal(isAllocatedByGs1Morocco('6111246721261'), true);
    assert.equal(isAllocatedByGs1Morocco('6110'), false);
    assert.equal(isAllocatedByGs1Morocco('3017620422003'), false);
  });
});
