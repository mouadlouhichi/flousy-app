import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CSV_EXPORT_SECTIONS,
  CSV_EXPORT_TITLE,
  detectCsvDelimiter,
  locateCsvLayout,
  mapCsvHeader,
  parseCsvLine,
  readCsvRow,
  splitCsvRecords,
  type CsvColumn,
  type CsvTarget,
} from '../src/lib/csv-import';
import { exportMonthToCsv } from '../src/lib/export';
import type { MonthBudget, SavingGoal } from '../src/lib/store';

/**
 * What "Export this month" writes must be what "Import CSV" reads.
 *
 * The exporter produces a human report - a title, a preamble, one banner and one
 * header per section - while a bank's export is a flat table. Both files go into
 * the same importer, so the importer has to *locate* the header instead of
 * assuming it is line one, and it has to stop reading at the next section rather
 * than trying to import a savings goal as an expense. These tests walk the two
 * halves of that contract through each other: nothing here mocks the exporter.
 */

const month = {
  totalBudget: 5000,
  bankPart: 3000,
  homePart: 1000,
  walletPart: 1000,
  periodStartDate: '2026-09-01',
  periodEndDate: '2026-09-30',
  activeCategories: ['Groceries', 'Rent'],
  variableExpenses: [
    { id: 'v1', name: 'Coffee, loose', amount: 12.5, type: 'Dining Out', date: '2026-09-02', place: 'wallet', note: 'with "friends"' },
    { id: 'v2', name: 'Taxi', amount: 40, type: 'Transport', date: '2026-09-03', place: 'home' },
  ],
  fixedExpenses: [
    { id: 'f1', name: 'Rent', amount: 900, type: 'Rent', place: 'bank', status: 'paid', paidAmount: 900 },
  ],
} as unknown as MonthBudget;

const goals: SavingGoal[] = [
  { id: 'g1', name: 'Bike', target: 1000, current: 100, source: 'bank', active: true },
];

/** The importer's read path, minus the locale-aware money/date parsing the UI owns. */
function readExportedRows(csv: string, target: CsvTarget) {
  const records = splitCsvRecords(csv, detectCsvDelimiter(csv.split(/\r?\n/)[0] ?? ''));
  const layout = locateCsvLayout(records, target);
  if (!layout) return { layout, columns: [] as CsvColumn[], rows: [] as ReturnType<typeof readCsvRow>[] };
  const columns = mapCsvHeader(parseCsvLine(records[layout.headerIndex], layout.delimiter));
  const rows = layout.dataIndexes.map((index) => readCsvRow(parseCsvLine(records[index], layout.delimiter), columns));
  return { layout, columns, rows };
}

describe('exported CSV imports back into the app', () => {
  const csv = exportMonthToCsv(month, goals, '2026-09', 'MAD');

  it('reads the variable section of its own report', () => {
    const { layout, rows } = readExportedRows(csv, 'variable');
    assert.ok(layout, 'the exported report must be locatable');
    assert.equal(layout.fromExportSection, true);
    assert.deepEqual(rows.map((row) => row.name), ['Coffee, loose', 'Taxi']);
    assert.deepEqual(rows.map((row) => row.amount), ['12.5', '40']);
    assert.deepEqual(rows.map((row) => row.date), ['2026-09-02', '2026-09-03']);
    assert.deepEqual(rows.map((row) => row.category), ['Dining Out', 'Transport']);
    assert.deepEqual(rows.map((row) => row.place), ['wallet', 'home']);
    // Quotes inside a cell survive the quoting round trip instead of splitting it.
    assert.equal(rows[0].note, 'with "friends"');
    assert.equal(rows[1].note, '');
  });

  it('reads the fixed section, and never imports the other one', () => {
    const { layout, rows } = readExportedRows(csv, 'fixed');
    assert.ok(layout);
    assert.deepEqual(rows.map((row) => [row.name, row.amount, row.place]), [['Rent', '900', 'bank']]);
    // A fixed bill carries no date column: the importer keeps the period default
    // rather than inventing one, so an empty cell is what comes back.
    assert.equal(rows[0].date, '');
    assert.equal(rows[0].hasDate, false);
  });

  it('maps the column labels the exporter writes, not only the ones a bank writes', () => {
    const columns = mapCsvHeader(parseCsvLine(`"${CSV_EXPORT_SECTIONS.variable.headers.join('","')}"`, ','));
    assert.deepEqual(columns.map((column) => column.mapping), ['date', 'name', 'category', 'amount', 'place', 'note']);
    assert.deepEqual(
      mapCsvHeader(CSV_EXPORT_SECTIONS.fixed.headers).map((column) => column.mapping),
      ['name', 'category', 'amount', 'place'],
    );
  });

  it('treats a "nothing recorded" line as an empty section, not a bad row', () => {
    const empty = exportMonthToCsv({
      ...month, variableExpenses: [], fixedExpenses: [],
    } as MonthBudget, [], '2026-09', 'MAD');
    const { layout, rows } = readExportedRows(empty, 'variable');
    assert.ok(layout, 'the section is still there');
    assert.equal(layout.fromExportSection, true);
    assert.deepEqual(rows, []);
  });

  it('refuses to read a report it has no section for', () => {
    // A member whose RBAC hides both importable sections still gets a header
    // block; the importer must say "nothing here" instead of importing the title
    // line as if it were a column header.
    const noSections = exportMonthToCsv(month, goals, '2026-09', 'MAD', {
      balances: true, fixedBills: false, expenses: false, savings: true,
    });
    const records = splitCsvRecords(noSections, ',');
    assert.equal(locateCsvLayout(records, 'variable'), null);
    assert.equal(locateCsvLayout(records, 'fixed'), null);
  });

  it('stops at the next section banner', () => {
    // Hand-built so the tail is unambiguous: savings rows must not become
    // expenses just because they sit under the expenses header in the same file.
    const report = [
      `"${CSV_EXPORT_TITLE} - 2026-09"`,
      '',
      `"${CSV_EXPORT_SECTIONS.variable.banner}"`,
      `"${CSV_EXPORT_SECTIONS.variable.headers.join('","')}"`,
      '"2026-09-04","Lunch",15,"Food","bank",""',
      `"${CSV_EXPORT_SECTIONS.fixed.banner}"`,
      `"${CSV_EXPORT_SECTIONS.fixed.headers.join('","')}"`,
      '"Rent","Housing",900,"bank"',
    ].join('\n');
    const { rows } = readExportedRows(report, 'variable');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, 'Lunch');
  });
});

describe('a plain bank CSV still imports the way it always did', () => {
  it('keeps the first record as the header and honours a semicolon file', () => {
    const bank = 'Date;Description;Amount;Category\n2026-09-02;Bread;12,50;Groceries\n2026-09-04;Butter;8.00;Groceries';
    const records = splitCsvRecords(bank, detectCsvDelimiter(bank));
    const layout = locateCsvLayout(records, 'variable');
    assert.ok(layout);
    assert.equal(layout.fromExportSection, false);
    assert.equal(layout.headerIndex, 0);
    assert.equal(layout.delimiter, ';');
    const columns = mapCsvHeader(parseCsvLine(records[0], layout.delimiter));
    const rows = layout.dataIndexes.map((index) => readCsvRow(parseCsvLine(records[index], layout.delimiter), columns));
    assert.deepEqual(rows.map((row) => row.name), ['Bread', 'Butter']);
    assert.deepEqual(rows.map((row) => row.amount), ['12,50', '8.00']);
  });

  it('lets the first non-empty column win when two map to the same field', () => {
    const columns: CsvColumn[] = [
      { label: 'libellé', mapping: 'name' },
      { label: 'note interne', mapping: 'name' },
    ];
    assert.equal(readCsvRow(['From bank', 'ignored'], columns).name, 'From bank');
  });
});
