import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronRight, Users } from 'lucide-react-native';
import { ProfileSubpage } from '../../components/ProfileSubpage';
import { HouseholdModal } from '../../components/HouseholdModal';
import { useMobileStore } from '../../lib/store-context';

const TEAL = '#00685f';

export default function WorkspaceScreen() {
  const { profile, household, workspace, setWorkspace, currentMember } = useMobileStore();
  const [householdOpen, setHouseholdOpen] = useState(false);

  return (
    <ProfileSubpage title="Workspace">
      <View className="mb-4 rounded-2xl border border-neutral-200 bg-white p-4">
        <Text className="mb-3 text-[11px] font-extrabold uppercase tracking-wider text-neutral-500">Workspace</Text>
        <View className="gap-2">
          <Pressable
            onPress={() => setWorkspace('personal')}
            className="rounded-xl border p-3"
            style={{
              borderColor: workspace === 'personal' ? TEAL : '#E5E7EB',
              backgroundColor: workspace === 'personal' ? 'rgba(0,104,95,0.1)' : '#fff',
            }}
          >
            <Text className="font-bold" style={{ color: workspace === 'personal' ? TEAL : '#171d1c' }}>
              My SmartJib
            </Text>
            <Text className="text-xs text-neutral-500">Private personal dashboard</Text>
          </Pressable>
          {profile?.activeHouseholdId ? (
            <Pressable
              onPress={() => setWorkspace('household')}
              className="rounded-xl border p-3"
              style={{
                borderColor: workspace === 'household' ? TEAL : '#E5E7EB',
                backgroundColor: workspace === 'household' ? 'rgba(0,104,95,0.1)' : '#fff',
              }}
            >
              <Text className="font-bold" style={{ color: workspace === 'household' ? TEAL : '#171d1c' }}>
                {household?.name || 'Household Dashboard'}
              </Text>
              <Text className="text-xs text-neutral-500">{currentMember?.role || 'member'} access</Text>
            </Pressable>
          ) : (
            <Text className="text-xs text-neutral-500">Create or join a household to share a budget.</Text>
          )}
        </View>
      </View>

      <Pressable
        onPress={() => setHouseholdOpen(true)}
        className="flex-row items-center justify-between rounded-2xl border border-neutral-200 bg-white p-4"
      >
        <View className="flex-row items-center">
          <Users size={20} color={TEAL} />
          <Text className="ml-3 text-sm font-bold text-neutral-900">Manage household</Text>
        </View>
        <ChevronRight size={18} color="#9CA3AF" />
      </Pressable>

      <HouseholdModal visible={householdOpen} onClose={() => setHouseholdOpen(false)} />
    </ProfileSubpage>
  );
}
