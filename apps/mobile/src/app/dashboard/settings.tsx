import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  exportMonthToCsv,
  type Language,
  LOCALES,
  LOCALE_NAMES,
  type VariableExpense,
  type FixedExpense,
} from '@flousy/core';
import { useMobileAuth } from '../../lib/auth-context';
import { useMobileStore } from '../../lib/store-context';
import { setAppLanguage } from '../../lib/i18n';
import { storage } from '../../lib/storage';
import { CurrencyModal } from '../../components/CurrencyModal';
import { ThemeModal } from '../../components/ThemeModal';
import { ImportCsvModal } from '../../components/ImportCsvModal';
import { IncomeSourcesModal } from '../../components/IncomeSourcesModal';
import { CategoriesModal } from '../../components/CategoriesModal';
import { HouseholdModal } from '../../components/HouseholdModal';
import { MoneyPlacesModal } from '../../components/MoneyPlacesModal';
import { StrategyModal } from '../../components/StrategyModal';
import { formatDayOfMonth, PRO_FEATURES, canShowProUpgrade } from '@flousy/core';

const BIOMETRIC_LOCK_KEY = 'flousy_biometric_enabled';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user, demoMode, deleteAccount } = useMobileAuth();
  const {
    currentMonthKey,
    month,
    savingsGoals,
    updateMonth,
    profile,
    updateProfile,
    isPro,
    scanUnlocked,
    workspace,
    currency,
  } = useMobileStore();

  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState<boolean>(() =>
    storage.getBoolean(BIOMETRIC_LOCK_KEY) ?? false
  );
  const [currencyState, setCurrencyState] = useState<string>(currency);
  const [exporting, setExporting] = useState(false);

  // Modals visibility state
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [incomeModalVisible, setIncomeModalVisible] = useState(false);
  const [categoriesModalVisible, setCategoriesModalVisible] = useState(false);
  const [householdVisible, setHouseholdVisible] = useState(false);
  const [placesVisible, setPlacesVisible] = useState(false);
  const [strategyVisible, setStrategyVisible] = useState(false);

  useEffect(() => {
    async function checkBiometrics() {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricsAvailable(compatible && enrolled);
    }
    checkBiometrics();
  }, []);

  const handleLanguageChange = (lang: Language) => {
    setAppLanguage(lang);
  };

  const handleToggleBiometric = async (val: boolean) => {
    if (val) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to enable biometric app lock',
      });
      if (!result.success) {
        Alert.alert('Authentication Failed', 'Could not verify biometrics.');
        return;
      }
    }
    storage.set(BIOMETRIC_LOCK_KEY, val);
    setBiometricEnabled(val);
  };

  const handleCurrencySelect = async (code: string) => {
    setCurrencyState(code);
    await updateProfile({ currency: code });
  };

  const handleImportVariable = async (newExpenses: VariableExpense[]) => {
    if (!month) return;
    const nextMonth = {
      ...month,
      variableExpenses: [...newExpenses, ...(month.variableExpenses || [])],
    };
    await updateMonth(nextMonth);
  };

  const handleImportFixed = async (newBills: FixedExpense[]) => {
    if (!month) return;
    const nextMonth = {
      ...month,
      fixedExpenses: [...newBills, ...(month.fixedExpenses || [])],
    };
    await updateMonth(nextMonth);
  };

  const handleExportCsv = async () => {
    if (!month) {
      Alert.alert('No Data', 'No budget data available for export.');
      return;
    }
    setExporting(true);
    try {
      const csvString = exportMonthToCsv(month, savingsGoals, currentMonthKey, currency);
      const fileUri = `${FileSystem.documentDirectory}flousy-${currentMonthKey}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csvString, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: `Export SmartJib Budget (${currentMonthKey})`,
        });
      } else {
        Alert.alert('Exported', `CSV file saved to ${fileUri}`);
      }
    } catch (err: any) {
      Alert.alert('Export Error', err?.message || 'Failed to export CSV.');
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account, all budget months, and savings goals. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount();
              router.replace('/login');
            } catch (err: any) {
              if (err?.code === 'auth/requires-recent-login') {
                Alert.alert(
                  'Re-authentication Required',
                  'Please sign out and sign back in to perform this permanent deletion.'
                );
              } else {
                Alert.alert('Error', err?.message || 'Failed to delete account.');
              }
            }
          },
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-neutral-100 dark:bg-neutral-900">
      <ScrollView contentContainerStyle={{ padding: 16 }} className="space-y-6">
        <Pressable onPress={() => router.push('/dashboard')} className="mb-3">
          <Text className="text-primary font-bold">← Overview</Text>
        </Pressable>
        <Text className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
          {t('tabs.settings', 'Profile & Settings')}
        </Text>
        <Text className="text-xs text-neutral-500 mb-4">
          {isPro ? 'Pro plan' : 'Free plan'} · {workspace} workspace
        </Text>

        <View className="bg-white dark:bg-neutral-800 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-700 mb-4 space-y-3">
          <Pressable
            onPress={() => router.push('/dashboard/trends')}
            className="flex-row justify-between items-center pb-3 border-b border-neutral-100 dark:border-neutral-700"
          >
            <View>
              <Text className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                Trends & analytics
              </Text>
              <Text className="text-xs text-neutral-500">
                {scanUnlocked ? '6-month history and envelope health' : 'Pro feature — unlock to view'}
              </Text>
            </View>
            <Text className="text-primary font-bold text-xs">Open</Text>
          </Pressable>
          <Pressable onPress={() => setHouseholdVisible(true)} className="flex-row justify-between items-center pt-3">
            <View>
              <Text className="text-sm font-bold text-neutral-800 dark:text-neutral-200">Household workspace</Text>
              <Text className="text-xs text-neutral-500">Shared budget, invites, contributor invoices</Text>
            </View>
            <Text className="text-primary font-bold text-xs">Open</Text>
          </Pressable>
          <Pressable onPress={() => setPlacesVisible(true)} className="flex-row justify-between items-center pt-3 border-t border-neutral-100 dark:border-neutral-700">
            <View>
              <Text className="text-sm font-bold text-neutral-800 dark:text-neutral-200">Money places</Text>
              <Text className="text-xs text-neutral-500">Bank, home, wallet, plus custom sources</Text>
            </View>
            <Text className="text-primary font-bold text-xs">Manage</Text>
          </Pressable>
          {month && (
            <Pressable onPress={() => setStrategyVisible(true)} className="flex-row justify-between items-center pt-3 border-t border-neutral-100 dark:border-neutral-700">
              <View>
                <Text className="text-sm font-bold text-neutral-800 dark:text-neutral-200">Budget strategy</Text>
                <Text className="text-xs text-neutral-500">Including custom needs/wants/savings split</Text>
              </View>
              <Text className="text-primary font-bold text-xs">Change</Text>
            </Pressable>
          )}
        </View>

        <View className="bg-white dark:bg-neutral-800 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-700 mb-4">
          <Text className="text-sm font-bold text-neutral-800 dark:text-neutral-200 mb-1">
            Month start date
          </Text>
          <Text className="text-xs text-neutral-500 mb-3">
            Currently the {formatDayOfMonth(profile?.monthStartDate || 1)}. The budget month flips on this payday.
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {[1, 5, 15, 25, 28].map((day) => (
              <Pressable
                key={day}
                onPress={() => updateProfile({ monthStartDate: day })}
                className={`px-3 py-2 rounded-xl border ${
                  (profile?.monthStartDate || 1) === day ? 'bg-primary border-primary' : 'border-neutral-200 dark:border-neutral-600'
                }`}
              >
                <Text className={(profile?.monthStartDate || 1) === day ? 'text-white text-xs font-bold' : 'text-neutral-700 dark:text-neutral-200 text-xs'}>
                  {formatDayOfMonth(day)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {canShowProUpgrade(isPro, workspace) && (
          <View className="bg-primary/10 p-4 rounded-2xl border border-primary/20 mb-4">
            <Text className="font-bold text-primary mb-1">Upgrade to Pro</Text>
            <Text className="text-xs text-neutral-600 dark:text-neutral-300 mb-3">
              Unlock barcode scanning, trends, CSV and household attribution.
            </Text>
            {PRO_FEATURES.map((feature) => (
              <Text key={feature.id} className="text-xs text-neutral-700 dark:text-neutral-300 mb-1">
                • {feature.title}
              </Text>
            ))}
            <Pressable
              onPress={() => updateProfile({ plan: 'pro' })}
              className="bg-primary py-3 rounded-xl items-center mt-3"
            >
              <Text className="text-white font-bold">Unlock Pro (demo)</Text>
            </Pressable>
          </View>
        )}

        {isPro && (
          <View className="bg-white dark:bg-neutral-800 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-700 mb-4">
            <Text className="font-bold text-neutral-900 dark:text-white mb-2">Pro features</Text>
            {PRO_FEATURES.map((feature) => (
              <Text key={feature.id} className="text-xs text-neutral-600 dark:text-neutral-300 mb-1">
                ✓ {feature.title}
              </Text>
            ))}
          </View>
        )}

        {/* Currency & Appearance */}
        <View className="bg-white dark:bg-neutral-800 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-700 space-y-4">
          <View className="flex-row justify-between items-center pb-3 border-b border-neutral-100 dark:border-neutral-700">
            <View>
              <Text className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                Currency
              </Text>
              <Text className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Active: {currency}
              </Text>
            </View>
            <Pressable
              onPress={() => setCurrencyModalVisible(true)}
              className="bg-primary/10 px-3.5 py-1.5 rounded-xl border border-primary/20"
            >
              <Text className="text-xs font-bold text-primary">Change Currency</Text>
            </Pressable>
          </View>

          <View className="flex-row justify-between items-center">
            <View>
              <Text className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                Appearance Theme
              </Text>
              <Text className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Light, Dark, or System mode
              </Text>
            </View>
            <Pressable
              onPress={() => setThemeModalVisible(true)}
              className="bg-neutral-100 dark:bg-neutral-700 px-3.5 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-600"
            >
              <Text className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                Theme Setup
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Language Selection */}
        <View className="bg-white dark:bg-neutral-800 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-700">
          <Text className="text-sm font-bold text-neutral-800 dark:text-neutral-200 mb-3">
            Language & RTL
          </Text>
          <View className="flex-row space-x-2">
            {LOCALES.map((lang) => {
              const active = i18n.language === lang;
              return (
                <Pressable
                  key={lang}
                  onPress={() => handleLanguageChange(lang)}
                  className={`flex-1 py-2.5 rounded-xl items-center border ${
                    active
                      ? 'bg-primary border-primary'
                      : 'bg-neutral-100 dark:bg-neutral-700 border-neutral-200 dark:border-neutral-600'
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      active ? 'text-white' : 'text-neutral-800 dark:text-neutral-200'
                    }`}
                  >
                    {LOCALE_NAMES[lang]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Budget Plan & Categories */}
        {month && (
          <View className="bg-white dark:bg-neutral-800 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-700 space-y-4">
            <View className="flex-row justify-between items-center pb-3 border-b border-neutral-100 dark:border-neutral-700">
              <View>
                <Text className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                  Income Sources & Streams
                </Text>
                <Text className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Total Month Income: {month.totalBudget} {currency}
                </Text>
              </View>
              <Pressable
                onPress={() => setIncomeModalVisible(true)}
                className="bg-primary/10 px-3.5 py-1.5 rounded-xl border border-primary/20"
              >
                <Text className="text-xs font-bold text-primary">Manage</Text>
              </Pressable>
            </View>

            <View className="flex-row justify-between items-center">
              <View>
                <Text className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                  Custom Expense Categories
                </Text>
                <Text className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {(month.activeCategories || []).length || 8} active categories
                </Text>
              </View>
              <Pressable
                onPress={() => setCategoriesModalVisible(true)}
                className="bg-neutral-100 dark:bg-neutral-700 px-3.5 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-600"
              >
                <Text className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                  Customize
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Security / Biometrics */}
        <View className="bg-white dark:bg-neutral-800 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-700">
          <View className="flex-row justify-between items-center">
            <View>
              <Text className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                Biometric App-Lock
              </Text>
              <Text className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Require Face ID / Fingerprint to open SmartJib
              </Text>
            </View>
            <Switch
              value={biometricEnabled}
              disabled={!biometricsAvailable}
              onValueChange={handleToggleBiometric}
            />
          </View>
        </View>

        {/* Data Import & Export */}
        <View className="bg-white dark:bg-neutral-800 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-700 space-y-3">
          <Text className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
            Data Import & Export
          </Text>

          <Pressable
            onPress={() => setImportModalVisible(true)}
            className="w-full bg-neutral-100 dark:bg-neutral-700 py-3 rounded-xl items-center border border-neutral-200 dark:border-neutral-600"
          >
            <Text className="text-neutral-800 dark:text-neutral-200 font-semibold text-sm">
              + Import Transactions (CSV)
            </Text>
          </Pressable>

          <Pressable
            onPress={handleExportCsv}
            disabled={exporting}
            className="w-full bg-neutral-900 dark:bg-white py-3 rounded-xl items-center"
          >
            {exporting ? (
              <ActivityIndicator color="#2ea44f" />
            ) : (
              <Text className="text-white dark:text-neutral-900 font-semibold text-sm">
                Export Current Month (CSV)
              </Text>
            )}
          </Pressable>
        </View>

        {/* Account Deletion (Apple App Store Guideline 5.1.1(v)) */}
        <View className="bg-white dark:bg-neutral-800 p-4 rounded-2xl border border-red-200 dark:border-red-900/50">
          <Text className="text-sm font-bold text-red-600 mb-1">Danger Zone</Text>
          <Text className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
            Permanently delete your account and wipe all stored financial data.
          </Text>
          <Pressable
            onPress={handleDeleteAccount}
            className="bg-red-500 py-3 rounded-xl items-center"
          >
            <Text className="text-white font-semibold text-sm">
              Delete Account Permanently
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Modals */}
      <CurrencyModal
        visible={currencyModalVisible}
        onClose={() => setCurrencyModalVisible(false)}
        selectedCurrency={currency}
        onSelect={handleCurrencySelect}
      />

      <ThemeModal
        visible={themeModalVisible}
        onClose={() => setThemeModalVisible(false)}
      />

      {month && (
        <>
          <ImportCsvModal
            visible={importModalVisible}
            onClose={() => setImportModalVisible(false)}
            month={month}
            onImportVariable={handleImportVariable}
            onImportFixed={handleImportFixed}
          />
          <IncomeSourcesModal
            visible={incomeModalVisible}
            onClose={() => setIncomeModalVisible(false)}
            month={month}
            currency={currency}
            onUpdateMonth={updateMonth}
          />
          <CategoriesModal
            visible={categoriesModalVisible}
            onClose={() => setCategoriesModalVisible(false)}
            month={month}
            onUpdateMonth={updateMonth}
          />
          <StrategyModal
            visible={strategyVisible}
            onClose={() => setStrategyVisible(false)}
            month={month}
            onUpdateMonth={updateMonth}
          />
        </>
      )}
      <HouseholdModal visible={householdVisible} onClose={() => setHouseholdVisible(false)} />
      <MoneyPlacesModal visible={placesVisible} onClose={() => setPlacesVisible(false)} />
    </View>
  );
}
