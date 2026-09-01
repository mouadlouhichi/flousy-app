import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { DashboardScrollView as ScrollView } from '../../components/DashboardScrollView';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  Landmark,
  Home,
  Wallet,
  ArrowUpDown,
  Box,
  ChevronDown,
  Pencil,
  SlidersHorizontal,
} from 'lucide-react-native';
import {
  addFixedExpense,
  addVariableExpense,
  editVariableExpense,
  calculateEnvelopeAmounts,
  calculateEnvelopeSpent,
  calculateMonthlyDepositedSavings,
  getPlaceBalance,
  moveMoney,
  resolveMonthStrategy,
  saveGoalWithBalance,
  totalCashOnHand,
  updateMoneyPlaces,
  type FixedExpense,
  type MoneyPlace,
  type SavingGoal,
  type VariableExpense,
} from '@flousy/core';
import { useMobileStore } from '../../lib/store-context';
import { useMobileAuth } from '../../lib/auth-context';
import { useBudgetNotifications } from '../../hooks/useBudgetNotifications';
import { MoveMoneyModal } from '../../components/MoveMoneyModal';
import { StrategyModal } from '../../components/StrategyModal';
import { ExpenseModal } from '../../components/ExpenseModal';
import { FixedModal } from '../../components/FixedModal';
import { SavingsGoalModal } from '../../components/SavingsModal';
import { EditBalancesModal } from '../../components/EditBalancesModal';
import { formatMoney } from '../../lib/format-money';
import { useQuickActionHandler } from '../../lib/quick-actions';
import { FONT } from '../../lib/fonts';
import { CategoryIcon } from '../../components/CategoryIcon';

const TEAL = '#00685f';
const PLACE_STYLE: Record<string, { bg: string; accent: string; Icon: typeof Landmark }> = {
  bank: { bg: '#026462', accent: '#026462', Icon: Landmark },
  home: { bg: '#8B5A3C', accent: '#8B5A3C', Icon: Home },
  wallet: { bg: '#5C6470', accent: '#5C6470', Icon: Wallet },
};

export default function DashboardOverviewScreen() {
  const router = useRouter();
  const { user, demoMode, sendEmailVerification } = useMobileAuth();
  const {
    currentMonthKey,
    month,
    loading,
    updateMonth,
    currency,
    moneyPlaces,
    workspace,
    canEditArea,
    savingsGoals,
    updateSavingsGoals,
  } = useMobileStore();

  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [strategyVisible, setStrategyVisible] = useState(false);
  const [expenseVisible, setExpenseVisible] = useState(false);
  const [fixedVisible, setFixedVisible] = useState(false);
  const [savingsVisible, setSavingsVisible] = useState(false);
  const [balancesVisible, setBalancesVisible] = useState(false);
  const [moveFrom, setMoveFrom] = useState<MoneyPlace | undefined>();
  const [editingBudget, setEditingBudget] = useState(false);
  const [draftBudget, setDraftBudget] = useState('');
  const [editingExpense, setEditingExpense] = useState<VariableExpense | null>(null);

  useBudgetNotifications(month, currency);

  useEffect(() => {
    if (month) setDraftBudget(String(month.totalBudget || 0));
  }, [month]);

  const onQuickAction = useCallback(
    (id: 'expense' | 'charge' | 'savings' | 'courses') => {
      if (id === 'courses') router.push('/dashboard/courses');
      else if (id === 'expense' && canEditArea('expenses')) setExpenseVisible(true);
      else if (id === 'charge' && canEditArea('fixedBills')) setFixedVisible(true);
      else if (id === 'savings' && canEditArea('savings')) setSavingsVisible(true);
    },
    [router, canEditArea],
  );
  useQuickActionHandler(onQuickAction);

  const activity = useMemo(() => {
    if (!month) return [];
    const vars = (month.variableExpenses || []).map((e) => ({
      kind: 'expense' as const,
      id: e.id,
      name: e.name,
      meta: `${formatActivityDate(e.date)} • ${e.type}`,
      amount: e.amount,
      icon: month.categoryIcons?.[e.type] || 'shopping_bag',
      isDeposit: false,
      date: e.date,
    }));
    const sav = (month.savingsActivity || []).map((e) => ({
      kind: 'savings' as const,
      id: e.id,
      name: e.goalName,
      meta: `${e.type === 'deposit' ? 'Deposit' : 'Withdrawal'} · Savings`,
      amount: e.amount,
      icon: 'savings',
      isDeposit: e.type === 'deposit',
      date: e.date,
    }));
    return [...vars, ...sav]
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 5);
  }, [month]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F5FAF8]">
        <ActivityIndicator size="large" color={TEAL} />
      </View>
    );
  }

  if (!month) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F5FAF8] px-6">
        <Text className="mb-4 text-center text-base text-neutral-500">
          No month budget found for {currentMonthKey}.
        </Text>
        <Pressable onPress={() => router.push('/onboarding')} className="rounded-xl bg-primary px-6 py-3">
          <Text className="font-semibold text-white">Start Setup</Text>
        </Pressable>
      </View>
    );
  }

  const strategy = resolveMonthStrategy(month);
  const { needs: needsCap, wants: wantsCap, savings: savingsCap } = calculateEnvelopeAmounts(
    month.totalBudget,
    month.strategyId,
    month.customRatios,
  );
  const spent = calculateEnvelopeSpent(month);
  const depositedThisMonth = calculateMonthlyDepositedSavings(month);
  const totalCash = totalCashOnHand(month);
  const activeGoals = savingsGoals.filter((g) => g.active !== false).length;

  const needsPct = needsCap > 0 ? Math.min(100, Math.round((spent.needs / needsCap) * 100)) : 0;
  const wantsPct = wantsCap > 0 ? Math.min(100, Math.round((spent.wants / wantsCap) * 100)) : 0;
  const savingsPct = savingsCap > 0 ? Math.min(100, Math.round((depositedThisMonth / savingsCap) * 100)) : 0;

  const handleMoveMoney = async (from: MoneyPlace, to: MoneyPlace, amount: number) => {
    await updateMonth(moveMoney(month, from, to, amount));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const saveTotalBudget = async () => {
    const parsed = Number.parseFloat(draftBudget.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.'));
    const safe = Number.isFinite(parsed) ? Math.max(0, parsed) : month.totalBudget || 0;
    setEditingBudget(false);
    setDraftBudget(String(safe));
    if (safe === (month.totalBudget || 0)) return;
    const delta = safe - (month.totalBudget || 0);
    await updateMonth({
      ...month,
      totalBudget: safe,
      bankPart: Math.max(0, (month.bankPart || 0) + delta),
      monthlySavingsTarget: calculateEnvelopeAmounts(safe, month.strategyId, month.customRatios).savings,
    });
  };

  return (
    <View className="flex-1 bg-[#F5FAF8]">
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} className="px-4 pt-2">
        {user && !user.emailVerified && !demoMode ? (
          <View className="mb-4 flex-row items-center justify-between rounded-2xl border border-amber-300 bg-amber-50 p-3.5">
            <View className="mr-2 flex-1">
              <Text className="text-xs font-bold text-amber-800">Email Unverified</Text>
              <Text className="mt-0.5 text-xs text-amber-700">Verify your email address to secure your account.</Text>
            </View>
            <Pressable
              onPress={async () => {
                await sendEmailVerification();
                Alert.alert('Sent', 'Verification email sent!');
              }}
              className="rounded-xl bg-amber-600 px-3 py-2"
            >
              <Text className="text-xs font-bold text-white">Resend</Text>
            </Pressable>
          </View>
        ) : null}

        {workspace === 'household' ? (
          <View className="mb-3 rounded-xl bg-primary/10 px-3 py-2">
            <Text className="text-xs font-bold text-primary">Household workspace</Text>
          </View>
        ) : null}

        {moneyPlaces.map((place) => {
          const style = PLACE_STYLE[place.id] || PLACE_STYLE.bank;
          const Icon = style.Icon;
          const balance = getPlaceBalance(month, place.id);
          return (
            <Pressable
              key={place.id}
              onPress={() => {
                setMoveFrom(place.id);
                setMoveModalVisible(true);
              }}
              className="mb-2.5 flex-row items-center rounded-[22px] border border-neutral-100 bg-white px-3.5 py-3.5"
              hitSlop={4}
            >
              <View
                className="mr-3 h-10 w-10 items-center justify-center rounded-2xl"
                style={{ backgroundColor: style.bg }}
              >
                <Icon size={20} color="#fff" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold text-neutral-800">{place.name}</Text>
                <View className="flex-row items-baseline">
                  <Text className="text-xl font-bold font-mono text-neutral-900" style={{ fontFamily: FONT.monoBold, lineHeight: 28 }}>
                    {formatMoney(balance)}
                  </Text>
                  <Text className="ml-1 text-xs font-semibold text-neutral-500">{currency}</Text>
                </View>
              </View>
              <View className="flex-row items-center py-2 pl-3">
                <Text className="mr-1 text-xs font-bold" style={{ color: style.accent }}>
                  Move
                </Text>
                <ArrowUpDown size={14} color={style.accent} />
              </View>
            </Pressable>
          );
        })}

        <View className="mb-2.5 rounded-[22px] border border-neutral-100 bg-white p-4">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-base font-bold text-neutral-900">Budget Plan</Text>
            <Pressable
              onPress={() => setStrategyVisible(true)}
              className="flex-row items-center rounded-full bg-neutral-100 px-3 py-1.5"
            >
              <Box size={12} color={TEAL} />
              <Text className="mx-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-800">
                {strategy.name}
              </Text>
              <ChevronDown size={12} color="#6B7280" />
            </Pressable>
          </View>

          <EnvelopeRow
            color="#026462"
            label={`Needs (${Math.round(strategy.needsRatio * 100)}%)`}
            used={`${needsPct}% Used`}
            left={`${currency} ${formatMoney(spent.needs)}`}
            right={`${currency} ${formatMoney(needsCap)}`}
            pct={needsPct}
          />
          <EnvelopeRow
            color="#F5A524"
            label={`Wants (${Math.round(strategy.wantsRatio * 100)}%)`}
            used={`${wantsPct}% Used`}
            left={`${currency} ${formatMoney(spent.wants)}`}
            right={`${currency} ${formatMoney(wantsCap)}`}
            pct={wantsPct}
          />
          <EnvelopeRow
            color="#5C6470"
            label={`Savings (${Math.round(strategy.savingsRatio * 100)}%)`}
            used={`${activeGoals} Active Goal${activeGoals === 1 ? '' : 's'}`}
            left={`${currency} ${formatMoney(depositedThisMonth)}`}
            right={`${currency} ${formatMoney(savingsCap)}`}
            pct={savingsPct}
          />
        </View>

        <View className="mb-6 rounded-3xl border border-neutral-200 bg-white p-5">
          <Text className="text-[11px] font-semibold uppercase tracking-[1.3px] text-neutral-500">
            Total Monthly Budget
          </Text>
          <View className="mt-1.5 flex-row items-center gap-2">
            {editingBudget ? (
              <View className="min-w-0 flex-row items-baseline rounded-2xl bg-[#F5FAF8] px-2 py-0.5" style={{ borderWidth: 2, borderColor: 'rgba(0,104,95,0.4)' }}>
                <TextInput
                  value={draftBudget}
                  onChangeText={setDraftBudget}
                  keyboardType="decimal-pad"
                  autoFocus
                  onBlur={() => {
                    void saveTotalBudget();
                  }}
                  onSubmitEditing={() => {
                    void saveTotalBudget();
                  }}
                  className="text-xl font-bold font-mono text-neutral-900"
                  style={{ fontFamily: FONT.monoBold, lineHeight: 28, minWidth: 80, padding: 0 }}
                />
                <Text className="ml-1 text-xs font-semibold text-neutral-500">{currency}</Text>
              </View>
            ) : (
              <Pressable
                onPress={() => canEditArea('balances') && setEditingBudget(true)}
                className="min-w-0 flex-row items-baseline"
              >
                <Text className="text-xl font-bold font-mono text-neutral-900" style={{ fontFamily: FONT.monoBold, lineHeight: 28 }}>
                  {formatMoney(month.totalBudget)}
                </Text>
                <Text className="ml-1 text-xs font-semibold text-neutral-500">{currency}</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => canEditArea('balances') && setEditingBudget(true)}
              accessibilityLabel="Edit total monthly budget"
              className="shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white p-1.5"
            >
              <Pencil size={14} color="#6B7280" />
            </Pressable>
          </View>

          <View className="mt-4 border-t border-neutral-200/50 pt-4">
            <Text className="text-[11px] font-semibold uppercase tracking-[1.3px] text-neutral-500">
              Total Cash on Hand
            </Text>
            <View className="mt-1.5 flex-row items-center gap-2">
              <View className="min-w-0 flex-row items-baseline">
                <Text className="text-xl font-bold font-mono text-neutral-900" style={{ fontFamily: FONT.monoBold, lineHeight: 28 }} numberOfLines={1}>
                  {formatMoney(totalCash)}
                </Text>
                <Text className="ml-1 text-xs font-semibold text-neutral-500">{currency}</Text>
              </View>
              <Pressable
                onPress={() => setBalancesVisible(true)}
                accessibilityLabel="Adjust cash balances"
                className="shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white p-1.5"
              >
                <SlidersHorizontal size={14} color="#6B7280" />
              </Pressable>
            </View>
          </View>
        </View>

        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-base font-bold text-neutral-900">Recent Activity</Text>
          <Pressable onPress={() => router.push('/dashboard/transactions')}>
            <Text className="text-xs font-bold" style={{ color: TEAL }}>
              View All
            </Text>
          </Pressable>
        </View>

        <View className="mb-6 rounded-[22px] border border-neutral-100 bg-white px-2 py-1">
          {activity.length === 0 ? (
            <Text className="py-6 text-center text-sm text-neutral-400">No activity yet this month.</Text>
          ) : (
            activity.map((item, index) => (
              <Pressable
                key={`${item.kind}-${item.id}`}
                onPress={() => {
                  if (item.kind === 'expense') {
                    const exp = (month.variableExpenses || []).find((e) => e.id === item.id);
                    if (exp && canEditArea('expenses')) {
                      setEditingExpense(exp);
                      setExpenseVisible(true);
                    }
                  } else {
                    router.push('/dashboard/savings');
                  }
                }}
                className="flex-row items-center px-1 py-3"
                style={index < activity.length - 1 ? { borderBottomWidth: 1, borderBottomColor: 'rgba(229,231,235,0.8)' } : undefined}
              >
                <View
                  className="mr-3 h-10 w-10 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: item.kind === 'savings' && item.isDeposit ? 'rgba(0,104,123,0.1)' : 'rgba(0,104,95,0.1)',
                  }}
                >
                  <CategoryIcon
                    name={item.icon}
                    size={20}
                    color={item.kind === 'savings' && item.isDeposit ? '#00687b' : TEAL}
                  />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="text-sm font-bold text-neutral-900" numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text className="mt-0.5 text-xs text-neutral-500">{item.meta}</Text>
                </View>
                <View className="ml-2 shrink-0 flex-row items-baseline">
                  <Text
                    className="text-sm font-bold font-mono"
                    style={{
                      fontFamily: FONT.monoBold,
                      color: item.isDeposit ? '#00687b' : '#171d1c',
                    }}
                  >
                    {item.isDeposit ? '+' : '-'}
                    {formatMoney(item.amount)}
                  </Text>
                  <Text className="ml-0.5 font-semibold text-neutral-500" style={{ fontSize: 10 }}>
                    {currency}
                  </Text>
                </View>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>

      <MoveMoneyModal
        visible={moveModalVisible}
        onClose={() => {
          setMoveModalVisible(false);
          setMoveFrom(undefined);
        }}
        month={month}
        currency={currency}
        places={moneyPlaces}
        initialFrom={moveFrom}
        onConfirm={handleMoveMoney}
      />
      <StrategyModal
        visible={strategyVisible}
        onClose={() => setStrategyVisible(false)}
        month={month}
        onUpdateMonth={updateMonth}
      />
      <EditBalancesModal
        visible={balancesVisible}
        onClose={() => setBalancesVisible(false)}
        month={month}
        currency={currency}
        places={moneyPlaces}
        onSave={async (values) => {
          await updateMonth(updateMoneyPlaces(month, values));
        }}
      />
      <ExpenseModal
        visible={expenseVisible}
        onClose={() => {
          setExpenseVisible(false);
          setEditingExpense(null);
        }}
        month={month}
        currency={currency}
        expenseToEdit={editingExpense}
        onSave={async (expense: VariableExpense) => {
          if (editingExpense) {
            await updateMonth(editVariableExpense(month, editingExpense, expense));
          } else {
            await updateMonth(addVariableExpense(month, expense));
          }
        }}
      />
      <FixedModal
        visible={fixedVisible}
        onClose={() => setFixedVisible(false)}
        month={month}
        currency={currency}
        onSave={async (expense: FixedExpense) => {
          await updateMonth(addFixedExpense(month, expense));
        }}
      />
      <SavingsGoalModal
        visible={savingsVisible}
        onClose={() => setSavingsVisible(false)}
        currency={currency}
        onSave={async (goal: SavingGoal, deductFromPlace) => {
          const res = saveGoalWithBalance(month, savingsGoals, goal, deductFromPlace ?? null);
          await updateMonth(res.month);
          await updateSavingsGoals(res.goals);
        }}
      />
    </View>
  );
}

function EnvelopeRow({
  color,
  label,
  used,
  left,
  right,
  pct,
}: {
  color: string;
  label: string;
  used: string;
  left: string;
  right: string;
  pct: number;
}) {
  return (
    <View className="mb-3">
      <View className="mb-1 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <View className="mr-1.5 h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
          <Text className="text-xs font-bold text-neutral-800">{label}</Text>
        </View>
        <Text className="text-[11px] font-semibold text-neutral-500">{used}</Text>
      </View>
      <View className="h-2.5 overflow-hidden rounded-full bg-primary/10">
        <View className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </View>
      <View className="mt-1 flex-row justify-between">
        <Text className="text-[11px] font-medium font-mono text-neutral-500" style={{ fontFamily: FONT.mono }}>
          {left}
        </Text>
        <Text className="text-[11px] font-medium font-mono text-neutral-500" style={{ fontFamily: FONT.mono }}>
          {right}
        </Text>
      </View>
    </View>
  );
}
