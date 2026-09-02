import fs from 'node:fs';
import ts from 'typescript';

const blueprint = JSON.parse(fs.readFileSync('firebase-blueprint.json', 'utf8'));
const sourceText = fs.readFileSync('src/lib/store.ts', 'utf8');
const source = ts.createSourceFile('store.ts', sourceText, ts.ScriptTarget.Latest, true);
const aliases = new Map();
const interfaces = new Map();

function stringUnion(node) {
  if (!ts.isUnionTypeNode(node)) return null;
  const values = node.types.map((type) => ts.isLiteralTypeNode(type) && ts.isStringLiteral(type.literal) ? type.literal.text : null);
  return values.every((value) => value !== null) ? values : null;
}
for (const statement of source.statements) {
  if (ts.isTypeAliasDeclaration(statement)) {
    const values = stringUnion(statement.type);
    if (values) aliases.set(statement.name.text, values);
  }
  if (ts.isInterfaceDeclaration(statement)) interfaces.set(statement.name.text, statement);
}

function schemaForType(type) {
  const literal = stringUnion(type);
  if (literal) return { type: 'string', enum: literal };
  if (ts.isArrayTypeNode(type)) {
    return { type: 'array', items: schemaForType(type.elementType) };
  }
  if (ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName)) {
    const name = type.typeName.text;
    if (aliases.has(name)) return { type: 'string', enum: aliases.get(name) };
    if (interfaces.has(name)) return { $ref: `#/definitions/${name}` };
    if (name === 'Record') return { type: 'object' };
  }
  if (type.kind === ts.SyntaxKind.StringKeyword) return { type: 'string' };
  if (type.kind === ts.SyntaxKind.NumberKeyword) return { type: 'number' };
  if (type.kind === ts.SyntaxKind.BooleanKeyword) return { type: 'boolean' };
  if (ts.isTypeLiteralNode(type)) return { type: 'object' };
  if (ts.isUnionTypeNode(type)) {
    const nonNull = type.types.find((item) => item.kind !== ts.SyntaxKind.NullKeyword && item.kind !== ts.SyntaxKind.UndefinedKeyword);
    return nonNull ? schemaForType(nonNull) : {};
  }
  return {};
}

function syncSchema(schema, interfaceName) {
  const declaration = interfaces.get(interfaceName);
  const old = schema.properties || {};
  const properties = {};
  const required = [];
  for (const member of declaration.members) {
    if (!ts.isPropertySignature(member) || !member.type || !ts.isIdentifier(member.name)) continue;
    const name = member.name.text;
    properties[name] = { ...schemaForType(member.type), ...(old[name] || {}) };
    // Structural type must win over stale metadata.
    properties[name] = { ...(old[name] || {}), ...schemaForType(member.type) };
    if (!member.questionToken) required.push(name);
  }
  schema.properties = properties;
  schema.required = required;
}

const mapping = {
  UserProfile: blueprint.entities.UserProfile,
  MonthBudget: blueprint.entities.MonthBudget,
  IncomeSource: blueprint.definitions.IncomeSource,
  VariableExpense: blueprint.definitions.VariableExpense,
  FixedExpense: blueprint.definitions.FixedExpense,
  FixedCategoryItem: blueprint.definitions.FixedCategoryItem,
  SavingGoal: blueprint.definitions.SavingGoal,
  DebtItem: blueprint.definitions.DebtItem,
  MoneyPlaceConfig: blueprint.definitions.MoneyPlaceConfig,
  SessionItem: blueprint.definitions.SessionItem,
  Product: blueprint.entities.Product,
  CourseSession: blueprint.entities.CourseSession,
};
for (const [name, schema] of Object.entries(mapping)) syncSchema(schema, name);
for (const name of ['DebtPayment', 'AccountTransfer', 'BalanceAdjustment']) {
  blueprint.definitions[name] ||= { title: name, type: 'object', properties: {} };
  syncSchema(blueprint.definitions[name], name);
}
for (const field of ['totalBudget', 'bankPart', 'homePart', 'walletPart']) {
  blueprint.entities.MonthBudget.properties[field].minimum = 0;
  blueprint.entities.MonthBudget.properties[field].maximum = 1_000_000_000;
}
fs.writeFileSync('firebase-blueprint.json', `${JSON.stringify(blueprint, null, 2)}\n`);
