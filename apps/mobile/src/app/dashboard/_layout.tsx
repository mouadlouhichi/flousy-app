import React from 'react';
import { Tabs } from 'expo-router';
import { MobileStoreProvider } from '../../lib/store-context';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Receipt,
  CalendarDays,
  PiggyBank,
  TrendingUp,
  Settings,
  Scale,
} from 'lucide-react-native';

export default function DashboardLayout() {
  const { t } = useTranslation();

  return (
    <MobileStoreProvider>
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
          name="transactions"
          options={{
            title: t('tabs.variable', 'Expenses'),
            tabBarIcon: ({ color, size }) => (
              <Receipt color={color} size={size} />
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
        <Tabs.Screen
          name="trends"
          options={{
            title: t('tabs.trends', 'Trends'),
            tabBarIcon: ({ color, size }) => (
              <TrendingUp color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: t('tabs.settings', 'Settings'),
            tabBarIcon: ({ color, size }) => (
              <Settings color={color} size={size} />
            ),
          }}
        />
      </Tabs>
    </MobileStoreProvider>
  );
}
