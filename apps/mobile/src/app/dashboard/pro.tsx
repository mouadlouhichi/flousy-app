import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, ChevronRight, Crown, Lock } from 'lucide-react-native';
import { PRO_FEATURES, canShowProUpgrade, isProFeatureUnlocked } from '@flousy/core';
import { ProfileSubpage } from '../../components/ProfileSubpage';
import { IncomeSourcesModal } from '../../components/IncomeSourcesModal';
import { ImportCsvModal } from '../../components/ImportCsvModal';
import { useMobileStore } from '../../lib/store-context';
import { CategoryIcon } from '../../components/CategoryIcon';

const TEAL = '#00685f';

export default function ProScreen() {
  const router = useRouter();
  const { isPro, workspace, month, currency, updateProfile, updateMonth } = useMobileStore();
  const showUpgrade = canShowProUpgrade(isPro, workspace);
  const proUnlocked = isProFeatureUnlocked(isPro, workspace);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);

  return (
    <ProfileSubpage title="SmartJib Pro">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-[11px] font-extrabold uppercase tracking-wider text-neutral-500">
          {proUnlocked ? 'Your Pro features' : 'Unlock with Pro'}
        </Text>
        {proUnlocked ? (
          <View className="flex-row items-center rounded-full px-2.5 py-1" style={{ backgroundColor: 'rgba(0,104,95,0.1)' }}>
            <Check size={13} color={TEAL} />
            <Text className="ml-1 text-[11px] font-bold" style={{ color: TEAL }}>
              All active
            </Text>
          </View>
        ) : null}
      </View>

      {PRO_FEATURES.map((feature) => (
        <View
          key={feature.id}
          className="mb-3 flex-row items-start rounded-2xl border p-4"
          style={{
            borderColor: proUnlocked ? 'rgba(0,104,95,0.25)' : '#E5E7EB',
            backgroundColor: '#fff',
          }}
        >
          <View
            className="mr-3 h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: proUnlocked ? TEAL : '#F3F4F6' }}
          >
            <CategoryIcon name={feature.icon} size={20} color={proUnlocked ? '#fff' : '#6B7280'} />
          </View>
          <View className="min-w-0 flex-1">
            <View className="flex-row items-center">
              <Text className="text-sm font-bold text-neutral-900">{feature.title}</Text>
              {!proUnlocked ? <Lock size={13} color="#9CA3AF" style={{ marginLeft: 6 }} /> : null}
            </View>
            <Text className="mt-0.5 text-xs leading-4 text-neutral-500">{feature.description}</Text>
          </View>
        </View>
      ))}

      {proUnlocked ? (
        <View className="mt-1 gap-3">
          <Pressable onPress={() => setIncomeOpen(true)} className="flex-row items-center justify-between rounded-2xl border border-neutral-200 bg-white p-4">
            <Text className="text-sm font-bold text-neutral-900">Manage income sources</Text>
            <ChevronRight size={18} color="#9CA3AF" />
          </Pressable>
          <Pressable onPress={() => setCsvOpen(true)} className="flex-row items-center justify-between rounded-2xl border border-neutral-200 bg-white p-4">
            <Text className="text-sm font-bold text-neutral-900">Import / export CSV</Text>
            <ChevronRight size={18} color="#9CA3AF" />
          </Pressable>
          <Pressable onPress={() => router.push('/dashboard/workspace')} className="flex-row items-center justify-between rounded-2xl border border-neutral-200 bg-white p-4">
            <Text className="text-sm font-bold text-neutral-900">Manage household</Text>
            <ChevronRight size={18} color="#9CA3AF" />
          </Pressable>
          <Pressable onPress={() => router.push('/dashboard/trends')} className="flex-row items-center justify-between rounded-2xl border border-neutral-200 bg-white p-4">
            <Text className="text-sm font-bold text-neutral-900">Analytics & insights</Text>
            <ChevronRight size={18} color="#9CA3AF" />
          </Pressable>
        </View>
      ) : showUpgrade ? (
        <Pressable
          onPress={() => updateProfile({ plan: 'pro' })}
          className="mt-2 flex-row items-center justify-center rounded-2xl py-4"
          style={{ backgroundColor: TEAL }}
        >
          <Crown size={20} color="#fff" />
          <Text className="ml-2 text-base font-bold text-white">Upgrade to Pro</Text>
        </Pressable>
      ) : (
        <Text className="mt-2 text-center text-xs text-neutral-500">
          Pro upgrades apply to your private workspace. Switch to My SmartJib to manage your personal plan.
        </Text>
      )}

      {month ? (
        <>
          <IncomeSourcesModal visible={incomeOpen} onClose={() => setIncomeOpen(false)} month={month} currency={currency} onUpdateMonth={updateMonth} />
          <ImportCsvModal
            visible={csvOpen}
            onClose={() => setCsvOpen(false)}
            month={month}
            onImportVariable={async (expenses) => {
              await updateMonth({ ...month, variableExpenses: [...expenses, ...(month.variableExpenses || [])] });
            }}
            onImportFixed={async (bills) => {
              await updateMonth({ ...month, fixedExpenses: [...bills, ...(month.fixedExpenses || [])] });
            }}
          />
        </>
      ) : null}
    </ProfileSubpage>
  );
}
