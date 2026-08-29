'use client';

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
import { trackEvent } from '@/lib/analytics';

import { ExpenseModal } from '@/components/modals/ExpenseModal';
import { MoveMoneyModal } from '@/components/modals/MoveMoneyModal';
import { FixedModal } from '@/components/modals/FixedModal';
import { SavingsModal } from '@/components/modals/SavingsModal';
import { SavingsDepositModal } from '@/components/modals/SavingsDepositModal';
import { SettingsModal } from '@/components/modals/SettingsModal';
import { ManageCategoriesModal } from '@/components/modals/ManageCategoriesModal';
import { ProUpgradeModal } from '@/components/modals/ProUpgradeModal';
import { ImportCsvModal } from '@/components/modals/ImportCsvModal';
import { IncomeSourcesModal } from '@/components/modals/IncomeSourcesModal';
import { EditMoneyPlacesModal } from '@/components/modals/EditMoneyPlacesModal';
import { DebtModal } from '@/components/modals/DebtModal';

/**
 * All dashboard modals, wired to the shared dashboard state so every screen
 * (page) can open them without duplicating any logic.
 */
export function DashboardModals() {
  const dashboard = useDashboard();
  const { places } = useMoneyPlaces(dashboard.month);
  const placeBalances = placeBalancesOf(dashboard.month, places);
  const {
    month,
    goals,
    currentMonthKey,
    updateAndSaveMonth,
    updateAndSaveGoals,
    handleEditMoneyPlaces,
    handleAddCategory,
    handleRemoveCategory,
    handleSaveIncomeSources,
    handleBatchImportVariable,
    handleBatchImportFixed,
  } = dashboard;

  // Expense handlers
  const handleSaveVariableExpense = (exp: VariableExpense) => {
    const audited = { ...exp, createdByUserId: dashboard.selectedExpense?.createdByUserId || dashboard.user?.uid, updatedByUserId: dashboard.user?.uid };
    if (dashboard.selectedExpense) {
      const updated = editVariableExpense(month, dashboard.selectedExpense, audited);
      updateAndSaveMonth(updated);
      trackEvent('edit_variable_expense', { category: exp.type, amount: exp.amount });
    } else {
      const updated = addVariableExpense(month, audited);
      updateAndSaveMonth(updated);
      trackEvent('add_variable_expense', { category: exp.type, amount: exp.amount });
    }
  };

  const handleDeleteVariableExpense = (exp: VariableExpense) => {
    const updated = deleteVariableExpense(month, exp);
    updateAndSaveMonth(updated);
    trackEvent('delete_variable_expense', { category: exp.type });
  };

  // Fixed bills handlers
  const handleSaveFixedBill = (bill: FixedExpense) => {
    const audited = { ...bill, createdByUserId: dashboard.selectedFixed?.createdByUserId || dashboard.user?.uid, updatedByUserId: dashboard.user?.uid };
    if (dashboard.selectedFixed) {
      const updated = editFixedExpense(month, dashboard.selectedFixed, audited);
      updateAndSaveMonth(updated);
      trackEvent('edit_fixed_expense', { category: bill.type, amount: bill.amount });
    } else {
      const updated = addFixedExpense(month, audited);
      updateAndSaveMonth(updated);
      trackEvent('add_fixed_expense', { category: bill.type, amount: bill.amount });
    }
  };

  const handleDeleteFixedBill = (bill: FixedExpense) => {
    const updated = deleteFixedExpense(month, bill);
    updateAndSaveMonth(updated);
    trackEvent('delete_fixed_expense', { category: bill.type });
  };

  // Retype existing bills when a custom fixed category is renamed
  const handleRenameFixedCategory = (oldName: string, newName: string) => {
    const updated = renameFixedCategory(month, oldName, newName);
    if (updated !== month) updateAndSaveMonth(updated);
  };

  // Move money handler
  const handleMoveMoney = (from: MoneyPlace, to: MoneyPlace, amount: number) => {
    const updated = moveMoney(month, from, to, amount);
    updateAndSaveMonth(updated);
    trackEvent('move_money', { from, to, amount });
  };

  // Savings handlers
  const handleSaveGoal = (goal: SavingGoal, deductFromPlace?: MoneyPlace | null) => {
    // Moves the goal's opening/edited balance out of the chosen money place
    // when the transfer checkbox was checked, and tracks how much of the
    // balance is real deposited money (vs. bookkeeping "already saved").
    const res = saveGoalWithBalance(month, goals, goal, deductFromPlace ?? null);
    if (res.month !== month) updateAndSaveMonth(res.month);
    updateAndSaveGoals(res.goals);
  };

  const handleFundGoal = (goalId: string, amount: number, sourcePlace: MoneyPlace) => {
    const res = fundGoal(month, goals, goalId, amount, sourcePlace);
    updateAndSaveMonth(res.month);
    updateAndSaveGoals(res.goals);
    trackEvent('fund_goal', { amount, sourcePlace });
  };

  const handleWithdrawGoal = (goalId: string, amount: number, targetPlace: MoneyPlace) => {
    const res = withdrawGoal(month, goals, goalId, amount, targetPlace);
    updateAndSaveMonth(res.month);
    updateAndSaveGoals(res.goals);
    trackEvent('withdraw_goal', { amount, targetPlace });
  };

  const handleDeleteGoal = (goalId: string) => {
    const res = deleteFundedGoal(month, goals, goalId);
    updateAndSaveMonth(res.month);
    updateAndSaveGoals(res.goals);
  };

  // Debt handlers
  const handleSaveDebt = (debt: DebtItem) => {
    const existingIdx = (month.debts || []).findIndex((d) => d.id === debt.id);
    const next = existingIdx >= 0 ? editDebt(month, debt.id, debt) : addDebt(month, debt);
    updateAndSaveMonth(next);
  };

  const handleDeleteDebt = (debtId: string) => {
    const next = deleteDebt(month, debtId);
    updateAndSaveMonth(next);
  };

  return (
    <>
      <ExpenseModal
        isOpen={dashboard.isExpenseModalOpen}
        onClose={dashboard.closeExpenseModal}
        onSave={handleSaveVariableExpense}
        onDelete={handleDeleteVariableExpense}
        initialExpense={dashboard.selectedExpense}
        categories={month.activeCategories || []}
        categoryColors={month.categoryColors}
        categoryIcons={month.categoryIcons}
        placeBalances={placeBalances}
      />

      <MoveMoneyModal
        isOpen={dashboard.isMoveMoneyModalOpen}
        onClose={dashboard.closeMoveMoneyModal}
        onMove={handleMoveMoney}
        month={month}
      />

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
        onRenameCategory={handleRenameFixedCategory}
      />

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
      />

      <SavingsDepositModal
        isOpen={dashboard.isSavingsEntryModalOpen}
        onClose={dashboard.closeSavingsEntryModal}
        entry={dashboard.selectedSavingsEntry}
        goals={goals}
        placeBalances={placeBalances}
        onSave={dashboard.handleSaveSavingsEntry}
        onDelete={dashboard.handleDeleteSavingsEntry}
      />

      <SettingsModal
        isOpen={dashboard.isSettingsModalOpen}
        onClose={dashboard.closeSettingsModal}
        month={month}
        goals={goals}
        monthKey={currentMonthKey}
        onOpenProModal={() => {
          dashboard.closeSettingsModal();
          dashboard.openProModal();
        }}
      />

      <EditMoneyPlacesModal
        isOpen={dashboard.isEditMoneyPlacesOpen}
        onClose={dashboard.closeEditMoneyPlaces}
        initialValues={placeBalances}
        totalBudget={month.totalBudget || 0}
        onSave={(values) => {
          handleEditMoneyPlaces(values);
          dashboard.closeEditMoneyPlaces();
        }}
      />

      <ManageCategoriesModal
        isOpen={dashboard.isManageCategoriesOpen}
        onClose={dashboard.closeManageCategories}
        categories={month.activeCategories || []}
        categoryColors={month.categoryColors || {}}
        categoryIcons={month.categoryIcons || {}}
        onAddCategory={handleAddCategory}
        onRemoveCategory={handleRemoveCategory}
      />

      <ProUpgradeModal isOpen={dashboard.isProModalOpen} onClose={dashboard.closeProModal} />

      <ImportCsvModal
        isOpen={dashboard.isCsvModalOpen}
        onClose={dashboard.closeCsvModal}
        month={month}
        onImportVariable={handleBatchImportVariable}
        onImportFixed={handleBatchImportFixed}
      />

      <IncomeSourcesModal
        isOpen={dashboard.isIncomeModalOpen}
        onClose={dashboard.closeIncomeModal}
        month={month}
        monthKey={currentMonthKey}
        defaultPayDay={dashboard.profile?.monthStartDate}
        onSaveIncomeSources={handleSaveIncomeSources}
      />

      <DebtModal
        isOpen={dashboard.isDebtModalOpen}
        onClose={dashboard.closeDebtModal}
        onSave={handleSaveDebt}
        onDelete={handleDeleteDebt}
        initialDebt={dashboard.selectedDebt}
      />
    </>
  );
}
