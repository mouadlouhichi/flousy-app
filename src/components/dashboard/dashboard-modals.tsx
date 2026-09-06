'use client';

import dynamic from 'next/dynamic';
import { useDashboard } from './dashboard-provider';
import {
  VariableExpense,
  FixedExpense,
  SavingGoal,
  MoneyPlace,
  DebtItem,
  addVariableExpense,
  editVariableExpense,
  deleteVariableExpense,
  addFixedExpense,
  editFixedExpense,
  deleteFixedExpense,
  moveMoney,
  fundGoal,
  withdrawGoal,
  saveGoalWithBalance,
  deleteFundedGoal,
  addDebt,
  editDebt,
  deleteDebt,
  renameFixedCategory,
  placeBalancesOf,
} from '@/lib/store';
import { useMoneyPlaces } from '@/lib/use-money-places';
import { useHousehold } from '@/lib/household-context';
import { trackEvent } from '@/lib/analytics';

/**
 * All dashboards modals are code-split AND mounted only while open.
 * Previously every modal (forms, date pickers, CSV parser, ~hundreds of KB)
 * was in the initial dashboard chunk, so even the first screen of the app
 * downloaded and parsed all of them. With this, a user who never opens a
 * modal never pays for its JavaScript.
 */
const ExpenseModal = dynamic(
  () => import('@/components/modals/ExpenseModal').then((m) => m.ExpenseModal),
  { ssr: false, loading: () => null },
);
const MoveMoneyModal = dynamic(
  () => import('@/components/modals/MoveMoneyModal').then((m) => m.MoveMoneyModal),
  { ssr: false, loading: () => null },
);
const FixedModal = dynamic(
  () => import('@/components/modals/FixedModal').then((m) => m.FixedModal),
  { ssr: false, loading: () => null },
);
const SavingsModal = dynamic(
  () => import('@/components/modals/SavingsModal').then((m) => m.SavingsModal),
  { ssr: false, loading: () => null },
);
const SavingsDepositModal = dynamic(
  () => import('@/components/modals/SavingsDepositModal').then((m) => m.SavingsDepositModal),
  { ssr: false, loading: () => null },
);
const SettingsModal = dynamic(
  () => import('@/components/modals/SettingsModal').then((m) => m.SettingsModal),
  { ssr: false, loading: () => null },
);
const ProUpgradeModal = dynamic(
  () => import('@/components/modals/ProUpgradeModal').then((m) => m.ProUpgradeModal),
  { ssr: false, loading: () => null },
);
const ImportCsvModal = dynamic(
  () => import('@/components/modals/ImportCsvModal').then((m) => m.ImportCsvModal),
  { ssr: false, loading: () => null },
);
const IncomeSourcesModal = dynamic(
  () => import('@/components/modals/IncomeSourcesModal').then((m) => m.IncomeSourcesModal),
  { ssr: false, loading: () => null },
);
const EditMoneyPlacesModal = dynamic(
  () => import('@/components/modals/EditMoneyPlacesModal').then((m) => m.EditMoneyPlacesModal),
  { ssr: false, loading: () => null },
);
const DebtModal = dynamic(
  () => import('@/components/modals/DebtModal').then((m) => m.DebtModal),
  { ssr: false, loading: () => null },
);

/**
 * All dashboard modals, wired to the shared dashboard state so every screen
 * (page) can open them without duplicating any logic.
 */
export function DashboardModals() {
  const dashboard = useDashboard();
  const { canEditArea, canViewArea, workspace, members } = useHousehold();
  // Income is viewable in read-only mode: the modal shows the sources without
  // any affordance that would write them.
  const incomeReadOnly = !canEditArea('income');
  // Expense / bill / savings editors quote the source place's balance in their
  // hints and in insufficient-funds errors, so those strings are suppressed for
  // a member who may edit but not see `balances`.
  const canSeeBalances = canViewArea('balances');
  const { places } = useMoneyPlaces(dashboard.month);
  const placeBalances = placeBalancesOf(dashboard.month, places);
  const {
    month,
    goals,
    currentMonthKey,
    updateAndSaveMonth,
    updateAndSaveFinance,
    handleEditMoneyPlaces,
    handleAddCategory,
    handleSaveIncomeSources,
    handleBatchImportVariable,
    handleBatchImportFixed,
  } = dashboard;

  // Expense handlers
  const handleSaveVariableExpense = (exp: VariableExpense) => {
    const audited = { ...exp, createdByUserId: dashboard.selectedExpense?.createdByUserId || dashboard.user?.uid, updatedByUserId: dashboard.user?.uid };
    if (dashboard.selectedExpense) {
      const updated = editVariableExpense(month, dashboard.selectedExpense, audited);
      updateAndSaveMonth(updated, 'expenses');
      trackEvent('edit_variable_expense');
    } else {
      const updated = addVariableExpense(month, audited);
      updateAndSaveMonth(updated, 'expenses');
      trackEvent('add_variable_expense');
    }
  };

  const handleDeleteVariableExpense = (exp: VariableExpense) => {
    const updated = deleteVariableExpense(month, exp);
    updateAndSaveMonth(updated, 'expenses');
    trackEvent('delete_variable_expense');
  };

  // Fixed bills handlers
  const handleSaveFixedBill = (bill: FixedExpense) => {
    const audited = { ...bill, createdByUserId: dashboard.selectedFixed?.createdByUserId || dashboard.user?.uid, updatedByUserId: dashboard.user?.uid };
    if (dashboard.selectedFixed) {
      const updated = editFixedExpense(month, dashboard.selectedFixed, audited);
      updateAndSaveMonth(updated, 'fixedBills');
      trackEvent('edit_fixed_expense');
    } else {
      const updated = addFixedExpense(month, audited);
      updateAndSaveMonth(updated, 'fixedBills');
      trackEvent('add_fixed_expense');
    }
  };

  const handleDeleteFixedBill = (bill: FixedExpense) => {
    const updated = deleteFixedExpense(month, bill);
    updateAndSaveMonth(updated, 'fixedBills');
    trackEvent('delete_fixed_expense');
  };

  // Retype existing bills when a custom fixed category is renamed
  const handleRenameFixedCategory = (oldName: string, newName: string) => {
    const updated = renameFixedCategory(month, oldName, newName);
    if (updated !== month) updateAndSaveMonth(updated, 'fixedBills');
  };

  // Move money handler
  const handleMoveMoney = (from: MoneyPlace, to: MoneyPlace, amount: number) => {
    const updated = moveMoney(month, from, to, amount, dashboard.user?.uid);
    updateAndSaveMonth(updated, 'balances');
    trackEvent('move_money');
  };

  // Savings handlers — in a household every deposit is attributed to the
  // member who made it so the goal card can show who contributed what.
  const goalActor = workspace === 'household' && dashboard.user
    ? {
        memberId: members.find((mem) => mem.userId === dashboard.user?.uid || mem.id === dashboard.user?.uid)?.id || dashboard.user.uid,
        name: members.find((mem) => mem.userId === dashboard.user?.uid || mem.id === dashboard.user?.uid)?.displayName
          || dashboard.profile?.displayName || undefined,
      }
    : undefined;
  const handleSaveGoal = (goal: SavingGoal, deductFromPlace?: MoneyPlace | null) => {
    // Moves the goal's opening/edited balance out of the chosen money place
    // when the transfer checkbox was checked, and tracks how much of the
    // balance is real deposited money (vs. bookkeeping "already saved").
    const res = saveGoalWithBalance(month, goals, goal, deductFromPlace ?? null);
    updateAndSaveFinance(res.month, res.goals);
  };

  const handleFundGoal = (goalId: string, amount: number, sourcePlace: MoneyPlace) => {
    const res = fundGoal(month, goals, goalId, amount, sourcePlace, goalActor);
    updateAndSaveFinance(res.month, res.goals);
    trackEvent('fund_goal');
  };

  const handleWithdrawGoal = (goalId: string, amount: number, targetPlace: MoneyPlace) => {
    const res = withdrawGoal(month, goals, goalId, amount, targetPlace, goalActor);
    updateAndSaveFinance(res.month, res.goals);
    trackEvent('withdraw_goal');
  };

  const handleDeleteGoal = (goalId: string) => {
    const res = deleteFundedGoal(month, goals, goalId);
    updateAndSaveFinance(res.month, res.goals);
  };

  // Debt handlers
  const handleSaveDebt = (debt: DebtItem) => {
    const existingIdx = (month.debts || []).findIndex((d) => d.id === debt.id);
    const next = existingIdx >= 0 ? editDebt(month, debt.id, debt) : addDebt(month, debt);
    updateAndSaveMonth(next, 'debts');
  };

  const handleDeleteDebt = (debtId: string) => {
    const next = deleteDebt(month, debtId);
    updateAndSaveMonth(next, 'debts');
  };

  return (
    <>
      {dashboard.isExpenseModalOpen && (
        <ExpenseModal
          isOpen={dashboard.isExpenseModalOpen}
          onClose={dashboard.closeExpenseModal}
          onSave={handleSaveVariableExpense}
          onDelete={handleDeleteVariableExpense}
          initialExpense={dashboard.selectedExpense}
          categories={month.activeCategories || []}
          history={month.variableExpenses || []}
          prefill={dashboard.expensePrefill}
          categoryColors={month.categoryColors}
          categoryIcons={month.categoryIcons}
          onAddCategory={canEditArea('settings') ? handleAddCategory : undefined}
          placeBalances={placeBalances}
          periodStartDate={month.periodStartDate}
          periodEndDate={month.periodEndDate}
          canSeeBalances={canSeeBalances}
        />
      )}

      {dashboard.isMoveMoneyModalOpen && (
        <MoveMoneyModal
          isOpen={dashboard.isMoveMoneyModalOpen}
          onClose={dashboard.closeMoveMoneyModal}
          onMove={handleMoveMoney}
          month={month}
        />
      )}

      {dashboard.isFixedModalOpen && (
        <FixedModal
          isOpen={dashboard.isFixedModalOpen}
          onClose={dashboard.closeFixedModal}
          onSave={handleSaveFixedBill}
          onDelete={handleDeleteFixedBill}
          initialBill={dashboard.selectedFixed}
          categories={month.activeCategories || []}
          categoryColors={month.categoryColors || {}}
          categoryIcons={month.categoryIcons || {}}
          placeBalances={placeBalances}
          canSeeBalances={canSeeBalances}
          onRenameCategory={handleRenameFixedCategory}
        />
      )}

      {dashboard.isSavingsModalOpen && (
        <SavingsModal
          isOpen={dashboard.isSavingsModalOpen}
          onClose={dashboard.closeSavingsModal}
          mode={dashboard.savingsModalMode}
          goal={dashboard.selectedGoal}
          onSaveGoal={handleSaveGoal}
          onFund={handleFundGoal}
          onWithdraw={handleWithdrawGoal}
          onDelete={handleDeleteGoal}
          placeBalances={placeBalances}
          canSeeBalances={canSeeBalances}
        />
      )}

      {dashboard.isSavingsEntryModalOpen && (
        <SavingsDepositModal
          isOpen={dashboard.isSavingsEntryModalOpen}
          onClose={dashboard.closeSavingsEntryModal}
          entry={dashboard.selectedSavingsEntry}
          goals={goals}
          placeBalances={placeBalances}
          canSeeBalances={canSeeBalances}
          onSave={dashboard.handleSaveSavingsEntry}
          onDelete={dashboard.handleDeleteSavingsEntry}
        />
      )}

      {dashboard.isSettingsModalOpen && (
        <SettingsModal
          isOpen={dashboard.isSettingsModalOpen}
          onClose={dashboard.closeSettingsModal}
          onOpenProModal={() => {
            dashboard.closeSettingsModal();
            dashboard.openProModal();
          }}
        />
      )}

      {dashboard.isEditMoneyPlacesOpen && (
        <EditMoneyPlacesModal
          isOpen={dashboard.isEditMoneyPlacesOpen}
          onClose={dashboard.closeEditMoneyPlaces}
          initialValues={placeBalances}
          totalBudget={month.totalBudget || 0}
          onSave={(values, note) => {
            handleEditMoneyPlaces(values, note);
            dashboard.closeEditMoneyPlaces();
          }}
        />
      )}

      {dashboard.isProModalOpen && <ProUpgradeModal isOpen onClose={dashboard.closeProModal} />}

      {dashboard.isCsvModalOpen && (
        <ImportCsvModal
          isOpen={dashboard.isCsvModalOpen}
          onClose={dashboard.closeCsvModal}
          month={month}
          onImportVariable={handleBatchImportVariable}
          onImportFixed={handleBatchImportFixed}
        />
      )}

      {dashboard.isIncomeModalOpen && (
        <IncomeSourcesModal
          isOpen={dashboard.isIncomeModalOpen}
          onClose={dashboard.closeIncomeModal}
          month={month}
          monthKey={currentMonthKey}
          defaultPayDay={month.periodStartDay}
          onSaveIncomeSources={handleSaveIncomeSources}
          readOnly={incomeReadOnly}
        />
      )}

      {dashboard.isDebtModalOpen && (
        <DebtModal
          isOpen={dashboard.isDebtModalOpen}
          onClose={dashboard.closeDebtModal}
          onSave={handleSaveDebt}
          onDelete={handleDeleteDebt}
          initialDebt={dashboard.selectedDebt}
        />
      )}
    </>
  );
}
