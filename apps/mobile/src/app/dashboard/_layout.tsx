import React from 'react';
import { Tabs } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MobileStoreProvider } from '../../lib/store-context';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Receipt,
  CalendarDays,
  PiggyBank,
  Scale,
} from 'lucide-react-native';

export default function DashboardLayout() {
  const { t } = useTranslation();

  return (
    <MobileStoreProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['top']}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: '#2ea44f',
            tabBarInactiveTintColor: '#9ca3af',
            tabBarStyle: {
              backgroundColor: '#ffffff',
              borderTopColor: '#f3f4f6',
              height: 60,
              paddingBottom: 8,
              paddingTop: 8,
            },
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: t('tabs.overview', 'Overview'),
              tabBarIcon: ({ color, size }) => (
                <LayoutDashboard color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="fixed"
            options={{
              title: t('tabs.fixed', 'Bills'),
              tabBarIcon: ({ color, size }) => (
                <CalendarDays color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="transactions"
            options={{
              title: t('tabs.variable', 'Expenses'),
              tabBarIcon: ({ color, size }) => (
                <Receipt color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="savings"
            options={{
              title: t('tabs.savings', 'Savings'),
              tabBarIcon: ({ color, size }) => (
                <PiggyBank color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="debts"
            options={{
              title: t('tabs.debts', 'Debts'),
              tabBarIcon: ({ color, size }) => (
                <Scale color={color} size={size} />
              ),
            }}
          />
          {/* Same as web: courses / trends / profile are not bottom-nav destinations. */}
          <Tabs.Screen name="courses" options={{ href: null, title: t('courses.title', 'Course') }} />
          <Tabs.Screen name="trends" options={{ href: null, title: t('tabs.trends', 'Trends') }} />
          <Tabs.Screen name="settings" options={{ href: null, title: t('tabs.settings', 'Profile') }} />
        </Tabs>
      </SafeAreaView>
    </MobileStoreProvider>
  );
}
