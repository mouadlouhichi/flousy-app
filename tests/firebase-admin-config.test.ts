import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * parseServiceAccount — FIREBASE_SERVICE_ACCOUNT_JSON decoding.
 *
 * The value is pasted by hand into hosting-platform env UIs, where multiline
 * editing is error-prone: both raw JSON and its base64 encoding must work,
 * and anything malformed must yield "not configured" (null) instead of a
 * partially valid credential set reaching the Admin SDK.
 */
import { parseServiceAccount } from '../src/lib/server/firebase-admin';

const SAMPLE = JSON.stringify({
  type: 'service_account',
  project_id: 'flousy-app',
  private_key_id: 'abc123',
  private_key: '-----BEGIN PRIVATE KEY-----\nMII…\n-----END PRIVATE KEY-----\n',
  client_email: 'firebase-adminsdk@flousy-app.iam.gserviceaccount.com',
});

describe('parseServiceAccount', () => {
  it('returns null when unset or empty', () => {
    assert.equal(parseServiceAccount(undefined), null);
    assert.equal(parseServiceAccount(''), null);
    assert.equal(parseServiceAccount('   '), null);
  });

  it('parses raw single-line JSON', () => {
    const parsed = parseServiceAccount(SAMPLE);
    assert.equal(parsed?.project_id, 'flousy-app');
    assert.equal(parsed?.type, 'service_account');
  });

  it('parses pretty-printed multiline JSON (as downloaded from the console)', () => {
    const pretty = JSON.stringify(JSON.parse(SAMPLE), null, 2);
    const parsed = parseServiceAccount(pretty);
    assert.equal(parsed?.project_id, 'flousy-app');
  });

  it('decodes base64-encoded JSON — the paste-safe format for env UIs', () => {
    const multiline = JSON.stringify(JSON.parse(SAMPLE), null, 2);
    const b64 = Buffer.from(multiline, 'utf8').toString('base64');
    const parsed = parseServiceAccount(b64);
    assert.equal(parsed?.project_id, 'flousy-app');
    assert.match(String(parsed?.private_key), /BEGIN PRIVATE KEY/);
  });

  it('tolerates surrounding whitespace', () => {
    const parsed = parseServiceAccount(`\n  ${SAMPLE}\n`);
    assert.equal(parsed?.project_id, 'flousy-app');
  });

  it('rejects values that are neither JSON nor base64-of-JSON', () => {
    assert.equal(parseServiceAccount('not-json-or-base64!!!'), null);
    assert.equal(parseServiceAccount(Buffer.from('just text', 'utf8').toString('base64')), null);
    assert.equal(parseServiceAccount('[1,2,3]'), null);
    assert.equal(parseServiceAccount('{"project_id":'), null);
  });
});
