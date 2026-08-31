import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
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
} from 'lucide-react-native';
import {
  addFixedExpense,
  addVariableExpense,
  calculateEnvelopeAmounts,
  calculateEnvelopeSpent,
  calculateMonthlyDepositedSavings,
  formatShortDate,
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
import { QuickAddFab } from '../../components/QuickAddFab';
import { formatMoney } from '../../lib/format-money';

const TEAL = '#026462';
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

  useBudgetNotifications(month, currency);

  const activity = useMemo(() => {
    if (!month) return [];
    const vars = (month.variableExpenses || []).map((e) => ({
      id: e.id,
      name: e.name,
      meta: `${formatShortDate(e.date)} · ${e.type}`,
      amount: -e.amount,
      date: e.date,
    }));
    const sav = (month.savingsActivity || []).map((e) => ({
      id: e.id,
      name: e.goalName,
      meta: `${e.type === 'deposit' ? 'Deposit' : 'Withdraw'} · Savings`,
      amount: e.type === 'deposit' ? e.amount : -e.amount,
      date: e.date,
    }));
    return [...vars, ...sav]
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 8);
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

  return (
    <View className="flex-1 bg-[#F5FAF8]">
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }} className="px-4 pt-2">
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
            <View
              key={place.id}
              className="mb-2.5 flex-row items-center rounded-[22px] border border-neutral-100 bg-white px-3.5 py-3.5"
            >
              <View
                className="mr-3 h-11 w-11 items-center justify-center rounded-2xl"
                style={{ backgroundColor: style.bg }}
              >
                <Icon size={20} color="#fff" />
              </View>
              <View className="flex-1">
                <Text className="text-[13px] font-semibold text-neutral-800">{place.name}</Text>
                <Text className="text-[18px] font-extrabold text-neutral-900">
                  {formatMoney(balance)}{' '}
                  <Text className="text-xs font-bold text-neutral-400">{currency}</Text>
                </Text>
              </View>
              <Pressable
                onPress={() => setMoveModalVisible(true)}
                className="flex-row items-center"
              >
                <Text className="mr-1 text-sm font-bold" style={{ color: style.accent }}>
                  Move
                </Text>
                <ArrowUpDown size={16} color={style.accent} />
              </Pressable>
            </View>
          );
        })}

        <View className="mb-2.5 rounded-[22px] border border-neutral-100 bg-white p-4">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-base font-extrabold text-neutral-900">Budget Plan</Text>
            <Pressable
              onPress={() => setStrategyVisible(true)}
              className="flex-row items-center rounded-full border border-neutral-200 bg-[#F5FAF8] px-2.5 py-1.5"
            >
              <Box size={14} color={TEAL} />
              <Text className="mx-1.5 text-[11px] font-extrabold uppercase text-neutral-700">
                {strategy.name}
              </Text>
              <ChevronDown size={14} color="#6B7280" />
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

        <View className="mb-5 rounded-[22px] border border-neutral-100 bg-white p-4">
          <Text className="text-[11px] font-extrabold uppercase tracking-wider text-neutral-400">
            Total monthly budget
          </Text>
          <View className="mb-3 flex-row items-center">
            <Text className="text-[28px] font-extrabold text-neutral-900">
              {formatMoney(month.totalBudget)}
            </Text>
            <Text className="ml-1 text-sm font-bold text-neutral-400">{currency}</Text>
          </View>
          <View className="flex-row items-end justify-between">
            <View>
              <Text className="text-[11px] font-extrabold uppercase tracking-wider text-neutral-400">
                Total cash on hand
              </Text>
              <Text className="text-[22px] font-extrabold text-neutral-900">
                {formatMoney(totalCash)}{' '}
                <Text className="text-sm font-bold text-neutral-400">{currency}</Text>
              </Text>
            </View>
            <Pressable
              onPress={() => setBalancesVisible(true)}
              className="h-9 w-9 items-center justify-center rounded-full bg-[#E7F3F1]"
            >
              <Pencil size={16} color={TEAL} />
            </Pressable>
          </View>
        </View>

        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-base font-extrabold text-neutral-900">Recent Activity</Text>
          <Pressable onPress={() => router.push('/dashboard/transactions')}>
            <Text className="text-sm font-bold" style={{ color: TEAL }}>
              View all
            </Text>
          </Pressable>
        </View>

        <View className="mb-6 rounded-[22px] border border-neutral-100 bg-white px-3 py-1">
          {activity.length === 0 ? (
            <Text className="py-6 text-center text-sm text-neutral-400">No activity yet this month.</Text>
          ) : (
            activity.map((item) => (
              <View key={item.id} className="flex-row items-center border-b border-neutral-100 py-3 last:border-b-0">
                <View className="mr-3 h-10 w-10 items-center justify-center rounded-2xl bg-[#E7F3F1]">
                  <Wallet size={16} color={TEAL} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-neutral-900">{item.name}</Text>
                  <Text className="text-xs text-neutral-400">{item.meta}</Text>
                </View>
                <Text
                  className="text-sm font-bold"
                  style={{ color: item.amount >= 0 ? TEAL : '#111827' }}
                >
                  {item.amount >= 0 ? '+' : ''}
                  {formatMoney(item.amount)} {currency}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <QuickAddFab
        onAction={(id) => {
          if (id === 'courses') router.push('/dashboard/courses');
          else if (id === 'expense' && canEditArea('expenses')) setExpenseVisible(true);
          else if (id === 'charge' && canEditArea('fixedBills')) setFixedVisible(true);
          else if (id === 'savings' && canEditArea('savings')) setSavingsVisible(true);
        }}
      />

      <MoveMoneyModal
        visible={moveModalVisible}
        onClose={() => setMoveModalVisible(false)}
        month={month}
        currency={currency}
        places={moneyPlaces}
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
        onClose={() => setExpenseVisible(false)}
        month={month}
        currency={currency}
        onSave={async (expense: VariableExpense) => {
          await updateMonth(addVariableExpense(month, expense));
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
          <Text className="text-[13px] font-semibold text-neutral-800">{label}</Text>
        </View>
        <Text className="text-[11px] font-semibold text-neutral-400">{used}</Text>
      </View>
      <View className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
        <View className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </View>
      <View className="mt-1 flex-row justify-between">
        <Text className="text-[11px] text-neutral-400">{left}</Text>
        <Text className="text-[11px] text-neutral-400">{right}</Text>
      </View>
    </View>
  );
}
