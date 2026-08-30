'use client';

import { AppIcon } from '@/components/ui/app-icon';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useAuth } from '@/lib/auth-context';
import { useCurrency } from '@/lib/currency-context';
import { useLanguage } from '@/lib/i18n-context';
import { SUPPORTED_CURRENCIES } from '@/lib/currency';
import { trackEvent } from '@/lib/analytics';
import { MonthlyStartDateControl } from '../monthly-start-date-control';

export function PreferencesPanel() {
  const { profile, updateProfileData } = useAuth();
  const { currency, setCurrency } = useCurrency();
  const { language, setLanguage } = useLanguage();
  const currentTheme = profile?.theme || 'system';

  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    updateProfileData({ theme });
    trackEvent('change_theme', { theme });
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  };

  return (
    <div className="divide-y divide-outline-variant/30 rounded-2xl border border-outline-variant bg-surface-container">
      <div className="flex items-center justify-between gap-3 p-4">
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-variant">
            <AppIcon name="payments" className="text-[20px] text-primary" />
          </span>
          <label htmlFor="profile-currency" className="text-sm font-medium text-on-surface">
            Currency
          </label>
        </span>
        <select
          id="profile-currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="min-w-[120px] cursor-pointer rounded-lg border-0 bg-surface-variant px-3 py-2 text-xs font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {Object.values(SUPPORTED_CURRENCIES).map((c) => (
            <option key={c.code} value={c.code}>
              {c.code}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between gap-3 p-4">
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-variant">
            <AppIcon name="language" className="text-[20px] text-primary" />
          </span>
          <label htmlFor="profile-language" className="text-sm font-medium text-on-surface">
            Language
          </label>
        </span>
        <select
          id="profile-language"
          value={language}
          onChange={(e) => setLanguage(e.target.value as 'en' | 'fr' | 'ar')}
          className="min-w-[120px] cursor-pointer rounded-lg border-0 bg-surface-variant px-3 py-2 text-xs font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="en">English</option>
          <option value="fr">Français</option>
          <option value="ar">العربية</option>
        </select>
      </div>

      <div className="p-4">
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-variant">
            <AppIcon name="palette" className="text-[20px] text-primary" />
          </span>
          <span className="text-sm font-medium text-on-surface">Theme</span>
        </div>
        <SegmentedControl
          ariaLabel="Theme"
          value={currentTheme}
          onChange={(v) => handleThemeChange(v as 'light' | 'dark' | 'system')}
          options={[
            { value: 'light', label: 'Light', icon: 'light_mode' },
            { value: 'dark', label: 'Dark', icon: 'dark_mode' },
            { value: 'system', label: 'System', icon: 'desktop_windows' },
          ]}
        />
      </div>

      <div className="p-4">
        <MonthlyStartDateControl
          compact
          value={profile?.monthStartDate}
          onChange={(day) => updateProfileData({ monthStartDate: day })}
        />
      </div>
    </div>
  );
}
