'use client';

import { useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/lib/auth-context';
import { useCurrency } from '@/lib/currency-context';
import { useMoneyPlaces } from '@/lib/use-money-places';
import {
  MONEY_PLACE_ICON_CHOICES,
  addMoneyPlace,
  getPlaceBalance,
  nextMoneyPlaceId,
  reassignGoalSources,
  reassignMoneyPlace,
  removeMoneyPlace,
  updateMoneyPlace,
} from '@/lib/store';
import { useDashboard } from '../dashboard-provider';
import { useLanguage } from '@/lib/i18n-context';
import { useHousehold } from '@/lib/household-context';
import type { UserProfile } from '@/lib/store';

export function MoneySourcesPanel() {
  const { profile, updateProfileData } = useAuth();
  const { workspace, household, isOwner, updateConfiguration } = useHousehold();
  const { month, goals, updateAndSaveFinance } = useDashboard();
  const { places, label } = useMoneyPlaces(month);
  const canConfigure = workspace === 'personal' || isOwner;
  const configurationProfile: UserProfile | null = profile
    ? { ...profile, ...(workspace === 'household' ? { moneyPlaces: household?.moneyPlaces } : {}) }
    : null;
  const { format } = useCurrency();
  const { messages: m, t } = useLanguage();
  const p = m.profile.moneySources;

  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftIcon, setDraftIcon] = useState<string>('payments');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('payments');
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const persistPlaces = async (nextProfile: UserProfile | null) => {
    if (!nextProfile || !configurationProfile || !canConfigure) return;
    if (nextProfile === configurationProfile) return;
    if (workspace === 'household') {
      await updateConfiguration({ moneyPlaces: nextProfile.moneyPlaces || [] });
    } else {
      await updateProfileData({ moneyPlaces: nextProfile.moneyPlaces });
    }
  };

  const handleAdd = async () => {
    if (!configurationProfile || !canConfigure) return;
    const name = draftName.trim();
    if (!name) {
      setError(p.nameRequired);
      return;
    }
    const id = nextMoneyPlaceId(name, places.map((p) => p.id));
    const next = addMoneyPlace(configurationProfile, { id, name, icon: draftIcon });
    if (next === configurationProfile) {
      setError(p.duplicateName);
      return;
    }
    await persistPlaces(next);
    setDraftName('');
    setDraftIcon('payments');
    setAdding(false);
    setError(null);
  };

  const handleSaveEdit = async () => {
    if (!configurationProfile || !canConfigure || !editingId) return;
    const next = updateMoneyPlace(configurationProfile, editingId, { name: editName, icon: editIcon });
    if (next === configurationProfile) {
      setError(p.uniqueName);
      return;
    }
    await persistPlaces(next);
    setEditingId(null);
    setError(null);
  };

  const handleRemove = async (id: string) => {
    if (!configurationProfile || !canConfigure) return;
    const remaining = places.filter((p) => p.id !== id);
    if (remaining.length === 0) return;
    const fallback = remaining[0].id;
    const nextProfile = removeMoneyPlace(configurationProfile, id);
    if (nextProfile === configurationProfile) return;
    await persistPlaces(nextProfile);
    updateAndSaveFinance(
      reassignMoneyPlace(month, id, fallback),
      reassignGoalSources(goals, id, fallback),
    );
    setPendingRemove(null);
  };

  const pending = places.find((p) => p.id === pendingRemove);
  const leftover = pending ? getPlaceBalance(month, pending.id) : 0;
  const fallbackId = places.find((place) => place.id !== pendingRemove)?.id;
  const fallbackName = fallbackId ? label(fallbackId) : undefined;

  return (
    <div className="flex flex-col gap-3">
      <p className="px-1 text-sm text-on-surface-variant">
{p.description}
      </p>

      <div className="divide-y divide-outline-variant/30 rounded-2xl border border-outline-variant bg-surface-container">
        {places.map((place) => {
          const isEditing = editingId === place.id;
          return (
            <div key={place.id} className="flex flex-col gap-3 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <AppIcon name={place.icon} className="text-[20px]" />
                </span>
                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      aria-label={m.common.name}
                      className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm font-bold text-on-surface outline-none focus:border-primary"
                      autoFocus
                    />
                  ) : (
                    <>
                      <p className="truncate text-sm font-bold text-on-surface">{label(place.id)}</p>
                      <p className="font-mono text-xs text-on-surface-variant">
                        {format(getPlaceBalance(month, place.id))}
                      </p>
                    </>
                  )}
                </div>
                {!isEditing && canConfigure && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      aria-label={t(p.editSource, { name: label(place.id) })}
                      onClick={() => {
                        setEditingId(place.id);
                        setEditName(place.name);
                        setEditIcon(place.icon);
                        setError(null);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-variant hover:text-on-surface"
                    >
                      <AppIcon name="edit" className="text-[16px]" />
                    </button>
                    <button
                      type="button"
                      aria-label={t(p.removeSource, { name: label(place.id) })}
                      disabled={places.length <= 1}
                      onClick={() => setPendingRemove(place.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-error/10 hover:text-error disabled:opacity-40"
                    >
                      <AppIcon name="delete" className="text-[16px]" />
                    </button>
                  </div>
                )}
              </div>

              {isEditing && (
                <>
                  <IconPicker value={editIcon} onChange={setEditIcon} label={p.chooseIcon} />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      className="flex-1 rounded-xl bg-primary py-2 text-xs font-bold text-on-primary"
                    >
                      {m.common.save}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setError(null);
                      }}
                      className="flex-1 rounded-xl border border-outline-variant py-2 text-xs font-bold text-on-surface-variant"
                    >
                      {m.common.cancel}
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {canConfigure && (adding ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-outline-variant bg-surface-container p-4">
          <input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder={p.exampleName}
            aria-label={m.common.name}
            className="w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm font-bold text-on-surface outline-none focus:border-primary"
            autoFocus
          />
          <IconPicker value={draftIcon} onChange={setDraftIcon} label={p.chooseIcon} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAdd}
              className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-on-primary"
            >
              {p.addSource}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setError(null);
              }}
              className="flex-1 rounded-xl border border-outline-variant py-2.5 text-sm font-bold text-on-surface-variant"
            >
              {m.common.cancel}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setAdding(true);
            setError(null);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-outline-variant bg-surface-container/60 py-3.5 text-sm font-bold text-primary hover:bg-surface-container"
        >
          <AppIcon name="add" className="text-[18px]" />
          {p.addMoneySource}
        </button>
      ))}

      {error && <p className="px-1 text-xs font-medium text-error">{error}</p>}

      <ConfirmDialog
        isOpen={!!pendingRemove}
        onClose={() => setPendingRemove(null)}
        onConfirm={() => pendingRemove && handleRemove(pendingRemove)}
        title={t(p.removeSourceTitle, { name: pending ? label(pending.id) : p.thisSource })}
        message={
          leftover > 0
            ? t(p.moveBalanceMessage, {
                amount: format(leftover),
                source: pending ? label(pending.id) : p.thisSource,
                destination: fallbackName || label('bank'),
              })
            : p.removeSourceMessage
        }
        confirmLabel={m.common.remove}
        isDestructive
      />
    </div>
  );
}

function IconPicker({ value, onChange, label }: { value: string; onChange: (icon: string) => void; label: string }) {
  const { translate } = useLanguage();
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {MONEY_PLACE_ICON_CHOICES.map((icon) => (
        <button
          key={icon}
          type="button"
          aria-label={translate(`iconPicker.choices.${icon}`)}
          title={translate(`iconPicker.choices.${icon}`)}
          aria-pressed={value === icon}
          onClick={() => onChange(icon)}
          className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
            value === icon ? 'bg-primary text-on-primary' : 'bg-surface-variant text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <AppIcon name={icon} className="text-[18px]" />
        </button>
      ))}
    </div>
  );
}
