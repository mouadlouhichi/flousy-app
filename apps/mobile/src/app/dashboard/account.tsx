import React from 'react';
import { Alert, Linking, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ProfileSubpage } from '../../components/ProfileSubpage';
import { useMobileAuth } from '../../lib/auth-context';

const TEAL = '#00685f';

export default function AccountScreen() {
  const router = useRouter();
  const { user, signOut, deleteAccount } = useMobileAuth();

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out of your SmartJib account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        onPress: async () => {
          await signOut();
          router.replace('/login');
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete account permanently',
      'This action is irreversible. All your budget data, expenses, and savings goals will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount();
              router.replace('/login');
            } catch (err: any) {
              if (err?.code === 'auth/requires-recent-login') {
                Alert.alert('Re-authentication required', 'Please sign out and sign back in to delete your account.');
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
    <ProfileSubpage title="Account">
      {user ? (
        <>
          <Pressable onPress={handleSignOut} className="mb-2 items-center rounded-2xl border border-neutral-200 py-3.5">
            <Text className="text-sm font-medium text-neutral-500">Sign out</Text>
          </Pressable>
          <Pressable onPress={handleDelete} className="items-center rounded-2xl py-3.5">
            <Text className="text-sm font-medium text-red-600">Delete account</Text>
          </Pressable>
        </>
      ) : (
        <Pressable onPress={() => router.replace('/login')} className="items-center rounded-2xl py-3.5" style={{ backgroundColor: TEAL }}>
          <Text className="text-sm font-bold text-white">Sign in</Text>
        </Pressable>
      )}
      <View className="mt-4 flex-row justify-center gap-4">
        <Pressable onPress={() => Linking.openURL('https://smartjib.app/privacy')}>
          <Text className="text-xs font-medium text-neutral-500">Privacy</Text>
        </Pressable>
        <Text className="text-xs text-neutral-300">·</Text>
        <Pressable onPress={() => Linking.openURL('https://smartjib.app/terms')}>
          <Text className="text-xs font-medium text-neutral-500">Terms</Text>
        </Pressable>
      </View>
    </ProfileSubpage>
  );
}
