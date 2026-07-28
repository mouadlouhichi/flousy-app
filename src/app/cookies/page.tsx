import type { Metadata } from "next";
import { StaticPageShell } from "@/components/static/page-shell";

export const metadata: Metadata = {
  title: "Cookie Policy — Flousy",
  description: "How Flousy uses cookies and similar technologies.",
};

const sections = [
  {
    title: "1. What cookies we use",
    body: `Flousy uses a small number of cookies and local storage entries to keep you signed in, remember your preferences (like currency and dark mode), and keep the app working smoothly between visits.`,
  },
  {
    title: "2. Essential cookies",
    body: `These are required for the app to function — for example, staying logged into your account. You can't opt out of these without losing the ability to use Flousy.`,
  },
  {
    title: "3. Optional analytics",
    body: `If enabled, we may use privacy-respecting analytics cookies to understand overall usage patterns, like which pages or features are most used. These don't track you across other websites, and are off unless you've agreed to them.`,
  },
  {
    title: "4. No advertising cookies",
    body: `Flousy does not use advertising or cross-site tracking cookies. We're not in the business of selling attention or data.`,
  },
  {
    title: "5. Managing cookies",
    body: `You can control or clear cookies through your browser settings at any time. Note that blocking essential cookies may prevent Flousy from working properly.`,
  },
];

export default function CookiesPage() {
  return (
    <StaticPageShell
      eyebrow="Legal"
      title="Cookie Policy"
      subtitle="Last updated July 2026. A short, honest explanation of the handful of cookies Flousy uses."
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
