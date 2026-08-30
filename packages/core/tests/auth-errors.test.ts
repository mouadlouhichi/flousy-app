import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { authErrorMessage } from '../src/auth-errors';

describe('authErrorMessage', () => {
  it('explains an unauthorized preview domain', () => {
    assert.match(
      authErrorMessage({ code: 'auth/unauthorized-domain', message: 'Firebase: Error (auth/unauthorized-domain).' }),
      /Authorized domains/,
    );
  });

  it('hides raw invalid-credential noise', () => {
    assert.equal(
      authErrorMessage({ code: 'auth/invalid-credential', message: 'Firebase: Error (auth/invalid-credential).' }),
      'Email or password is incorrect.',
    );
  });
});
