import React from 'react';
import { View } from 'react-native';
import { Tabs, usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MobileStoreProvider } from '../../lib/store-context';
import { useTranslation } from 'react-i18next';
import { DashboardHeader } from '../../components/DashboardHeader';
import { FloatingTabBar } from '../../components/FloatingTabBar';
import { QuickAddFab } from '../../components/QuickAddFab';

export default function DashboardLayout() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const hideFab = /trends|debts|settings|courses|profile/.test(pathname || '');

  return (
    <MobileStoreProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F5FAF8' }} edges={['top']}>
        <View style={{ flex: 1 }}>
          <DashboardHeader />
          <View style={{ flex: 1 }}>
            <Tabs
              tabBar={(props) => <FloatingTabBar {...props} />}
              screenOptions={{
                headerShown: false,
                sceneStyle: { backgroundColor: '#F5FAF8', paddingBottom: 132 },
              }}
            >
              <Tabs.Screen name="index" options={{ title: t('tabs.overview', 'Overview') }} />
              <Tabs.Screen name="fixed" options={{ title: t('tabs.fixed', 'Bills') }} />
              <Tabs.Screen name="transactions" options={{ title: t('tabs.variable', 'Expenses') }} />
              <Tabs.Screen name="savings" options={{ title: t('tabs.savings', 'Savings') }} />
              <Tabs.Screen name="debts" options={{ title: t('tabs.debts', 'Debts') }} />
              <Tabs.Screen name="courses" options={{ href: null, title: t('courses.title', 'Course') }} />
              <Tabs.Screen name="trends" options={{ href: null, title: t('tabs.trends', 'Trends') }} />
              <Tabs.Screen name="settings" options={{ href: null, title: t('tabs.settings', 'Profile') }} />
            </Tabs>
            {hideFab ? null : <QuickAddFab />}
          </View>
        </View>
      </SafeAreaView>
    </MobileStoreProvider>
  );
}
