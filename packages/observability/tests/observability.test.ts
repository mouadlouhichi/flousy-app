import assert from 'node:assert/strict';
import { test } from 'node:test';
import { captureException, captureMessage } from '../src/index';

test('captureException does not throw', () => {
  captureException(new Error('boom'), { route: '/api/test' });
});

test('captureMessage does not throw', () => {
  captureMessage('hello');
  assert.equal(typeof captureMessage, 'function');
});
