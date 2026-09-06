'use client';

import { useMemo } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { FormattedAmount } from '@/components/ui/formatted-amount';
import { Modal } from '../ui/Modal';
import { buildPlaceLedger, PlaceLedgerOptions, PlaceLedgerRow } from '../../lib/place-ledger';
import { useMoneyPlaces } from '../../lib/use-money-places';
import { useCurrency } from '../../lib/currency-context';
import { useLanguage } from '@/lib/i18n-context';
import { formatShortDate } from '../../lib/utils';
import { localizeCategoryName, localizeIncomeSourceName, localizePlaceName } from '../../lib/localized-labels';
import { type MonthBudget, moneyPlaceIcon } from '../../lib/store';

interface PlaceHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  month: MonthBudget;
  /** Money place whose statement is shown; null renders nothing. */
  placeId: string | null;
  /** Row kinds the caller is allowed to reveal (household RBAC). */
  include?: PlaceLedgerOptions['include'];
}

function rowIcon(row: PlaceLedgerRow, month: MonthBudget): string {
  switch (row.kind) {
    case 'expense':
      return month.categoryIcons?.[row.type || ''] || 'shopping_bag';
    case 'bill':
      return 'receipt';
    case 'income':
      return 'account_balance';
    case 'transfer':
      // The counterparty is the interesting place: money came FROM it
      // (delta > 0) or went TO it (delta < 0).
      return moneyPlaceIcon(row.delta < 0 ? row.to || 'bank' : row.from || 'bank');
    case 'savings':
      return 'savings';
    case 'adjustment':
      return 'balance';
    default:
      return 'payments';
  }
}

export function PlaceHistoryModal({ isOpen, onClose, month, placeId, include }: PlaceHistoryModalProps) {
  const { messages: m, t, intlLocale } = useLanguage();
  const { formatParts } = useCurrency();
  const { places } = useMoneyPlaces(month);

  const h = m.moneyHistory;
  const config = places.find((place) => place.id === placeId);
  const placeName = placeId ? localizePlaceName(placeId, config?.name || placeId, m) : '';

  // Resolved flags (defaulting to "show everything") so the memo depends on
  // stable booleans, not the caller's fresh object identity each render.
  const includeExpenses = include?.expenses !== false;
  const includeFixedBills = include?.fixedBills !== false;
  const includeIncome = include?.income !== false;
  const includeSavings = include?.savings !== false;

  const ledger = useMemo(
    () =>
      isOpen && placeId
        ? buildPlaceLedger(month, placeId, {
            include: {
              expenses: includeExpenses,
              fixedBills: includeFixedBills,
              income: includeIncome,
              savings: includeSavings,
            },
          })
        : null,
    // `month` identity changes on every edit, which is what makes the statement live.
    [isOpen, placeId, month, includeExpenses, includeFixedBills, includeIncome, includeSavings],
  );

  const titleFor = (row: PlaceLedgerRow): string => {
    switch (row.kind) {
      case 'transfer':
        if (row.delta < 0) return t(h.transferTo, { place: placeLabel(row.to || '') });
        return t(h.transferFrom, { place: placeLabel(row.from || '') });
      case 'adjustment':
        return row.note || h.adjustment;
      case 'income':
        return localizeIncomeSourceName(row.name || '', m) || h.income;
      default:
        return row.name || '';
    }
  };

  const metaFor = (row: PlaceLedgerRow): string => {
    switch (row.kind) {
      case 'expense':
      case 'bill':
        return row.type ? localizeCategoryName(row.type, m) : '';
      case 'income':
        // The income title already names the source; the meta line stays just the date.
        return '';
      case 'savings':
        return row.activityType === 'deposit' ? h.savingsDeposit : h.savingsWithdrawal;
      case 'adjustment': {
        const reason =
          row.reason === 'reconciliation'
            ? h.reconciliation
            : row.reason === 'income'
              ? h.income
              : h.openingBalance;
        // With a note the note is the title, so the kind moves to the meta line.
        return row.note ? h.adjustment : reason;
      }
      default:
        return '';
    }
  };

  const placeLabel = (id: string): string =>
    localizePlaceName(id, places.find((p) => p.id === id)?.name || id, m);

  const timeSuffix = (row: PlaceLedgerRow): string => {
    if (!row.instant) return '';
    try {
      return new Date(row.instant).toLocaleTimeString(intlLocale, { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const dateLine = (row: PlaceLedgerRow): string => {
    const suffix = timeSuffix(row);
    return suffix ? `${formatShortDate(row.day, intlLocale)}, ${suffix}` : formatShortDate(row.day, intlLocale);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={placeName || h.currentBalance}>
      <div className="flex flex-col gap-1">
        {/* Current balance */}
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-outline-variant bg-surface-container px-4 py-3">
          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
            {h.currentBalance}
          </span>
          <FormattedAmount
            value={ledger?.currentBalance ?? 0}
            className="font-mono font-extrabold text-headline-sm text-on-surface"
          />
        </div>

        {/* Statement rows */}
        {!ledger || ledger.rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <AppIcon name="account_balance_wallet" className="text-[40px] text-outline" />
            <p className="font-body-md text-body-md text-on-surface-variant">{h.empty}</p>
          </div>
        ) : (
          <>
            <ul className="mt-1 divide-y divide-outline-variant/40">
              {ledger.rows.map((row) => (
                <li key={row.id} className="flex items-center gap-3 py-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-container text-on-surface-variant">
                    <AppIcon name={rowIcon(row, month)} className="text-[20px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-headline-sm text-headline-sm font-semibold text-on-surface">
                      {titleFor(row)}
                    </span>
                    <span className="mt-0.5 block truncate font-label-sm text-label-sm text-on-surface-variant">
                      {(metaFor(row) ? `${metaFor(row)} • ` : '') + dateLine(row)}
                    </span>
                  </span>
                  <span className="shrink-0 text-end">
                    <FormattedAmount
                      value={Math.abs(row.delta)}
                      prefix={row.delta < 0 ? '-' : '+'}
                      className={`block font-mono font-extrabold text-base ${
                        row.delta < 0 ? 'text-on-surface' : 'text-primary'
                      }`}
                    />
                    <span className="block text-xs font-semibold text-on-surface-variant" dir="auto">
                      {formatParts(row.balance).amount}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            {/* Opening balance anchors the bottom of the statement */}
            <div className="mt-1 flex items-center justify-between gap-3 border-t border-outline-variant/60 pt-3 pb-1">
              <span className="font-label-md text-label-md text-on-surface-variant">{h.openingBalance}</span>
              <FormattedAmount
                value={ledger.openingBalance}
                className="font-mono font-bold text-sm text-on-surface-variant"
              />
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
