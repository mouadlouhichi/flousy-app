import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { type MonthBudget, calculateEnvelopeAmounts, calculateEnvelopeSpent } from '@flousy/core';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function useBudgetNotifications(month: MonthBudget | null, currency: string) {
  const lastAlertsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    async function requestPerms() {
      if (Platform.OS !== 'web') {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') {
          return;
        }
      }
    }
    requestPerms();
  }, []);

  useEffect(() => {
    if (!month) return;
    const { needs: needsCap, wants: wantsCap } = calculateEnvelopeAmounts(
      month.totalBudget,
      month.strategyId
    );
    const { needs: needsSpent, wants: wantsSpent } = calculateEnvelopeSpent(month);

    const needsRatio = needsCap > 0 ? (needsSpent / needsCap) * 100 : 0;
    const wantsRatio = wantsCap > 0 ? (wantsSpent / wantsCap) * 100 : 0;

    const currentAlertIds = new Set<string>();

    if (needsRatio >= 100) {
      const id = `needs-100-${month.totalBudget}`;
      currentAlertIds.add(id);
      if (!lastAlertsRef.current.has(id)) {
        Notifications.scheduleNotificationAsync({
          content: {
            title: '⚠️ Needs Envelope Exceeded',
            body: `Spent ${needsSpent} vs ${needsCap} ${currency} budget (${Math.round(needsRatio)}%).`,
            sound: true,
          },
          trigger: null,
        });
      }
    } else if (needsRatio >= 80) {
      const id = `needs-80-${month.totalBudget}`;
      currentAlertIds.add(id);
      if (!lastAlertsRef.current.has(id)) {
        Notifications.scheduleNotificationAsync({
          content: {
            title: '⚠️ Needs Envelope Alert',
            body: `You have reached ${Math.round(needsRatio)}% of your Needs envelope (${needsSpent}/${needsCap} ${currency}).`,
            sound: true,
          },
          trigger: null,
        });
      }
    }

    if (wantsRatio >= 100) {
      const id = `wants-100-${month.totalBudget}`;
      currentAlertIds.add(id);
      if (!lastAlertsRef.current.has(id)) {
        Notifications.scheduleNotificationAsync({
          content: {
            title: '⚠️ Wants Envelope Exceeded',
            body: `Spent ${wantsSpent} vs ${wantsCap} ${currency} budget (${Math.round(wantsRatio)}%).`,
            sound: true,
          },
          trigger: null,
        });
      }
    } else if (wantsRatio >= 80) {
      const id = `wants-80-${month.totalBudget}`;
      currentAlertIds.add(id);
      if (!lastAlertsRef.current.has(id)) {
        Notifications.scheduleNotificationAsync({
          content: {
            title: '⚠️ Wants Envelope Alert',
            body: `You have reached ${Math.round(wantsRatio)}% of your Wants envelope (${wantsSpent}/${wantsCap} ${currency}).`,
            sound: true,
          },
          trigger: null,
        });
      }
    }

    lastAlertsRef.current = currentAlertIds;
  }, [month, currency]);
}
