'use client';

import { AppIcon } from '@/components/ui/app-icon';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { VariableExpense, FixedExpense, MoneyPlace, MonthBudget } from '../../lib/store';
import { useCurrency } from '../../lib/currency-context';
import { useLanguage } from '../../lib/i18n-context';
import type { Language } from '../../lib/i18n-core';
import { useMoneyPlaces } from '../../lib/use-money-places';
import { localizeCategoryName } from '../../lib/localized-labels';
import { formatShortDate } from '../../lib/utils';
import { MONTHLY_VARIABLE_EXPENSE_LIMIT } from '../../lib/validation';

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

type CsvHeaderKind = 'name' | 'amount' | 'date' | 'category' | 'place' | 'note' | 'person';

/**
 * CSV exports use the language configured by the bank or spreadsheet. These
 * aliases let an Arabic or French user import an export without first having
 * to rename every heading in English.
 */
const CSV_HEADER_ALIASES: Record<CsvHeaderKind, readonly string[]> = {
  name: ['name', 'description', 'item', 'nom', 'designation', 'libelle', 'اسم', 'الاسم', 'وصف', 'الوصف', 'عنصر'],
  amount: ['amount', 'price', 'value', 'val', 'montant', 'prix', 'valeur', 'مبلغ', 'المبلغ', 'سعر', 'القيمة', 'قيمة'],
  date: ['date', 'time', 'temps', 'تاريخ', 'التاريخ', 'وقت'],
  category: ['category', 'type', 'categorie', 'الفئة', 'فئة', 'تصنيف', 'النوع', 'نوع'],
  place: ['place', 'source', 'account', 'emplacement', 'compte', 'lieu', 'مكان', 'المكان', 'حساب', 'المصدر'],
  note: ['note', 'memo', 'comment', 'remarque', 'ملاحظة', 'ملاحظات', 'تعليق'],
  person: ['person', 'member', 'personne', 'membre', 'شخص', 'الشخص', 'عضو', 'العضو'],
};

function normalizeCsvText(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f\u064B-\u065F\u0670\u0640]/g, '');
}

function getCsvHeaderKind(header: string): CsvHeaderKind | undefined {
  const normalized = normalizeCsvText(header);
  if (!normalized) return undefined;

  return (Object.keys(CSV_HEADER_ALIASES) as CsvHeaderKind[]).find((kind) =>
    CSV_HEADER_ALIASES[kind].some(
      (alias) => normalized === alias || normalized.includes(alias),
    ),
  );
}

function detectCsvDelimiter(headerLine: string): ',' | ';' | '\t' {
  let commas = 0;
  let semicolons = 0;
  let tabs = 0;
  let inQuotes = false;

  for (let index = 0; index < headerLine.length; index += 1) {
    const character = headerLine[index];
    if (character === '"') {
      if (inQuotes && headerLine[index + 1] === '"') {
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (inQuotes) continue;
    if (character === ',') commas += 1;
    else if (character === ';') semicolons += 1;
    else if (character === '\t') tabs += 1;
  }

  if (semicolons > commas && semicolons >= tabs) return ';';
  if (tabs > commas && tabs > semicolons) return '\t';
  return ',';
}

/**
 * Split the file into records first, then parse each record.
 *
 * The previous code did `text.split(/\r?\n/)` and ran the (otherwise correct)
 * quote-aware column parser over each physical line. A quoted field containing a
 * line break — which Excel and Google Sheets emit for multi-line notes — was cut
 * in half: the first half became a row whose note was truncated, and the second
 * half became a row of its own whose first column was the tail of someone's
 * note, imported as an expense name.
 */
function splitCsvRecords(text: string, delimiter: string): string[] {
  const records: string[] = [];
  let record = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (inQuotes && text[index + 1] === '"') {
        record += '"';
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      record += character;
      continue;
    }
    if (!inQuotes && (character === '\n' || character === '\r')) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      records.push(record);
      record = '';
      continue;
    }
    record += character;
  }
  records.push(record);
  return records.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let value = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (character === delimiter && !inQuotes) {
      values.push(value.trim());
      value = '';
    } else {
      value += character;
    }
  }

  values.push(value.trim());
  return values;
}

function toAsciiDigits(value: string): string {
  const arabicIndic = '٠١٢٣٤٥٦٧٨٩';
  const easternArabicIndic = '۰۱۲۳۴۵۶۷۸۹';
  return value
    .replace(/[٠-٩]/g, (digit) => String(arabicIndic.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(easternArabicIndic.indexOf(digit)));
}

/** Parse English, French, and Arabic-formatted money values without using the UI locale as a constraint. */
function parseLocalizedAmount(value: string, language: Language): number | null {
  const usesArabicDecimalSeparator = value.includes('٫');
  let normalized = toAsciiDigits(value)
    .replace(/[\s\u00A0\u202F]/g, '')
    .replace(/٬/g, ',')
    .replace(/٫/g, '.')
    .replace(/[^\d,.+\-]/g, '');

  if (!normalized || !/\d/.test(normalized)) return null;

  const sign = normalized.startsWith('-') ? '-' : '';
  normalized = sign + normalized.replace(/[+-]/g, '');

  const lastComma = normalized.lastIndexOf(',');
  const lastDot = normalized.lastIndexOf('.');

  if (lastComma !== -1 && lastDot !== -1) {
    const decimalIsComma = lastComma > lastDot;
    const decimalSeparator = decimalIsComma ? ',' : '.';
    const groupingSeparator = decimalIsComma ? /\./g : /,/g;
    normalized = normalized.replace(groupingSeparator, '').replace(decimalSeparator, '.');
  } else if (lastComma !== -1) {
    const parts = normalized.split(',');
    const decimal = parts[parts.length - 1];
    normalized = decimal.length <= 2
      ? `${parts.slice(0, -1).join('')}.${decimal}`
      : parts.join('');
  } else if (lastDot !== -1) {
    const parts = normalized.split('.');
    const decimal = parts[parts.length - 1];
    if (parts.length > 2) {
      normalized = decimal.length <= 2
        ? `${parts.slice(0, -1).join('')}.${decimal}`
        : parts.join('');
    } else if (language !== 'en' && !usesArabicDecimalSeparator && decimal.length === 3) {
      // In French/Arabic exports a single dot is commonly a thousands separator.
      normalized = parts.join('');
    }
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.abs(parsed) : null;
}

function validIsoDate(year: number, month: number, day: number): string | undefined {
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseLocalizedDate(value: string, language: Language): string | undefined {
  const datePart = toAsciiDigits(value).trim().replace(/[\u200E\u200F]/g, '').split(/[T ]/, 1)[0];
  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(datePart);
  if (match) return validIsoDate(Number(match[1]), Number(match[2]), Number(match[3]));

  match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(datePart);
  if (!match) return undefined;

  const first = Number(match[1]);
  const second = Number(match[2]);
  const year = Number(match[3]);
  return language === 'en'
    ? validIsoDate(year, first, second)
    : validIsoDate(year, second, first);
}

function todayLocalIso(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function resolveCsvPlace(
  rawPlace: string,
  places: readonly { id: string; name: string }[],
  placeLabel: (id: string) => string,
): MoneyPlace {
  const normalized = normalizeCsvText(rawPlace);
  if (!normalized) return 'bank';

  const configuredPlace = places.find((place) =>
    [place.id, place.name, placeLabel(place.id)].some(
      (candidate) => normalizeCsvText(candidate) === normalized,
    ),
  );
  if (configuredPlace) return configuredPlace.id;

  const contains = (...aliases: string[]) => aliases.some(
    (alias) => normalized.includes(normalizeCsvText(alias)),
  );
  if (contains('home', 'cash', 'maison', 'domicile', 'especes', 'espèces', 'منزل', 'المنزل', 'بيت', 'البيت', 'نقد', 'النقد')) {
    return 'home';
  }
  if (contains('wallet', 'portefeuille', 'محفظة', 'المحفظة')) return 'wallet';
  return 'bank';
}

export function ImportCsvModal({
  isOpen,
  onClose,
  month,
  onImportVariable,
  onImportFixed,
}: ImportCsvModalProps) {
  const { format } = useCurrency();
  const { messages: m, t, intlLocale, language } = useLanguage();
  const copy = m.modals.importCsv;
  const { label: placeLabel, places } = useMoneyPlaces();
  const [targetType, setTargetType] = useState<'variable' | 'fixed'>('variable');
  const [fileText, setFileText] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [truncated, setTruncated] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const content = loadEvent.target?.result;
      if (typeof content === 'string') {
        parseCsv(content);
      } else {
        setFileText('');
        setParsedRows([]);
        setError(copy.parseFailed);
      }
    };
    reader.onerror = () => {
      setFileText('');
      setParsedRows([]);
      setError(copy.parseFailed);
    };
    reader.readAsText(file);
  };

  const parseCsv = (csv: string) => {
    setError(null);
    setParsedRows([]);
    setTruncated(false);
    setFileText(csv);

    try {
      const firstPhysicalLine = csv.split(/\r?\n/)[0] ?? '';
      const lines = splitCsvRecords(csv, detectCsvDelimiter(firstPhysicalLine));

      if (lines.length < 2) {
        setError(copy.invalidRows);
        return;
      }

      const delimiter = detectCsvDelimiter(lines[0]);
      const headers = parseCsvLine(lines[0], delimiter).map(getCsvHeaderKind);
      const rows: ParsedRow[] = [];

      for (let index = 1; index < lines.length; index += 1) {
        const columns = parseCsvLine(lines[index], delimiter);
        if (columns.length < 2) continue;

        let name = columns[0] || copy.importedExpense;
        let amount = 0;
        let date = todayLocalIso();
        // Built-in fallbacks intentionally use canonical stored values. Their display
        // labels are translated later by localizeCategoryName/localizePersonName.
        let category = month.activeCategories?.[0] || 'Groceries';
        let place: MoneyPlace = 'bank';
        let note = '';
        let person = 'Self';

        columns.forEach((column, columnIndex) => {
          switch (headers[columnIndex]) {
            case 'name':
              name = column || name;
              break;
            case 'amount': {
              const parsedAmount = parseLocalizedAmount(column, language);
              if (parsedAmount !== null) amount = parsedAmount;
              break;
            }
            case 'date':
              date = parseLocalizedDate(column, language) || date;
              break;
            case 'category':
              if (column) category = column;
              break;
            case 'place':
              place = resolveCsvPlace(column, places, placeLabel);
              break;
            case 'note':
              note = column;
              break;
            case 'person':
              person = column;
              break;
            default:
              break;
          }
        });

        if (amount > 0) rows.push({ name, amount, date, category, place, note, person });
        if (rows.length >= MONTHLY_VARIABLE_EXPENSE_LIMIT) {
          // The rest of the file is not silently discarded: the notice names the
          // limit, and importing again starts from what is already there.
          setTruncated(rows.length < lines.length - 1);
          break;
        }
      }

      if (rows.length === 0) {
        setError(copy.noNumericAmounts);
      } else {
        setParsedRows(rows);
      }
    } catch {
      setError(copy.parseFailed);
    }
  };

  const handleConfirmImport = () => {
    if (parsedRows.length === 0) return;

    if (targetType === 'variable') {
      const expenses: VariableExpense[] = parsedRows.map((row, index) => ({
        id: `csv-var-${Date.now()}-${index}`,
        name: row.name,
        amount: row.amount,
        type: row.category,
        date: row.date,
        place: row.place,
        note: row.note,
        person: row.person,
      }));
      onImportVariable(expenses);
    } else {
      const bills: FixedExpense[] = parsedRows.map((row, index) => ({
        id: `csv-fix-${Date.now()}-${index}`,
        name: row.name,
        amount: row.amount,
        type: row.category,
        date: '1st',
        place: row.place,
        person: row.person,
        recurring: true,
      }));
      onImportFixed(bills);
    }

    setParsedRows([]);
    setFileText('');
    setError(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={copy.title}>
      <div className="flex flex-col gap-5">
        <div className="flex bg-surface-container-high rounded-xl p-1" role="group">
          <button
            type="button"
            onClick={() => setTargetType('variable')}
            aria-pressed={targetType === 'variable'}
            className={`flex-1 py-2.5 rounded-lg text-[14px] font-bold transition-all ${
              targetType === 'variable'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {copy.variableExpenses}
          </button>
          <button
            type="button"
            onClick={() => setTargetType('fixed')}
            aria-pressed={targetType === 'fixed'}
            className={`flex-1 py-2.5 rounded-lg text-[14px] font-bold transition-all ${
              targetType === 'fixed'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {copy.fixedBills}
          </button>
        </div>

        <div className="p-6 bg-surface-container border-2 border-dashed border-outline-variant rounded-2xl text-center hover:bg-surface-container transition-colors cursor-pointer">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileUpload}
            id="csv-file-input"
            className="hidden"
          />
          <label htmlFor="csv-file-input" className="cursor-pointer flex flex-col items-center gap-2">
            <AppIcon name="upload_file" className="text-[44px] text-primary" />
            <span className="font-label-lg text-label-lg font-bold text-on-surface">
              {copy.uploadLabel}
            </span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              {copy.supportedColumns}
            </span>
          </label>
        </div>

        {error && (
          <div role="alert" className="p-3 bg-error-container text-on-error-container rounded-xl text-[13px] font-medium flex items-start gap-2">
            <AppIcon name="error" className="text-[18px] shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {truncated && (
          <p role="alert" className="p-3 rounded-xl bg-tertiary-container text-on-tertiary-container text-[13px] font-medium">
            {t(m.import.truncated, {
              limit: new Intl.NumberFormat(intlLocale).format(MONTHLY_VARIABLE_EXPENSE_LIMIT),
            })}
          </p>
        )}

        {parsedRows.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
                {t(copy.preview, { count: new Intl.NumberFormat(intlLocale).format(parsedRows.length) })}
              </span>
              <span className="text-[13px] font-bold text-primary">
                {t(copy.total, { amount: format(parsedRows.reduce((total, row) => total + row.amount, 0)) })}
              </span>
            </div>

            <div className="max-h-56 overflow-y-auto space-y-1.5 pe-1">
              {parsedRows.map((row, index) => (
                <div
                  key={`${row.name}-${row.date}-${index}`}
                  className="p-2.5 bg-surface-container rounded-xl flex items-center justify-between"
                >
                  <div className="flex flex-col min-w-0 pe-2">
                    <span className="font-bold text-[13px] text-on-surface truncate">{row.name}</span>
                    <span className="text-[11px] text-on-surface-variant">
                      {formatShortDate(row.date, intlLocale)} · {localizeCategoryName(row.category, m)} ({placeLabel(row.place)})
                    </span>
                  </div>
                  <span className="font-bold text-[13px] text-error whitespace-nowrap">{format(row.amount)}</span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleConfirmImport}
              className="w-full py-3 bg-primary text-on-primary rounded-xl font-bold text-[15px] shadow-md hover:bg-accent-foreground transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <AppIcon name="add_task" className="text-[20px]" />
              <span>{t(copy.importButton, { count: new Intl.NumberFormat(intlLocale).format(parsedRows.length) })}</span>
            </button>
          </div>
        )}

        {!fileText && !error && parsedRows.length === 0 && (
          <div className="p-4 bg-surface-container rounded-xl border border-dashed border-outline-variant text-center">
            <p className="text-[13px] text-on-surface-variant">{copy.selectFile}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
