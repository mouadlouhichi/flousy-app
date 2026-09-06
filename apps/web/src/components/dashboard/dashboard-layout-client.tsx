'use client';

import React from 'react';
import { DashboardProvider } from './dashboard-provider';
import { DashboardShell } from './dashboard-shell';
import { AppLockGate } from './app-lock-gate';
import { ReminderRunner } from './reminder-runner';

/**
 * Client boundary for the dashboard route group: provides the shared
 * dashboard state and renders the persistent shell around each routed page.
 */
export function DashboardLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <DashboardProvider>
      <AppLockGate>
        <ReminderRunner />
        <DashboardShell>{children}</DashboardShell>
      </AppLockGate>
    </DashboardProvider>
  );
}
