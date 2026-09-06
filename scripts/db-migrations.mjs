#!/usr/bin/env node
/**
 * Firestore document migration for this project: completes documents that predate a
 * field, instead of leaving their owners with a refused write.
 *
 * Why a script at all: `src/lib/schema-migrations.ts` describes the same fields and
 * the app applies the part it may write itself, but a client cannot settle the
 * fields that need facts it does not have, cannot touch another member's row, and
 * cannot write against rules older than its build. This runs with project-level
 * access, so it fixes all of that in one pass.
 *
 *   npm run db:migrate -- --project <firestore-project-id> --dry-run
 *   npm run db:migrate -- --project <id> --apply
 *   npm run db:migrate -- --project <id> --collection households --limit 20 --verbose
 *
 * Authentication uses an OAuth access token with Firestore write scope, in this
 * order: `--token`, `$FIRESTORE_ACCESS_TOKEN`, then `gcloud auth print-access-token`.
 * `--apply` refuses to run without a token; `--dry-run` never writes.
 *
 * Values written here must match the model in `src/lib/schema-migrations.ts`, and
 * `tests/schema-migrations.test.ts` compares the two files so they cannot drift.
 */
import { execFileSync } from 'node:child_process';
import process from 'node:process';

const API = 'https://firestore.googleapis.com/v1';
const DATABASE = '(default)';
export const DEFAULT_MONEY_PLACES = [
  { id: 'bank', name: 'Bank', icon: 'account_balance' },
  { id: 'home', name: 'Home Cash', icon: 'home' },
  { id: 'wallet', name: 'Wallet', icon: 'account_balance_wallet' },
];
export const DEFAULT_CATEGORIES = [
  'Groceries', 'Transport', 'Rent', 'Entertainment', 'Health',
  'Utilities', 'Dining Out', 'Shopping', 'Subscriptions',
];
export const DEFAULT_AVATAR_COLOR = '#00685f';

/**
 * The migration model. `repair` returns the value to write, or `null` when the
 * document does not contain what is needed to derive it: those fields are reported
 * and never guessed, because a wrong `ownerId` hands a household to a stranger.
 */
export const MODEL = {
  households: {
    parent: null,
    collectionId: 'households',
    fields: [
      { field: 'currency', repair: (d) => (blank(d, 'currency') ? 'MAD' : null) },
      { field: 'moneyPlaces', repair: (d) => (blank(d, 'moneyPlaces') ? DEFAULT_MONEY_PLACES : null) },
      { field: 'activeCategories', repair: (d) => (blank(d, 'activeCategories') ? DEFAULT_CATEGORIES : null) },
      { field: 'name', repair: (d) => (blank(d, 'name') ? 'Household' : null) },
      { field: 'planOwnerId', repair: (d) => (blank(d, 'planOwnerId') && !blank(d, 'ownerId') ? String(d.ownerId) : null) },
      {
        field: 'entitlementOwnerId',
        repair: (d) => (!blank(d, 'entitlementOwnerId')
          ? null
          : !blank(d, 'planOwnerId') ? String(d.planOwnerId) : !blank(d, 'ownerId') ? String(d.ownerId) : null),
      },
      { field: 'ownerId', repair: () => null },
      { field: 'createdAt', repair: () => null },
    ],
  },
  householdMembers: {
    parent: 'households/{householdId}',
    collectionId: 'members',
    fields: [
      { field: 'userId', repair: (d, id) => (blank(d, 'userId') ? id : null) },
      {
        field: 'displayName',
        repair: (d) => (!blank(d, 'displayName')
          ? null
          : typeof d.email === 'string' && d.email.includes('@') ? d.email.split('@')[0] : null),
      },
      { field: 'avatarColor', repair: (d) => (blank(d, 'avatarColor') ? DEFAULT_AVATAR_COLOR : null) },
    ],
  },
  householdInvites: {
    parent: null,
    collectionId: 'householdInvites',
    fields: [
      {
        field: 'expiresAtMs',
        repair: (d) => {
          if (!blank(d, 'expiresAtMs')) return null;
          const parsed = typeof d.expiresAt === 'string' ? Date.parse(d.expiresAt) : NaN;
          return Number.isFinite(parsed) ? parsed : null;
        },
      },
    ],
  },
};

export function blank(document, field) {
  if (!Object.prototype.hasOwnProperty.call(document, field)) return true;
  const value = document[field];
  if (value === undefined || value === null) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

function parseArgs(argv) {
  const options = {
    apply: false, dryRun: true, check: false, verbose: false, json: false,
    limit: 0, collection: 'all', pageSize: 100, project: '', token: '',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const [flag, inline] = argument.includes('=') ? [argument.slice(0, argument.indexOf('=')), argument.slice(argument.indexOf('=') + 1)] : [argument, ''];
    const value = (name) => {
      const taken = inline || argv[index + 1] || '';
      if (!inline) index += 1;
      if (!taken || taken.startsWith('--')) throw new Error(`${name} needs a value.`);
      return taken;
    };
    switch (flag) {
      case '--apply': options.apply = true; options.dryRun = false; break;
      case '--dry-run': options.dryRun = true; break;
      case '--check': options.check = true; options.dryRun = true; break;
      case '--verbose': case '--v': options.verbose = true; break;
      case '--json': options.json = true; break;
      case '--project': options.project = value('--project'); break;
      case '--token': options.token = value('--token'); break;
      case '--collection': options.collection = value('--collection'); break;
      case '--limit': options.limit = Math.max(0, Number(value('--limit')) || 0); break;
      case '--help': case '-h': options.help = true; break;
      default: throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

function resolveToken(options) {
  if (options.token) return options.token;
  if (process.env.FIRESTORE_ACCESS_TOKEN) return process.env.FIRESTORE_ACCESS_TOKEN;
  try {
    return execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' }).trim();
  } catch {
    throw new Error(
      '--apply needs an OAuth access token with Firestore write scope.\n'
      + 'Pass --token <token> or set FIRESTORE_ACCESS_TOKEN, or sign in with gcloud\n'
      + '(gcloud auth application-default login) so the script can mint one.',
    );
  }
}

async function request(path, token, body) {
  const response = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${path}\n${text.slice(0, 600)}`);
  return text ? JSON.parse(text) : {};
}

export function decodeValue(value) {
  if (value === null || typeof value !== 'object') return value;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in value) return decodeFields(value.mapValue.fields || {});
  if ('timestampValue' in value) return value.timestampValue;
  return undefined;
}

export function encodeValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (typeof value === 'object') return { mapValue: { fields: encodeFields(value) } };
  throw new Error(`Cannot store a ${typeof value} in Firestore.`);
}

const decodeFields = (fields) => Object.fromEntries(Object.entries(fields || {}).map(([key, value]) => [key, decodeValue(value)]));
const encodeFields = (data) => Object.fromEntries(Object.entries(data).map(([key, value]) => [key, encodeValue(value)]));

async function* listDocuments(project, token, parentPath, collectionId, pageSize) {
  let pageToken = '';
  do {
    const body = {
      structuredQuery: { from: [{ collectionId }], limit: pageSize },
      pageSize,
      ...(pageToken ? { pageToken } : {}),
    };
    const scoped = parentPath ? `${parentPath}:runQuery` : ':runQuery';
    const response = await request(
      `/projects/${project}/databases/${DATABASE}/documents${scoped}`,
      token,
      body,
    );
    const rows = Array.isArray(response) ? response : [response];
    for (const row of rows) {
      const document = row?.document;
      if (document) yield document;
    }
    pageToken = response.nextPageToken || '';
  } while (pageToken);
}

export function planFor(modelKey, document) {
  const model = MODEL[modelKey];
  const id = String(document.name || '').split('/').pop() || '';
  // The id is not stored data on every legacy row, and `userId` is derived from it.
  const data = { id, ...decodeFields(document.fields) };
  const patch = {};
  const unresolved = [];
  for (const field of model.fields) {
    if (!blank(data, field.field)) continue;
    const value = field.repair(data, id);
    if (value === null || value === undefined) unresolved.push(field.field);
    else patch[field.field] = value;
  }
  return { id, patch, unresolved };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || !options.project) {
    process.stdout.write([
      'Usage: npm run db:migrate -- --project <id> [--dry-run|--apply|--check] [--collection all|households|householdMembers|householdInvites]',
      '       [--limit N] [--verbose] [--json] [--token <oauth-access-token>]',
      '',
      'Completes household documents whose stored shape predates a field the app and the',
      'rules both require, plus the member rows and invitations a client may not rewrite.',
      'Nothing is guessed: a field that cannot be derived from its own document is reported.',
      '',
    ].join('\n'));
    process.exit(options.help ? 0 : 2);
  }
  const token = options.apply ? resolveToken(options) : (options.token || process.env.FIRESTORE_ACCESS_TOKEN || '');
  const collections = options.collection === 'all' ? Object.keys(MODEL) : [options.collection];
  if (!collections.every((name) => name in MODEL)) throw new Error(`Unknown collection: ${options.collection}`);

  const report = { scanned: 0, patched: 0, written: 0, reported: 0, documents: [] };
  const queue = [];
  for (const name of collections) queue.push({ modelKey: name, parent: '' });

  while (queue.length > 0 && (!options.limit || report.scanned < options.limit)) {
    const job = queue.shift();
    const parentPath = job.parent ? `/documents/${job.parent}` : '';
    const collectionId = MODEL[job.modelKey].collectionId;
    for await (const document of listDocuments(options.project, token || 'unused', parentPath, collectionId, options.pageSize)) {
      report.scanned += 1;
      const { id, patch, unresolved } = planFor(job.modelKey, document);
      const name = String(document.name);
      if (Object.keys(patch).length > 0) {
        report.patched += 1;
        report.documents.push({ name, adds: Object.keys(patch), unresolved, ...(options.verbose ? { values: patch } : {}) });
        if (options.apply) {
          const writes = [{
            currentDocument: { exists: true },
            update: { name, fields: encodeFields(patch) },
            updateMask: { fieldPaths: Object.keys(patch) },
          }];
          await request(`/projects/${options.project}/databases/${DATABASE}/documents:commit`, token, { writes });
          report.written += 1;
        }
      } else if (unresolved.length > 0) {
        report.reported += 1;
        report.documents.push({ name, adds: [], unresolved });
      }
      // Member rows live under each household, so they are queued once the parent
      // document is seen rather than scanned blindly across the whole project.
      if (job.modelKey === 'households' && collections.includes('householdMembers')) {
        queue.push({ modelKey: 'householdMembers', parent: name.replace(/^projects\/[^/]+\/databases\/[^/]+\//, '') });
      }
      if (options.limit && report.scanned >= options.limit) break;
    }
  }

  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    for (const entry of report.documents) {
      const relative = entry.name.split('/documents/')[1] || entry.name;
      const adds = entry.adds.length > 0 ? `${options.apply ? 'wrote' : 'would write'} ${entry.adds.join(', ')}` : 'nothing to derive';
      const gaps = entry.unresolved.length > 0 ? `; needs a decision: ${entry.unresolved.join(', ')}` : '';
      process.stdout.write(`${relative}: ${adds}${gaps}\n`);
    }
    process.stdout.write([
      '',
      `Documents scanned: ${report.scanned}`,
      `Fields completed:  ${report.patched}${options.apply ? ` (written: ${report.written})` : ' (dry run)'}`,
      `Only a decision:   ${report.reported}`,
      options.dryRun ? 'Re-run with --apply to write these documents.' : '',
    ].filter(Boolean).join('\n') + '\n');
  }
  if (options.check && (report.patched > 0 || report.reported > 0)) process.exit(1);
}

// Importing this module (the test suite does, to compare the two models) must not
// reach the network or exit the process.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop() || '')) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
