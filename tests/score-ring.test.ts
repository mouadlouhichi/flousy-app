import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  RING_BAND_COLOR,
  scoreFraction,
} from '../src/components/dashboard/courses/courses-score-ring';

describe('score ring — rank accuracy', () => {
  it('maps the engine 0–100 score onto the ring arc linearly', () => {
    assert.equal(scoreFraction(0), 0);
    assert.equal(scoreFraction(100), 1);
    assert.equal(scoreFraction(50), 0.5);
    assert.equal(scoreFraction(85), 0.85);
    assert.equal(scoreFraction(45.5), 0.455);
  });

  it('never draws an arc beyond the track or a negative one', () => {
    assert.equal(scoreFraction(-5), 0);
    assert.equal(scoreFraction(120), 1);
    assert.equal(scoreFraction(Number.NaN), 0);
    assert.equal(scoreFraction(Number.POSITIVE_INFINITY), 0);
  });

  it('defines a ring colour for every band the engine can return', () => {
    // bandFor() in the engine returns exactly these five bands; each must
    // have a colour so the ring can never render uncoloured.
    assert.deepEqual(Object.keys(RING_BAND_COLOR).sort(), [
      'avoid',
      'caution',
      'excellent',
      'good',
      'moderate',
    ]);
    for (const color of Object.values(RING_BAND_COLOR)) {
      assert.match(color, /^#[0-9a-f]{6}$/i);
    }
  });
});
