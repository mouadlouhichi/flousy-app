import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Sheet } from './Sheet';
import {
  type HouseholdMember,
  type HouseholdInvoice,
  addVariableExpense,
} from '@flousy/core';
import { useMobileStore } from '../lib/store-context';
import { useMobileAuth } from '../lib/auth-context';
import {
  createHousehold,
  saveHouseholdMember,
  createHouseholdInvite,
  saveHouseholdInvoice,
  getHouseholdInvite,
} from '../lib/db';

export function HouseholdModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const {
    profile,
    household,
    householdMembers,
    pendingInvites,
    invoices,
    workspace,
    setWorkspace,
    acceptInvite,
    updateProfile,
    month,
    updateMonth,
    currency,
    isPro,
  } = useMobileStore();
  const { user, demoMode } = useMobileAuth();
  const [name, setName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [invoiceName, setInvoiceName] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');

  const handleCreate = async () => {
    if (demoMode) {
      Alert.alert('Firebase required', 'Household sharing needs a signed-in account.');
      return;
    }
    if (!isPro) {
      Alert.alert('Pro required', 'Creating a household is a Pro feature, same as on web.');
      return;
    }
    if (!user || !name.trim()) return;
    const owner: HouseholdMember = {
      id: user.uid,
      displayName: user.displayName || user.email || 'Owner',
      email: user.email || undefined,
      userId: user.uid,
      role: 'owner',
      status: 'active',
      avatarColor: '#2ea44f',
      joinedAt: new Date().toISOString(),
    };
    const id = await createHousehold(
      {
        name: name.trim(),
        ownerId: user.uid,
        planOwnerId: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      owner,
    );
    await updateProfile({
      activeHouseholdId: id,
      activeWorkspace: 'household',
      householdIds: Array.from(new Set([...(profile?.householdIds || []), id])),
    });
    await setWorkspace('household');
    setName('');
  };

  const handleInvite = async () => {
    if (!household?.id || !user || !inviteEmail.trim()) return;
    const memberId = `inv-${Date.now()}`;
    const inviteId = `invite-${Date.now()}`;
    await saveHouseholdMember(household.id, {
      id: memberId,
      displayName: inviteEmail.split('@')[0],
      email: inviteEmail.trim().toLowerCase(),
      role: 'contributor',
      status: 'invited',
      avatarColor: '#6366f1',
      invitedAt: new Date().toISOString(),
    });
    await createHouseholdInvite({
      id: inviteId,
      householdId: household.id,
      memberId,
      email: inviteEmail.trim().toLowerCase(),
      role: 'contributor',
      createdBy: user.uid,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
      status: 'pending',
    });
    setInviteEmail('');
    Alert.alert(
      'Invite created',
      `Share this code with ${inviteEmail.trim()}: ${inviteId}. They can join from Profile → Household.`,
    );
  };

  const handleJoinByCode = async () => {
    if (!inviteCode.trim()) return;
    try {
      const invite = await getHouseholdInvite(inviteCode.trim());
      if (!invite || invite.status !== 'pending') {
        Alert.alert('Invalid code', 'That invitation was not found or is no longer pending.');
        return;
      }
      await acceptInvite(invite);
      setInviteCode('');
      Alert.alert('Joined', 'You joined the household.');
    } catch (err: any) {
      Alert.alert('Could not join', err?.message || 'Check the code and that it was sent to your email.');
    }
  };

  const handleSubmitInvoice = async () => {
    if (!household?.id || !user || !invoiceName.trim()) return;
    const amount = Number(invoiceAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const invoice: HouseholdInvoice = {
      id: `invc-${Date.now()}`,
      name: invoiceName.trim(),
      amount,
      category: 'Groceries',
      date: new Date().toISOString().slice(0, 10),
      payerMemberId: user.uid,
      submitterId: user.uid,
      status: 'submitted',
      createdAt: new Date().toISOString(),
    };
    await saveHouseholdInvoice(household.id, invoice);
    setInvoiceName('');
    setInvoiceAmount('');
  };

  const handleApprove = async (invoice: HouseholdInvoice) => {
    if (!household?.id || !month) return;
    await saveHouseholdInvoice(household.id, { ...invoice, status: 'approved' });
    await updateMonth(
      addVariableExpense(month, {
        id: `var-${invoice.id}`,
        name: invoice.name,
        amount: invoice.amount,
        type: invoice.category,
        date: invoice.date,
        place: 'bank',
        person: invoice.payerMemberId,
      }),
    );
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
        <View className="bg-white dark:bg-neutral-900 rounded-t-3xl p-6 max-h-[90%]">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-xl font-bold text-neutral-900 dark:text-white">Household</Text>
            <Pressable onPress={onClose}>
              <Text className="text-neutral-500 font-bold">Close</Text>
            </Pressable>
          </View>
          <ScrollView>
            {pendingInvites.length > 0 && (
              <View className="mb-4 bg-amber-50 dark:bg-amber-950/40 p-3 rounded-2xl">
                <Text className="font-bold text-amber-800 mb-2">Pending invitations</Text>
                {pendingInvites.map((invite) => (
                  <Pressable
                    key={invite.id}
                    onPress={() => acceptInvite(invite)}
                    className="bg-primary py-2 rounded-xl items-center mb-2"
                  >
                    <Text className="text-white font-semibold">Join household</Text>
                  </Pressable>
                ))}
              </View>
            )}

            <View className="flex-row gap-2 mb-4">
              <Pressable
                onPress={() => setWorkspace('personal')}
                className={`flex-1 py-2 rounded-xl items-center border ${
                  workspace === 'personal' ? 'bg-primary border-primary' : 'border-neutral-200'
                }`}
              >
                <Text className={workspace === 'personal' ? 'text-white font-bold' : 'text-neutral-700'}>
                  Personal
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!profile?.activeHouseholdId) {
                    Alert.alert('No household', 'Create or join a household first.');
                    return;
                  }
                  setWorkspace('household');
                }}
                className={`flex-1 py-2 rounded-xl items-center border ${
                  workspace === 'household' ? 'bg-primary border-primary' : 'border-neutral-200'
                }`}
              >
                <Text className={workspace === 'household' ? 'text-white font-bold' : 'text-neutral-700'}>
                  Household
                </Text>
              </Pressable>
            </View>

            {household ? (
              <>
                <Text className="font-bold text-neutral-900 dark:text-white mb-1">{household.name}</Text>
                <Text className="text-xs text-neutral-500 mb-3">
                  Members share one budget. Pro features are unlocked in this workspace.
                </Text>
                {householdMembers.map((member) => (
                  <View key={member.id} className="flex-row justify-between py-2">
                    <Text className="text-neutral-800 dark:text-neutral-200">{member.displayName}</Text>
                    <Text className="text-xs text-neutral-500">
                      {member.role} · {member.status}
                    </Text>
                  </View>
                ))}
                <TextInput
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                  placeholder="Invite email"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="none"
                  className="bg-neutral-100 dark:bg-neutral-800 px-4 py-3 rounded-xl mt-3 text-neutral-900 dark:text-white"
                />
                <Pressable onPress={handleInvite} className="bg-primary py-3 rounded-xl items-center mt-2">
                  <Text className="text-white font-bold">Send invite</Text>
                </Pressable>

                <Text className="font-bold mt-6 mb-2 text-neutral-900 dark:text-white">Contributor invoices</Text>
                {invoices.map((invoice) => (
                  <View key={invoice.id} className="py-2 border-b border-neutral-100 dark:border-neutral-800">
                    <Text className="font-semibold text-neutral-900 dark:text-white">
                      {invoice.name} · {invoice.amount} {currency}
                    </Text>
                    <Text className="text-xs text-neutral-500">{invoice.status}</Text>
                    {invoice.status === 'submitted' && (
                      <Pressable onPress={() => handleApprove(invoice)} className="mt-1">
                        <Text className="text-primary font-bold text-xs">Approve & log expense</Text>
                      </Pressable>
                    )}
                  </View>
                ))}
                <TextInput
                  value={invoiceName}
                  onChangeText={setInvoiceName}
                  placeholder="Invoice name"
                  placeholderTextColor="#9ca3af"
                  className="bg-neutral-100 dark:bg-neutral-800 px-4 py-3 rounded-xl mt-3 text-neutral-900 dark:text-white"
                />
                <TextInput
                  value={invoiceAmount}
                  onChangeText={setInvoiceAmount}
                  placeholder={`Amount (${currency})`}
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                  className="bg-neutral-100 dark:bg-neutral-800 px-4 py-3 rounded-xl mt-2 text-neutral-900 dark:text-white"
                />
                <Pressable onPress={handleSubmitInvoice} className="bg-neutral-900 dark:bg-white py-3 rounded-xl items-center mt-2">
                  <Text className="text-white dark:text-neutral-900 font-bold">Submit invoice</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text className="text-sm text-neutral-500 mb-3">
                  Create a shared workspace so family members can contribute expenses.
                </Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Household name"
                  placeholderTextColor="#9ca3af"
                  className="bg-neutral-100 dark:bg-neutral-800 px-4 py-3 rounded-xl text-neutral-900 dark:text-white"
                />
                <Pressable onPress={handleCreate} className="bg-primary py-3 rounded-xl items-center mt-3">
                  <Text className="text-white font-bold">Create household</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
    </Sheet>
  );
}
