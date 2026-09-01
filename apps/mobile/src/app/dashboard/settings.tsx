import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  Switch,
  ActivityIndicator,
  Image,
} from 'react-native';
import { DashboardScrollView as ScrollView } from '../../components/DashboardScrollView';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  ChevronRight,
  SlidersHorizontal,
  Wallet,
  Package,
  Crown,
  TrendingUp,
  ScanLine,
  Banknote,
  Users,
  Database,
  LogOut,
} from 'lucide-react-native';
import {
  exportMonthToCsv,
  type Language,
  LOCALES,
  LOCALE_NAMES,
  type VariableExpense,
  type FixedExpense,
  formatDayOfMonth,
  PRO_FEATURES,
  canShowProUpgrade,
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

const TEAL = '#00685f';
const BIOMETRIC_LOCK_KEY = 'flousy_biometric_enabled';

function HubRow({
  icon: Icon,
  title,
  hint,
  onPress,
}: {
  icon: typeof SlidersHorizontal;
  title: string;
  hint: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center py-3.5">
      <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: 'rgba(0,104,95,0.1)' }}>
        <Icon size={20} color={TEAL} />
      </View>
      <View className="min-w-0 flex-1 pr-2">
        <Text className="text-sm font-bold text-neutral-900">{title}</Text>
        <Text className="mt-0.5 text-[11px] text-neutral-500" numberOfLines={1}>
          {hint}
        </Text>
      </View>
      <ChevronRight size={18} color="#9CA3AF" />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user, demoMode, deleteAccount, signOut } = useMobileAuth();
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
    moneyPlaces,
  } = useMobileStore();

  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState<boolean>(() => storage.getBoolean(BIOMETRIC_LOCK_KEY) ?? false);
  const [exporting, setExporting] = useState(false);
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [incomeModalVisible, setIncomeModalVisible] = useState(false);
  const [categoriesModalVisible, setCategoriesModalVisible] = useState(false);
  const [householdVisible, setHouseholdVisible] = useState(false);
  const [placesVisible, setPlacesVisible] = useState(false);
  const [strategyVisible, setStrategyVisible] = useState(false);

  useEffect(() => {
    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricsAvailable(compatible && enrolled);
    })();
  }, []);

  const displayName = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'SmartJib';
  const initial = displayName[0]?.toUpperCase() || 'S';
  const photo = user?.photoURL;

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

  const handleExportCsv = async () => {
    if (!month) {
      Alert.alert('No Data', 'No budget data available for export.');
      return;
    }
    setExporting(true);
    try {
      const csvString = exportMonthToCsv(month, savingsGoals, currentMonthKey, currency);
      const fileUri = `${FileSystem.documentDirectory}flousy-${currentMonthKey}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csvString, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
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
                Alert.alert('Re-authentication Required', 'Please sign out and sign back in to perform this permanent deletion.');
              } else {
                Alert.alert('Error', err?.message || 'Failed to delete account.');
              }
            }
          },
        },
      ],
    );
  };

  return (
    <View className="flex-1 bg-[#F5FAF8]">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <View className="mb-6 items-center">
          <View className="h-20 w-20 overflow-hidden rounded-full" style={{ backgroundColor: 'rgba(0,104,95,0.15)' }}>
            {photo ? (
              <Image source={{ uri: photo }} className="h-full w-full" />
            ) : (
              <View className="h-full w-full items-center justify-center">
                <Text className="text-2xl font-extrabold" style={{ color: TEAL }}>
                  {initial}
                </Text>
              </View>
            )}
          </View>
          <Text className="mt-3 text-xl font-extrabold text-neutral-900">{displayName}</Text>
          <Text className="mt-0.5 text-sm text-neutral-500">{user?.email || (demoMode ? 'Demo session' : '')}</Text>
          <View className="mt-2 rounded-full px-3 py-1" style={{ backgroundColor: isPro ? 'rgba(0,104,95,0.12)' : '#F3F4F6' }}>
            <Text className="text-[11px] font-bold" style={{ color: isPro ? TEAL : '#6B7280' }}>
              {isPro ? 'Pro plan' : 'Free plan'} · {workspace}
            </Text>
          </View>
        </View>

        <Text className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-neutral-500">Settings</Text>
        <View className="mb-5 rounded-3xl border border-neutral-200 bg-white px-4">
          <HubRow
            icon={SlidersHorizontal}
            title="Preferences"
            hint={`${currency} · ${LOCALE_NAMES[i18n.language as Language] || i18n.language} · ${formatDayOfMonth(profile?.monthStartDate || 1)}`}
            onPress={() => setCurrencyModalVisible(true)}
          />
          <View className="border-t border-neutral-100" />
          <HubRow
            icon={Wallet}
            title="Money sources"
            hint={`${moneyPlaces.length} location${moneyPlaces.length === 1 ? '' : 's'}`}
            onPress={() => setPlacesVisible(true)}
          />
        </View>

        <Text className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-neutral-500">Workspace</Text>
        <View className="mb-5 rounded-3xl border border-neutral-200 bg-white px-4">
          <HubRow icon={Package} title="Workspace" hint="Personal and household" onPress={() => setHouseholdVisible(true)} />
          <View className="border-t border-neutral-100" />
          <HubRow
            icon={Crown}
            title="SmartJib Pro"
            hint={isPro ? 'Plan, income & insights' : 'Unlock scan, trends & CSV'}
            onPress={() => (canShowProUpgrade(isPro, workspace) ? updateProfile({ plan: 'pro' }) : setIncomeModalVisible(true))}
          />
          <View className="border-t border-neutral-100" />
          <HubRow
            icon={TrendingUp}
            title="Analytics & insights"
            hint={scanUnlocked ? '6-month history and envelope health' : 'Pro feature'}
            onPress={() => router.push('/dashboard/trends')}
          />
          <View className="border-t border-neutral-100" />
          <HubRow
            icon={ScanLine}
            title="Course barcode scan"
            hint="Scan groceries as you shop"
            onPress={() => router.push('/dashboard/courses')}
          />
          <View className="border-t border-neutral-100" />
          <HubRow
            icon={Banknote}
            title="Income sources"
            hint={month ? `${month.totalBudget} ${currency}` : 'Manage streams'}
            onPress={() => setIncomeModalVisible(true)}
          />
          <View className="border-t border-neutral-100" />
          <HubRow icon={Users} title="Household" hint="Shared budget, invites, invoices" onPress={() => setHouseholdVisible(true)} />
        </View>

        <Text className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-neutral-500">Privacy & account</Text>
        <View className="mb-5 rounded-3xl border border-neutral-200 bg-white px-4">
          <HubRow icon={Database} title="Your data" hint="Export, import, delete" onPress={() => setImportModalVisible(true)} />
          <View className="border-t border-neutral-100" />
          <HubRow
            icon={LogOut}
            title="Account"
            hint="Sign out or delete"
            onPress={() =>
              Alert.alert('Account', undefined, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Sign out',
                  onPress: async () => {
                    await signOut();
                    router.replace('/login');
                  },
                },
                { text: 'Delete account', style: 'destructive', onPress: handleDeleteAccount },
              ])
            }
          />
        </View>

        <View className="mb-5 rounded-3xl border border-neutral-200 bg-white p-4">
          <Text className="mb-1 text-sm font-bold text-neutral-900">Month start date</Text>
          <Text className="mb-3 text-[11px] text-neutral-500">
            Currently the {formatDayOfMonth(profile?.monthStartDate || 1)}. The budget month flips on this payday.
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {[1, 5, 15, 25, 28].map((day) => {
              const active = (profile?.monthStartDate || 1) === day;
              return (
                <Pressable
                  key={day}
                  onPress={() => updateProfile({ monthStartDate: day })}
                  className="rounded-xl px-3 py-2"
                  style={{ backgroundColor: active ? TEAL : '#F3F4F6' }}
                >
                  <Text className={`text-xs font-bold ${active ? 'text-white' : 'text-neutral-700'}`}>{formatDayOfMonth(day)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {month ? (
          <View className="mb-5 rounded-3xl border border-neutral-200 bg-white p-4">
            <Pressable onPress={() => setStrategyVisible(true)} className="mb-3 flex-row items-center justify-between">
              <View>
                <Text className="text-sm font-bold text-neutral-900">Budget strategy</Text>
                <Text className="text-[11px] text-neutral-500">Including custom needs/wants/savings split</Text>
              </View>
              <Text className="text-xs font-bold" style={{ color: TEAL }}>
                Change
              </Text>
            </Pressable>
            <Pressable onPress={() => setCategoriesModalVisible(true)} className="flex-row items-center justify-between border-t border-neutral-100 pt-3">
              <View>
                <Text className="text-sm font-bold text-neutral-900">Custom expense categories</Text>
                <Text className="text-[11px] text-neutral-500">{(month.activeCategories || []).length || 8} active</Text>
              </View>
              <Text className="text-xs font-bold text-neutral-500">Customize</Text>
            </Pressable>
          </View>
        ) : null}

        <View className="mb-5 rounded-3xl border border-neutral-200 bg-white p-4">
          <Text className="mb-3 text-sm font-bold text-neutral-900">Language</Text>
          <View className="flex-row gap-2">
            {LOCALES.map((lang) => {
              const active = i18n.language === lang;
              return (
                <Pressable
                  key={lang}
                  onPress={() => setAppLanguage(lang)}
                  className="flex-1 items-center rounded-xl py-2.5"
                  style={{ backgroundColor: active ? TEAL : '#F3F4F6' }}
                >
                  <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-neutral-800'}`}>{LOCALE_NAMES[lang]}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable onPress={() => setThemeModalVisible(true)} className="mt-3">
            <Text className="text-xs font-bold" style={{ color: TEAL }}>
              Appearance theme
            </Text>
          </Pressable>
        </View>

        <View className="mb-5 rounded-3xl border border-neutral-200 bg-white p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-sm font-bold text-neutral-900">Biometric app lock</Text>
              <Text className="text-[11px] text-neutral-500">Require Face ID / fingerprint to open SmartJib</Text>
            </View>
            <Switch value={biometricEnabled} disabled={!biometricsAvailable} onValueChange={handleToggleBiometric} />
          </View>
        </View>

        <View className="mb-5 rounded-3xl border border-neutral-200 bg-white p-4">
          <Text className="mb-3 text-sm font-bold text-neutral-900">Data import & export</Text>
          <Pressable onPress={() => setImportModalVisible(true)} className="mb-2 items-center rounded-xl bg-neutral-100 py-3">
            <Text className="text-sm font-semibold text-neutral-800">Import transactions (CSV)</Text>
          </Pressable>
          <Pressable onPress={handleExportCsv} disabled={exporting} className="items-center rounded-xl py-3" style={{ backgroundColor: '#171d1c' }}>
            {exporting ? <ActivityIndicator color="#fff" /> : <Text className="text-sm font-semibold text-white">Export current month (CSV)</Text>}
          </Pressable>
        </View>

        <View className="rounded-3xl border border-red-200 bg-white p-4">
          <Text className="mb-1 text-sm font-bold text-red-600">Danger zone</Text>
          <Text className="mb-4 text-[11px] text-neutral-500">Permanently delete your account and wipe all stored financial data.</Text>
          <Pressable onPress={handleDeleteAccount} className="items-center rounded-xl bg-red-500 py-3">
            <Text className="text-sm font-semibold text-white">Delete account permanently</Text>
          </Pressable>
        </View>
      </ScrollView>

      <CurrencyModal
        visible={currencyModalVisible}
        onClose={() => setCurrencyModalVisible(false)}
        selectedCurrency={currency}
        onSelect={(code) => updateProfile({ currency: code })}
      />
      <ThemeModal visible={themeModalVisible} onClose={() => setThemeModalVisible(false)} />
      {month ? (
        <>
          <ImportCsvModal
            visible={importModalVisible}
            onClose={() => setImportModalVisible(false)}
            month={month}
            onImportVariable={async (newExpenses: VariableExpense[]) => {
              await updateMonth({ ...month, variableExpenses: [...newExpenses, ...(month.variableExpenses || [])] });
            }}
            onImportFixed={async (newBills: FixedExpense[]) => {
              await updateMonth({ ...month, fixedExpenses: [...newBills, ...(month.fixedExpenses || [])] });
            }}
          />
          <IncomeSourcesModal
            visible={incomeModalVisible}
            onClose={() => setIncomeModalVisible(false)}
            month={month}
            currency={currency}
            onUpdateMonth={updateMonth}
          />
          <CategoriesModal visible={categoriesModalVisible} onClose={() => setCategoriesModalVisible(false)} month={month} onUpdateMonth={updateMonth} />
          <StrategyModal visible={strategyVisible} onClose={() => setStrategyVisible(false)} month={month} onUpdateMonth={updateMonth} />
        </>
      ) : null}
      <HouseholdModal visible={householdVisible} onClose={() => setHouseholdVisible(false)} />
      <MoneyPlacesModal visible={placesVisible} onClose={() => setPlacesVisible(false)} />
    </View>
  );
}
