'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { VariableExpense, FixedExpense, MoneyPlace, MonthBudget } from '../../lib/store';
import { useCurrency } from '../../lib/currency-context';

interface ImportCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  month: MonthBudget;
  onImportVariable: (expenses: VariableExpense[]) => void;
  onImportFixed: (bills: FixedExpense[]) => void;
}

interface ParsedRow {
  date: string;
  name: string;
  amount: number;
  category: string;
  place: MoneyPlace;
  person?: string;
  note?: string;
}

export function ImportCsvModal({
  isOpen,
  onClose,
  month,
  onImportVariable,
  onImportFixed,
}: ImportCsvModalProps) {
  const { format } = useCurrency();
  const [targetType, setTargetType] = useState<'variable' | 'fixed'>('variable');
  const [fileText, setFileText] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        parseCsv(content);
      }
    };
    reader.readAsText(file);
  };

  const parseCsv = (csv: string) => {
    setError(null);
    setFileText(csv);

    try {
      const lines = csv
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      if (lines.length < 2) {
        setError('CSV must contain a header row and at least one data row.');
        return;
      }

      // Simple CSV line parser taking quotes into account
      const parseLine = (line: string): string[] => {
        const result: string[] = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(cur.trim().replace(/^"|"$/g, ''));
            cur = '';
          } else {
            cur += char;
          }
        }
        result.push(cur.trim().replace(/^"|"$/g, ''));
        return result;
      };

      const header = parseLine(lines[0]).map((h) => h.toLowerCase());
      const rows: ParsedRow[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = parseLine(lines[i]);
        if (cols.length < 2) continue;

        let name = cols[0] || 'Imported Expense';
        let amount = 0;
        let date = new Date().toISOString().split('T')[0];
        let category = month.activeCategories?.[0] || 'Groceries';
        let place: MoneyPlace = 'bank';
        let note = '';
        let person = 'Self';

        cols.forEach((col, idx) => {
          const colName = header[idx] || '';
          if (colName.includes('name') || colName.includes('description') || colName.includes('item')) {
            name = col || name;
          } else if (colName.includes('amount') || colName.includes('price') || colName.includes('val')) {
            const parsedAmt = parseFloat(col.replace(/[^0-9.-]/g, ''));
            if (!isNaN(parsedAmt)) amount = Math.abs(parsedAmt);
          } else if (colName.includes('date') || colName.includes('time')) {
            if (col.match(/^\d{4}-\d{2}-\d{2}$/)) date = col;
          } else if (colName.includes('category') || colName.includes('type')) {
            if (col) category = col;
          } else if (colName.includes('place') || colName.includes('source') || colName.includes('account')) {
            const p = col.toLowerCase();
            if (p.includes('home') || p.includes('cash')) place = 'home';
            else if (p.includes('wallet')) place = 'wallet';
            else place = 'bank';
          } else if (colName.includes('note') || colName.includes('memo')) {
            note = col;
          } else if (colName.includes('person') || colName.includes('member')) {
            person = col;
          }
        });

        if (amount > 0) {
          rows.push({ name, amount, date, category, place, note, person });
        }
      }

      if (rows.length === 0) {
        setError('No valid numeric amounts found in the CSV rows.');
      } else {
        setParsedRows(rows);
      }
    } catch (err: any) {
      setError('Failed to parse CSV file: ' + err.message);
    }
  };

  const handleConfirmImport = () => {
    if (parsedRows.length === 0) return;

    if (targetType === 'variable') {
      const expenses: VariableExpense[] = parsedRows.map((r, idx) => ({
        id: `csv-var-${Date.now()}-${idx}`,
        name: r.name,
        amount: r.amount,
        type: r.category,
        date: r.date,
        place: r.place,
        note: r.note,
        person: r.person,
      }));
      onImportVariable(expenses);
    } else {
      const bills: FixedExpense[] = parsedRows.map((r, idx) => ({
        id: `csv-fix-${Date.now()}-${idx}`,
        name: r.name,
        amount: r.amount,
        type: r.category,
        date: '1st',
        place: r.place,
        person: r.person,
        recurring: true,
      }));
      onImportFixed(bills);
    }

    // Reset and close
    setParsedRows([]);
    setFileText('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import CSV Transactions">
      <div className="space-y-md">
        {/* Type selector */}
        <div className="flex gap-sm">
          <button
            type="button"
            onClick={() => setTargetType('variable')}
            className={`flex-1 py-2 px-md rounded-xl font-label-md text-label-md font-bold transition-all ${
              targetType === 'variable'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-variant'
            }`}
          >
            Variable Expenses
          </button>
          <button
            type="button"
            onClick={() => setTargetType('fixed')}
            className={`flex-1 py-2 px-md rounded-xl font-label-md text-label-md font-bold transition-all ${
              targetType === 'fixed'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-variant'
            }`}
          >
            Fixed Bills
          </button>
        </div>

        {/* Upload Box */}
        <div className="border-2 border-dashed border-outline-variant rounded-2xl p-lg text-center bg-surface-container-low hover:bg-surface-container transition-colors">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            id="csv-file-input"
            className="hidden"
          />
          <label htmlFor="csv-file-input" className="cursor-pointer flex flex-col items-center gap-xs">
            <span className="material-symbols-outlined text-[40px] text-primary">upload_file</span>
            <span className="font-label-lg text-label-lg font-bold text-on-surface">
              Click to upload CSV or drag and drop
            </span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Supported columns: Name, Amount, Date, Category, Place, Note, Person
            </span>
          </label>
        </div>

        {error && (
          <div className="p-3 bg-error-container text-on-error-container rounded-xl font-body-sm text-body-sm">
            {error}
          </div>
        )}

        {/* Parsed Preview */}
        {parsedRows.length > 0 && (
          <div className="space-y-sm">
            <div className="flex justify-between items-center">
              <h4 className="font-label-lg text-label-lg font-bold text-on-surface">
                Preview ({parsedRows.length} transactions)
              </h4>
              <span className="font-body-sm text-body-sm text-primary font-bold">
                Total: {format(parsedRows.reduce((a, b) => a + b.amount, 0))}
              </span>
            </div>

            <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
              {parsedRows.map((row, idx) => (
                <div
                  key={idx}
                  className="p-2 bg-surface-container rounded-lg flex items-center justify-between text-body-sm"
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="font-bold truncate text-on-surface">{row.name}</span>
                    <span className="text-on-surface-variant text-[12px]">
                      {row.date} · {row.category} ({row.place})
                    </span>
                  </div>
                  <span className="font-bold text-error whitespace-nowrap">{format(row.amount)}</span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleConfirmImport}
              className="w-full py-3 px-md bg-primary text-on-primary rounded-xl font-label-lg text-label-lg font-bold shadow-md hover:opacity-90 transition-all flex items-center justify-center gap-xs"
            >
              <span className="material-symbols-outlined">add_task</span>
              <span>Import {parsedRows.length} Items</span>
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
