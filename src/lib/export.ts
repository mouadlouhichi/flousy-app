import { MonthBudget, SavingGoal } from './store';

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

export function exportMonthToCsv(month: MonthBudget, goals: SavingGoal[], monthKey: string, currency: string = 'MAD'): string {
  const lines: string[] = [];

  lines.push(`"SmartJib Financial Export - ${monthKey}"`);
  lines.push(`"Export Date",${escapeCsvCell(new Date().toISOString())}`);
  lines.push(`"Currency",${escapeCsvCell(currency)}`);
  lines.push('');

  // Balances
  lines.push('"MONEY PLACES BALANCES"');
  lines.push('"Bank","Home Cash","Wallet","Total Cash"');
  const totalCash = (month.bankPart || 0) + (month.homePart || 0) + (month.walletPart || 0);
  lines.push(
    [
      escapeCsvCell(month.bankPart || 0),
      escapeCsvCell(month.homePart || 0),
      escapeCsvCell(month.walletPart || 0),
      escapeCsvCell(totalCash),
    ].join(',')
  );
  lines.push('');

  // Fixed Monthly Charges
  lines.push('"FIXED CHARGES"');
  lines.push('"Name","Category","Amount","Paid From"');
  if (month.fixedExpenses && month.fixedExpenses.length > 0) {
    month.fixedExpenses.forEach((fe) => {
      lines.push([escapeCsvCell(fe.name), escapeCsvCell(fe.type), escapeCsvCell(fe.amount), escapeCsvCell(fe.place)].join(','));
    });
  } else {
    lines.push('"No fixed charges recorded"');
  }
  lines.push('');

  // Variable Expenses
  lines.push('"VARIABLE EXPENSES"');
  lines.push('"Date","Name","Category","Amount","Paid From","Note"');
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
    lines.push('"No variable expenses recorded"');
  }
  lines.push('');

  // Savings Goals
  lines.push('"SAVINGS GOALS"');
  lines.push('"Goal Name","Current Amount","Target Amount","Source Place"');
  if (goals && goals.length > 0) {
    goals.forEach((g) => {
      lines.push([escapeCsvCell(g.name), escapeCsvCell(g.current), escapeCsvCell(g.target), escapeCsvCell(g.source)].join(','));
    });
  } else {
    lines.push('"No active savings goals"');
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
