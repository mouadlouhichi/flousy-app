'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import { AppIcon } from '@/components/ui/app-icon';
import { useDashboard } from './dashboard-provider';
import {
  getLocalizedNavLabel,
  getProfileSubpageNavItems,
  getScreenIdFromPath,
  getVisibleNavItems,
} from './nav-items';
import { useHousehold } from '@/lib/household-context';
import { resolveProfileAvatarSource } from '@/lib/profile-avatar';
import { isProFeatureUnlocked } from '@/lib/household';
import { canExportAnything, TOOL_AREA } from '@/lib/household-rbac';

/** Tiny uppercase section heading with a hairline rule under it. */
function SidebarGroupLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mt-5 mb-1.5 border-b border-surface-variant/40 px-3 pb-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-on-surface-variant/80 first:mt-0">
      {children}
    </p>
  );
}

/**
 * Secondary row for the Tools group: the icon sits in a small rounded square so
 * actions read differently from the primary destinations above them.
 */
function SidebarToolRow({
  icon,
  label,
  onClick,
}: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-start font-label-sm text-on-surface-variant transition-colors hover:bg-surface-variant/40 hover:text-on-surface"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-variant/70">
        <AppIcon name={icon} className="text-[15px] text-primary" />
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}
import { ProfileAvatar } from './profile-avatar';
import { useLanguage } from '@/lib/i18n-context';

/**
 * Desktop left sidebar navigation (hidden on mobile).
 *
 * The active item background is a single pill that slides from the current
 * page's item to the target page's item on navigation (shared `layoutId`
 * animation), mirroring the horizontal slide of the mobile bottom nav.
 */
export function Sidebar() {
  const pathname = usePathname();
  const { messages: m, t } = useLanguage();
  const { user, profile, isPro, openIncomeModal, openCsvModal, openProModal } = useDashboard();
  const { workspace, canViewArea, exportSections } = useHousehold();
  const proUnlocked = isProFeatureUnlocked(isPro, workspace);
  // Quick tools are entry points into RBAC areas: income sources open the
  // income editor and CSV import/export reads or writes several money areas.
  // A member without the area never sees the button at all.
  const canSeeIncome = canViewArea(TOOL_AREA.incomeSources);
  const canUseCsv = workspace === 'personal' || canExportAnything(exportSections);
  const activeScreen = getScreenIdFromPath(pathname);
  const items = getVisibleNavItems(proUnlocked);
  // Household management is a Pro feature: a free user in their personal
  // workspace gets no household entry at all. A member of someone else's
  // household keeps it, since their access comes from the household.
  const canManageHousehold = isPro || workspace === 'household';
  const accountItems = getProfileSubpageNavItems(canManageHousehold);
  const userInitial = (profile?.displayName || user?.email || m.auth.anonymousUser)?.[0]?.toUpperCase() || '?';
  const avatarSrc = resolveProfileAvatarSource(profile?.avatarUrl, user?.photoURL);

  return (
    <aside className="hidden md:flex flex-col w-64 border-e border-surface-variant bg-surface shrink-0 fixed top-0 bottom-0 start-0 z-30">
      {/* Brand Logo */}
      <div className="p-5 flex items-center gap-3 border-b border-surface-variant/50">
        <Image
          src="/logo.png"
          alt={m.common.appName}
          width={40}
          height={40}
          className="object-contain"
          priority
        />
        <span className="font-headline-md text-headline-md font-extrabold text-primary tracking-tight">
          SmartJib
        </span>
      </div>

      {/* Navigation Menu — three visually distinct groups.
          Budget screens are the primary destinations (large icons, sliding
          pill). Tools and account pages are secondary: smaller rows, no pill,
          so the sidebar reads as a hierarchy instead of one flat list. */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {/* ── Budget ─────────────────────────────────────────── */}
        <SidebarGroupLabel>{m.navigation.groupBudget}</SidebarGroupLabel>
        <div className="flex flex-col gap-1">
          {items.map((item) => {
            const isActive = activeScreen === item.id;
            return (
              <Link
                key={item.id}
                href={item.href}
                prefetch={true}
                className={`relative flex items-center gap-3 rounded-2xl px-3 py-2.5 font-label-lg transition-colors ${
                  isActive
                    ? 'font-bold text-primary'
                    : 'text-on-surface-variant hover:bg-surface-variant/40 hover:text-on-surface'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="dashboard-sidebar-active-bg"
                    className="absolute inset-0 rounded-2xl bg-primary/10 shadow-xs"
                    transition={{ type: 'spring', stiffness: 400, damping: 34, mass: 0.9 }}
                  />
                )}
                <AppIcon
                  name={item.sidebarIcon}
                  className={`relative z-10 text-[21px] ${isActive ? 'filled' : ''}`}
                />
                <span className="relative z-10 truncate">{getLocalizedNavLabel(item, m)}</span>
              </Link>
            );
          })}
        </div>

        {/* ── Tools ──────────────────────────────────────────── */}
        {(canSeeIncome || canUseCsv) && (
          <>
            <SidebarGroupLabel>{m.navigation.groupTools}</SidebarGroupLabel>
            <div className="flex flex-col gap-0.5">
              {canSeeIncome && (
                <SidebarToolRow
                  icon="payments"
                  label={m.navigation.incomeSources}
                  onClick={() => {
                    if (!proUnlocked) {
                      openProModal();
                      return;
                    }
                    openIncomeModal();
                  }}
                />
              )}
              {canUseCsv && (
                <SidebarToolRow
                  icon="upload_file"
                  label={m.navigation.importExportCsv}
                  onClick={() => {
                    if (!proUnlocked) {
                      openProModal();
                      return;
                    }
                    openCsvModal();
                  }}
                />
              )}
            </div>
          </>
        )}

        {/* ── Account ────────────────────────────────────────── */}
        <SidebarGroupLabel>{m.navigation.groupAccount}</SidebarGroupLabel>
        <div className="flex flex-col gap-0.5">
          {accountItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              prefetch={true}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 font-label-sm transition-colors ${
                pathname === item.href
                  ? 'bg-surface-variant/60 font-bold text-on-surface'
                  : 'text-on-surface-variant hover:bg-surface-variant/40 hover:text-on-surface'
              }`}
            >
              <AppIcon name={item.icon} className="shrink-0 text-[17px]" />
              <span className="truncate">{m.profile.links[item.labelKey]}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* Bottom Profile Footer — whole row opens the profile page. Shares
          the sidebar's sliding active pill so Profile doesn't leave Overview
          (or whichever tab you came from) looking selected. */}
      <div className="p-4 border-t border-surface-variant/50 bg-surface-container/20">
        <Link
          href="/dashboard/profile"
          prefetch={true}
          aria-current={activeScreen === 'profile' ? 'page' : undefined}
          className={`relative flex items-center gap-3 overflow-hidden rounded-2xl px-3 py-2.5 transition-colors ${
            activeScreen === 'profile'
              ? 'text-primary'
              : 'text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface'
          }`}
        >
          {activeScreen === 'profile' && (
            <motion.span
              layoutId="dashboard-sidebar-active-bg"
              className="absolute inset-0 rounded-2xl bg-primary/10 shadow-xs"
              transition={{ type: 'spring', stiffness: 400, damping: 34, mass: 0.9 }}
            />
          )}
          <ProfileAvatar
            src={avatarSrc}
            initial={userInitial}
            alt=""
            className="relative z-10 h-10 w-10"
            fallbackClassName="bg-primary/20 text-primary font-bold"
          />
          <div className="relative z-10 flex min-w-0 flex-1 flex-col truncate">
            <span className="font-label-lg font-bold text-on-surface truncate">
              {profile?.displayName || (user?.email ? user.email.split('@')[0] : m.auth.anonymousUser)}
            </span>
            <span className="font-label-sm text-[10px] text-primary uppercase font-extrabold tracking-wider">
              {t(m.auth.planLabel, { plan: isPro ? m.profile.links.pro : m.profile.free })}
            </span>
          </div>
          <AppIcon
            name="person"
            className={`relative z-10 shrink-0 text-[20px] ${
              activeScreen === 'profile' ? 'filled text-primary' : 'text-on-surface-variant'
            }`}
          />
        </Link>
      </div>
    </aside>
  );
}
