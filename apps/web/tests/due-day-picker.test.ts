import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseDueDay } from '../src/components/ui/day-picker';

describe('parseDueDay', () => {
  it('recognizes stored ordinal due days so their preset badge can remain selected', () => {
    assert.equal(parseDueDay('1st'), 1);
    assert.equal(parseDueDay('15th'), 15);
    assert.equal(parseDueDay('30th'), 30);
  });

  it('accepts a leading ordinal in a custom description but rejects invalid days', () => {
    assert.equal(parseDueDay('20th of every month'), 20);
    assert.equal(parseDueDay('31st'), 31);
    assert.equal(parseDueDay('last Friday'), null);
    assert.equal(parseDueDay('0th'), null);
    assert.equal(parseDueDay('32nd'), null);
    assert.equal(parseDueDay('15something'), null);
  });
});
