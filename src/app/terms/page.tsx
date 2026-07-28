import type { Metadata } from "next";
import { StaticPageShell } from "@/components/static/page-shell";

const description =
  "By creating an account, you agree to use Flousy to track your personal budget, keep your login details secure, and enter accurate information.";

export const metadata: Metadata = {
  title: "Terms of Service",
  description,
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "/terms",
  },
  openGraph: {
    title: "Terms of Service · Flousy",
    description,
    url: "/terms",
    siteName: "Flousy",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Flousy budget tracker for needs, wants, savings, and money places",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Terms of Service · Flousy",
    description,
    images: ["/opengraph-image"],
  },
};

const sections = [
  {
    title: "1. Using Flousy",
    body: `By creating an account, you agree to use Flousy for its intended purpose — tracking your personal budget. You're responsible for keeping your login details secure and for the accuracy of the information you enter.`,
  },
  {
    title: "2. Your account",
    body: `You must be able to legally enter into these terms to use Flousy. One account is for one person's budget; if you need a shared or household budget, look out for that feature on our roadmap.`,
  },
  {
    title: "3. Free and Pro plans",
    body: `Flousy's core features are free to use, with no time limit. Flousy Pro is an optional paid upgrade that unlocks additional features. Pro subscriptions renew automatically until cancelled, and you can cancel anytime from Settings.`,
  },
  {
    title: "4. What Flousy is not",
    body: `Flousy is a budgeting and tracking tool. It is not a bank, does not move real money on your behalf, and does not provide financial, investment, or tax advice. Decisions about your finances remain entirely your own.`,
  },
  {
    title: "5. Acceptable use",
    body: `Please don't use Flousy to store information that isn't yours, to attempt to access other users' accounts, or to interfere with the normal operation of the app.`,
  },
  {
    title: "6. Cancelling or deleting your account",
    body: `You can cancel a Pro subscription or delete your account entirely at any time from Settings. Deleting your account permanently removes your data from our systems.`,
  },
  {
    title: "7. Changes to the service",
    body: `We may add, change, or remove features over time as Flousy improves. We'll do our best to communicate meaningful changes in advance.`,
  },
  {
    title: "8. Limitation of liability",
    body: `Flousy is provided "as is." While we work hard to keep your data accurate and available, we can't guarantee the service will be uninterrupted or error-free, and we aren't liable for financial decisions made using the app.`,
  },
  {
    title: "9. Contact",
    body: `Questions about these terms? Reach out from our Contact page.`,
  },
];

export default function TermsPage() {
  return (
    <StaticPageShell
      eyebrow="Legal"
      title="Terms of Service"
      subtitle="Last updated July 2026. These terms cover how you can use Flousy, and what you can expect from us."
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
