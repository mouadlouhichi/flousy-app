import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

/**
 * firebase-blueprint.json is the machine-readable description of the Firestore
 * data model. Nothing at runtime reads it, so without a test it silently rots.
 *
 * These tests pin it to the three things it claims to describe:
 *   1. the TypeScript interfaces in src/lib/store.ts  (document shape)
 *   2. the document paths used in src/lib/db.ts       (where they live)
 *   3. the constraints in firestore.rules             (what the server allows)
 */

const repoRoot = new URL('../', import.meta.url);
const readRepoFile = (relativePath: string) => readFileSync(new URL(relativePath, repoRoot), 'utf8');

const blueprint = JSON.parse(readRepoFile('firebase-blueprint.json'));
const storeSource = readRepoFile('src/lib/store.ts');
const dbSource = readRepoFile('src/lib/db.ts');
const rulesSource = readRepoFile('firestore.rules');

// --- Parse src/lib/store.ts -------------------------------------------------

interface ParsedField {
  name: string;
  optional: boolean;
  /** Literal members when the type is a string union (inline or via alias). */
  enumValues: string[] | null;
  /** Element type name when the type is `T[]`, else null. */
  arrayElement: string | null;
}

const sourceFile = ts.createSourceFile('store.ts', storeSource, ts.ScriptTarget.Latest, true);

/** `type BuiltinMoneyPlace = 'bank' | 'home' | 'wallet'` -> ['bank', 'home', 'wallet'] */
const stringUnionAliases = new Map<string, string[]>();
/** Interface name -> declared fields. */
const interfaces = new Map<string, ParsedField[]>();

function literalUnionMembers(type: ts.TypeNode): string[] | null {
  if (ts.isUnionTypeNode(type)) {
    const members = type.types.map((member) =>
      ts.isLiteralTypeNode(member) && ts.isStringLiteral(member.literal) ? member.literal.text : null,
    );
    return members.every((member): member is string => member !== null) ? members : null;
  }
  if (ts.isLiteralTypeNode(type) && ts.isStringLiteral(type.literal)) {
    return [type.literal.text];
  }
  return null;
}

for (const statement of sourceFile.statements) {
  if (!ts.isTypeAliasDeclaration(statement)) continue;
  const members = literalUnionMembers(statement.type);
  if (members) stringUnionAliases.set(statement.name.text, members);
}

for (const statement of sourceFile.statements) {
  if (!ts.isInterfaceDeclaration(statement)) continue;

  const fields: ParsedField[] = [];
  for (const member of statement.members) {
    if (!ts.isPropertySignature(member) || !member.type || !ts.isIdentifier(member.name)) continue;

    const type = member.type;
    let enumValues = literalUnionMembers(type);
    if (!enumValues && ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName)) {
      enumValues = stringUnionAliases.get(type.typeName.text) ?? null;
    }

    let arrayElement: string | null = null;
    if (ts.isArrayTypeNode(type)) {
      const element = type.elementType;
      if (ts.isTypeReferenceNode(element) && ts.isIdentifier(element.typeName)) {
        arrayElement = element.typeName.text;
      } else {
        arrayElement = element.getText(sourceFile);
      }
    }

    fields.push({
      name: member.name.text,
      optional: member.questionToken !== undefined,
      enumValues,
      arrayElement,
    });
  }
  interfaces.set(statement.name.text, fields);
}

// --- Blueprint helpers ------------------------------------------------------

/** Blueprint schemas keyed by the store.ts interface they mirror. */
const SCHEMA_TO_INTERFACE: Record<string, string> = {
  'entities.UserProfile': 'UserProfile',
  'entities.MonthBudget': 'MonthBudget',
  'definitions.IncomeSource': 'IncomeSource',
  'definitions.VariableExpense': 'VariableExpense',
  'definitions.FixedExpense': 'FixedExpense',
  'definitions.FixedCategoryItem': 'FixedCategoryItem',
  'definitions.SavingGoal': 'SavingGoal',
  'definitions.DebtItem': 'DebtItem',
  'definitions.MoneyPlaceConfig': 'MoneyPlaceConfig',
  'definitions.SessionItem': 'SessionItem',
  'entities.Product': 'Product',
  'entities.CourseSession': 'CourseSession',
};

const schemaAt = (pointer: string) =>
  pointer.split('.').reduce<any>((node, key) => node?.[key], blueprint);

const sorted = (values: readonly string[]) => [...values].sort();

// --- Tests ------------------------------------------------------------------

describe('firebase-blueprint.json stays in sync with the code', () => {
  it('sanity-checks that store.ts actually parsed', () => {
    assert.ok(interfaces.size >= 7, 'expected to parse the store.ts interfaces');
    assert.deepStrictEqual(stringUnionAliases.get('BuiltinMoneyPlace'), ['bank', 'home', 'wallet']);
    for (const interfaceName of Object.values(SCHEMA_TO_INTERFACE)) {
      assert.ok(interfaces.has(interfaceName), `store.ts should declare ${interfaceName}`);
    }
  });

  it('declares exactly the fields that store.ts declares', () => {
    for (const [pointer, interfaceName] of Object.entries(SCHEMA_TO_INTERFACE)) {
      const schema = schemaAt(pointer);
      assert.ok(schema, `blueprint should define ${pointer}`);

      const blueprintFields = sorted(Object.keys(schema.properties ?? {}));
      const codeFields = sorted(interfaces.get(interfaceName)!.map((field) => field.name));

      assert.deepStrictEqual(
        blueprintFields,
        codeFields,
        `${pointer} fields drifted from the ${interfaceName} interface in src/lib/store.ts`,
      );
    }
  });

  it('marks a field required exactly when store.ts declares it non-optional', () => {
    for (const [pointer, interfaceName] of Object.entries(SCHEMA_TO_INTERFACE)) {
      const schema = schemaAt(pointer);
      const blueprintRequired = sorted(schema.required ?? []);
      const codeRequired = sorted(
        interfaces.get(interfaceName)!.filter((field) => !field.optional).map((field) => field.name),
      );

      assert.deepStrictEqual(
        blueprintRequired,
        codeRequired,
        `${pointer}.required drifted from the non-optional fields of ${interfaceName}`,
      );
    }
  });

  it('mirrors every string-literal union as a JSON Schema enum', () => {
    for (const [pointer, interfaceName] of Object.entries(SCHEMA_TO_INTERFACE)) {
      const schema = schemaAt(pointer);
      for (const field of interfaces.get(interfaceName)!) {
        if (!field.enumValues) continue;
        const property = schema.properties[field.name];
        assert.deepStrictEqual(
          sorted(property.enum ?? []),
          sorted(field.enumValues),
          `${pointer}.${field.name} enum drifted from ${interfaceName}.${field.name}`,
        );
        assert.strictEqual(property.type, 'string', `${pointer}.${field.name} should be a string enum`);
      }
    }
  });

  it('types every array field as an array and points $ref at the right entity', () => {
    for (const [pointer, interfaceName] of Object.entries(SCHEMA_TO_INTERFACE)) {
      const schema = schemaAt(pointer);
      for (const field of interfaces.get(interfaceName)!) {
        const property = schema.properties[field.name];

        if (!field.arrayElement) {
          assert.notStrictEqual(
            property.type,
            'array',
            `${pointer}.${field.name} is typed as an array but ${interfaceName}.${field.name} is not`,
          );
          continue;
        }

        assert.strictEqual(
          property.type,
          'array',
          `${pointer}.${field.name} should be an array to match ${interfaceName}.${field.name}`,
        );

        if (interfaces.has(field.arrayElement)) {
          assert.strictEqual(
            property.items?.$ref,
            `#/definitions/${field.arrayElement}`,
            `${pointer}.${field.name} should reference #/definitions/${field.arrayElement}`,
          );
        } else {
          assert.strictEqual(
            property.items?.type,
            field.arrayElement,
            `${pointer}.${field.name} items should be typed ${field.arrayElement}`,
          );
        }
      }
    }
  });

  it('resolves every $ref to a declared definition', () => {
    const refs: string[] = [];
    const collect = (node: unknown) => {
      if (Array.isArray(node)) return node.forEach(collect);
      if (!node || typeof node !== 'object') return;
      for (const [key, value] of Object.entries(node)) {
        if (key === '$ref' && typeof value === 'string') refs.push(value);
        else collect(value);
      }
    };
    collect(blueprint);

    assert.ok(refs.length > 0, 'expected the blueprint to use $ref');
    for (const ref of refs) {
      const name = ref.replace('#/definitions/', '');
      assert.ok(blueprint.definitions[name], `unresolved $ref: ${ref}`);
    }
  });

  it('describes the revisioned SavingsData wrapper written by finance commits', () => {
    const savingsData = blueprint.entities.SavingsData;
    assert.deepStrictEqual(
      sorted(Object.keys(savingsData.properties)),
      sorted(['goals', 'revision', 'lastMutationId', 'updatedAt', 'updatedByUserId']),
    );
    assert.deepStrictEqual(savingsData.required, ['goals']);
    assert.strictEqual(savingsData.properties.goals.items.$ref, '#/definitions/SavingGoal');
    assert.match(dbSource, /goals:\s*nextGoals[\s\S]*revision:\s*goalsRevision \+ 1/);
  });
});

describe('firebase-blueprint.json stays in sync with Firestore paths and rules', () => {
  it('lists a path for every document written by src/lib/db.ts', () => {
    const documentPaths = new Set<string>();
    // doc(db, 'users', uid, 'months', monthKey) -> /users/{uid}/months/{monthKey}
    const docCallPattern = /doc\(\s*db\s*,\s*([^)]+)\)/g;
    for (const [, rawArgs] of dbSource.matchAll(docCallPattern)) {
      const segments = rawArgs.split(',').map((segment) => segment.trim());
      const literalSegments = segments.map((segment) => segment.match(/^'([^']+)'$/)?.[1] ?? null);
      const path = segments
        .map((segment, index) => {
          const literal = literalSegments[index];
          if (literal) return literal;
          // Variable names differ by call site (`id`, `target.householdId`,
          // `mutation.workspaceId`), while the Firestore document shape does
          // not. Canonicalize by the collection segment.
          const collectionName = literalSegments[index - 1];
          const canonical: Record<string, string> = {
            users: 'uid', households: 'householdId', householdInvites: 'inviteId',
            months: 'monthKey', ledger: 'mutationId', products: 'barcode',
            sessions: 'sessionId', members: 'memberId', invoices: 'invoiceId',
          };
          return `{${canonical[collectionName || ''] || segment}}`;
        })
        .join('/');
      documentPaths.add(`/${path}`);
    }

    assert.deepStrictEqual(
      sorted([...documentPaths]),
      sorted(Object.keys(blueprint.firestore)),
      'the paths in src/lib/db.ts drifted from the blueprint firestore map',
    );
  });

  it('points every path at an entity that exists', () => {
    for (const [path, node] of Object.entries<any>(blueprint.firestore)) {
      assert.ok(blueprint.entities[node.schema], `${path} references unknown entity ${node.schema}`);
    }
  });

  it('reuses the month id pattern enforced by firestore.rules', () => {
    const rulePattern = rulesSource.match(/id\.matches\('([^']+)'\)/)?.[1];
    assert.ok(rulePattern, 'firestore.rules should validate the month id');
    assert.strictEqual(blueprint.firestore['/users/{uid}/months/{monthKey}'].idPattern, rulePattern);
  });

  it('reuses the array caps enforced by firestore.rules', () => {
    const capFor = (field: string) =>
      // Either spelling of the post-write document: the caps are the contract, the
      // local name the rule binds it to is not.
      Number(rulesSource.match(new RegExp(`(?:incoming\\(\\)|after)\\.${field}\\.size\\(\\) <= (\\d+)`))?.[1]);

    const monthProperties = blueprint.entities.MonthBudget.properties;
    assert.strictEqual(monthProperties.variableExpenses.maxItems, capFor('variableExpenses'));
    assert.strictEqual(monthProperties.fixedExpenses.maxItems, capFor('fixedExpenses'));
    assert.strictEqual(blueprint.entities.SavingsData.properties.goals.maxItems, capFor('goals'));
  });

  it('reuses the money bounds enforced by firestore.rules', () => {
    const bounds = rulesSource.match(/function isMoney\([^)]*\) \{[^}]*>= (\d+) &&[^}]*<= (\d+)/);
    assert.ok(bounds, 'firestore.rules should bound money values');
    const [, min, max] = bounds;

    for (const field of ['totalBudget', 'bankPart', 'homePart', 'walletPart'] as const) {
      const property = blueprint.entities.MonthBudget.properties[field];
      assert.strictEqual(property.minimum, Number(min), `${field}.minimum should match isMoney()`);
      assert.strictEqual(property.maximum, Number(max), `${field}.maximum should match isMoney()`);
    }
  });

  it('keeps the launch trial finite and future billing server-authoritative', () => {
    // New profiles always start free. The sole browser-side elevation is a
    // server-time-bounded launch trial whose end is exactly 90 days later.
    assert.match(rulesSource, /incoming\(\)\.plan == 'free'/);
    // The prior plan is read *totally*: a profile created and claimed in one `set()`
    // has no existing document, and a property read there aborts the whole rule.
    assert.match(rulesSource, /existing\(\)\.get\('plan', 'free'\) == 'free'/);
    assert.match(rulesSource, /incoming\(\)(?:\.entitlementSource|\.get\('entitlementSource', ''\)) == 'launch_trial'/);
    assert.match(rulesSource, /incoming\(\)(?:\.entitlementEndsAtMs|\.get\('entitlementEndsAtMs', 0\))\s*\n\s*== incoming\(\)(?:\.entitlementStartedAtMs|\.get\('entitlementStartedAtMs', -1\)) \+ 7776000000/);
    assert.match(rulesSource, /!entitlementFieldsChanged\(\) \|\| validLaunchTrialClaim\(\)/);

    const dbSource = readRepoFile('src/lib/db.ts');
    assert.match(dbSource, /export async function claimProTrial/);
    assert.match(dbSource, /entitlementSource: 'launch_trial'/);
    assert.match(dbSource, /entitlementEndsAtMs: startedAtMs \+ PRO_TRIAL_DURATION_MS/);

    // Production UI contains no PAN/CVC form, simulated charge, or purchase event.
    const upgradeModal = readRepoFile('src/components/modals/ProUpgradeModal.tsx');
    assert.doesNotMatch(upgradeModal, /pro-card-number|cardCvc|processPayment|createCheckoutSession/);
    assert.doesNotMatch(upgradeModal, /trackEvent\(\s*'purchase'/);
    assert.match(upgradeModal, /claimProTrial/);

    assert.match(
      blueprint.entities.UserProfile.properties.plan.description,
      /90 days/i,
    );
    assert.match(
      blueprint.entities.UserProfile.properties.plan.description,
      /Admin SDK/i,
    );
  });
});
