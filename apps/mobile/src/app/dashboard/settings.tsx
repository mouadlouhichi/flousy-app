import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { DashboardScrollView as ScrollView } from '../../components/DashboardScrollView';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
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
import { type Language, LOCALE_NAMES, formatDayOfMonth } from '@flousy/core';
import { useMobileAuth } from '../../lib/auth-context';
import { useMobileStore } from '../../lib/store-context';

const TEAL = '#00685f';

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
  const { i18n } = useTranslation();
  const router = useRouter();
  const { user, demoMode } = useMobileAuth();
  const { month, profile, isPro, scanUnlocked, workspace, currency, moneyPlaces } = useMobileStore();

  const displayName = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'SmartJib';
  const initial = displayName[0]?.toUpperCase() || 'S';
  const photo = user?.photoURL;

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
            onPress={() => router.push('/dashboard/preferences')}
          />
          <View className="border-t border-neutral-100" />
          <HubRow
            icon={Wallet}
            title="Money sources"
            hint={`${moneyPlaces.length} location${moneyPlaces.length === 1 ? '' : 's'}`}
            onPress={() => router.push('/dashboard/money-sources')}
          />
        </View>

        <Text className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-neutral-500">Workspace</Text>
        <View className="mb-5 rounded-3xl border border-neutral-200 bg-white px-4">
          <HubRow icon={Package} title="Workspace" hint="Personal and household" onPress={() => router.push('/dashboard/workspace')} />
          <View className="border-t border-neutral-100" />
          <HubRow
            icon={Crown}
            title="SmartJib Pro"
            hint={isPro ? 'Plan, income & insights' : 'Unlock scan, trends & CSV'}
            onPress={() => router.push('/dashboard/pro')}
          />
          <View className="border-t border-neutral-100" />
          <HubRow
            icon={TrendingUp}
            title="Analytics & insights"
            hint={scanUnlocked ? '6-month history and envelope health' : 'Pro feature'}
            onPress={() => router.push('/dashboard/trends')}
          />
          <View className="border-t border-neutral-100" />
          <HubRow icon={ScanLine} title="Course barcode scan" hint="Scan groceries as you shop" onPress={() => router.push('/dashboard/courses')} />
          <View className="border-t border-neutral-100" />
          <HubRow
            icon={Banknote}
            title="Income sources"
            hint={month ? `${month.totalBudget} ${currency}` : 'Manage streams'}
            onPress={() => router.push('/dashboard/pro')}
          />
          <View className="border-t border-neutral-100" />
          <HubRow icon={Users} title="Household" hint="Shared budget, invites, invoices" onPress={() => router.push('/dashboard/workspace')} />
        </View>

        <Text className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-neutral-500">Privacy & account</Text>
        <View className="rounded-3xl border border-neutral-200 bg-white px-4">
          <HubRow icon={Database} title="Your data" hint="Export, import, delete" onPress={() => router.push('/dashboard/data')} />
          <View className="border-t border-neutral-100" />
          <HubRow icon={LogOut} title="Account" hint="Sign out or delete" onPress={() => router.push('/dashboard/account')} />
        </View>
      </ScrollView>
    </View>
  );
}
