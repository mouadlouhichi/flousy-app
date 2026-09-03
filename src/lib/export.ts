import { MonthBudget, SavingGoal, totalCashOnHand } from './store';
import { ALL_EXPORT_SECTIONS, type ExportSections } from './household-rbac';
import { CSV_EXPORT_SECTIONS, CSV_EXPORT_TITLE, type CsvTarget } from './csv-import';

function escapeCsvCell(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '""';
  let str = String(val);

  // Prevent CSV Injection (Formula Injection)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escape quotes
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

/** Quotes a row of fixed text so a comma inside a label cannot split it. */
function quoteRow(cells: readonly string[]): string {
  return cells.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',');
}

/** A section heading of the report, as `locateCsvLayout()` looks for it. */
function sectionBanner(target: CsvTarget): string {
  return `"${CSV_EXPORT_SECTIONS[target].banner}"`;
}

function sectionHeader(target: CsvTarget): string {
  return quoteRow(CSV_EXPORT_SECTIONS[target].headers);
}

function sectionEmptyRow(target: CsvTarget): string {
  return quoteRow([CSV_EXPORT_SECTIONS[target].emptyRow]);
}

/**
 * Builds the monthly CSV.
 *
 * The report is also the app's own CSV import format: `csv-import.ts` owns the
 * banner labels, the column labels and the "nothing here" row, and the importer
 * selects a section by them. Writing those strings here as literals would let a
 * renamed heading silently break `Import CSV` - the file would still open in a
 * spreadsheet, and still refuse to import.
 *
 * `sections` comes from the household RBAC matrix (`exportSectionsFor`): a
 * member who may not *see* balances or income on screen must not be able to
 * read them in a download either, so an unauthorised section is omitted
 * entirely rather than zeroed or redacted.
 */
export function exportMonthToCsv(
  month: MonthBudget,
  goals: SavingGoal[],
  monthKey: string,
  currency: string = 'MAD',
  sections: ExportSections = ALL_EXPORT_SECTIONS,
): string {
  const lines: string[] = [];

  lines.push(`"${CSV_EXPORT_TITLE} - ${monthKey}"`);
  lines.push(`"Export Date",${escapeCsvCell(new Date().toISOString())}`);
  lines.push(`"Currency",${escapeCsvCell(currency)}`);
  lines.push('');

  // Balances — owned by the `balances` area.
  if (sections.balances) {
    lines.push('"MONEY PLACES BALANCES"');
    lines.push('"Bank","Home Cash","Wallet","Total Cash"');
    lines.push(
      [
        escapeCsvCell(month.bankPart || 0),
        escapeCsvCell(month.homePart || 0),
        escapeCsvCell(month.walletPart || 0),
        // Same total the Overview shows, custom money places included.
        escapeCsvCell(totalCashOnHand(month)),
      ].join(',')
    );
    lines.push('');
  }

  // Fixed Monthly Charges — owned by the `fixedBills` area.
  if (sections.fixedBills) {
    lines.push(sectionBanner('fixed'));
    lines.push(sectionHeader('fixed'));
    if (month.fixedExpenses && month.fixedExpenses.length > 0) {
      month.fixedExpenses.forEach((fe) => {
        lines.push([escapeCsvCell(fe.name), escapeCsvCell(fe.type), escapeCsvCell(fe.amount), escapeCsvCell(fe.place)].join(','));
      });
    } else {
      lines.push(sectionEmptyRow('fixed'));
    }
    lines.push('');
  }

  // Variable Expenses — owned by the `expenses` area.
  if (sections.expenses) {
    lines.push(sectionBanner('variable'));
    lines.push(sectionHeader('variable'));
    if (month.variableExpenses && month.variableExpenses.length > 0) {
      month.variableExpenses.forEach((ve) => {
        lines.push(
          [
            escapeCsvCell(ve.date),
            escapeCsvCell(ve.name),
            escapeCsvCell(ve.type),
            escapeCsvCell(ve.amount),
            escapeCsvCell(ve.place),
            escapeCsvCell(ve.note || ''),
          ].join(',')
        );
      });
    } else {
      lines.push(sectionEmptyRow('variable'));
    }
    lines.push('');
  }

  // Savings Goals — owned by the `savings` area.
  if (sections.savings) {
    lines.push('"SAVINGS GOALS"');
    lines.push('"Goal Name","Current Amount","Target Amount","Source Place"');
    if (goals && goals.length > 0) {
      goals.forEach((g) => {
        lines.push([escapeCsvCell(g.name), escapeCsvCell(g.current), escapeCsvCell(g.target), escapeCsvCell(g.source)].join(','));
      });
    } else {
      lines.push('"No active savings goals"');
    }
  }

  return lines.join('\n');
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
