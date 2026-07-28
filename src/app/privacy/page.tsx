import type { Metadata } from "next";
import { StaticPageShell } from "@/components/static/page-shell";

export const metadata: Metadata = {
  title: "Privacy Policy — Flousy",
  description: "How Flousy collects, uses, and protects your information.",
};

const sections = [
  {
    title: "1. What we collect",
    body: `We collect the information you give us directly: your email address, the income, expenses, categories and goals you enter, and basic account preferences like your currency and display settings. We do not ask for bank logins, card numbers, or account numbers of any kind.`,
  },
  {
    title: "2. How we use it",
    body: `Your budgeting data is used to power the app itself — to show your balances, calculate your budget, and sync your information across your devices. We do not use your financial data to build advertising profiles, and we do not sell it to third parties.`,
  },
  {
    title: "3. Who can see your data",
    body: `Only you can access your budget. Our systems are built so that your account's data is isolated from every other account, and our team accesses individual data only when needed to fix a problem you've reported.`,
  },
  {
    title: "4. Analytics",
    body: `We may use limited, privacy-respecting analytics to understand how the app is used overall (for example, which features are popular). This is aggregated and anonymized, and is off by default until you agree to it.`,
  },
  {
    title: "5. Data retention",
    body: `We keep your data for as long as your account is active. If you delete your account, your profile, budgets, and goals are permanently removed from our systems.`,
  },
  {
    title: "6. Your choices",
    body: `You can export your budgeting history as a spreadsheet at any time from Settings. You can also delete your account and all associated data permanently, whenever you like — no need to contact support.`,
  },
  {
    title: "7. Changes to this policy",
    body: `If we make meaningful changes to how we handle your data, we'll let you know in the app before the changes take effect.`,
  },
  {
    title: "8. Contact us",
    body: `Questions about this policy or your data? Reach out any time from our Contact page.`,
  },
];

export default function PrivacyPage() {
  return (
    <StaticPageShell
      eyebrow="Legal"
      title="Privacy Policy"
      subtitle="Last updated July 2026. Plain-language version below — the short of it: your budget is yours, and it stays that way."
    >
      <div className="space-y-12">
        {sections.map((section) => (
          <div key={section.title}>
            <h2 className="font-display text-2xl text-foreground mb-3">{section.title}</h2>
            <p className="text-muted-foreground leading-relaxed">{section.body}</p>
          </div>
        ))}
      </div>
    </StaticPageShell>
  );
}
