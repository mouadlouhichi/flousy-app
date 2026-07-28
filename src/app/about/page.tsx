import type { Metadata } from "next";
import { StaticPageShell } from "@/components/static/page-shell";

export const metadata: Metadata = {
  title: "About",
  description:
    "Flousy is a simple, private budgeting app built around one idea: your money should always be easy to understand.",
};

export default function AboutPage() {
  return (
    <StaticPageShell
      eyebrow="About"
      title="Money you can finally make sense of."
      subtitle="Flousy started from a simple frustration: budgeting apps that tell you what you spent, but never help you understand why your money still runs out."
    >
      <div className="prose-flousy space-y-10">
        <div>
          <h2 className="font-display text-2xl lg:text-3xl text-foreground mb-4">
            Two questions, one app
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Every budgeting question really comes down to two things: what is
            this money for, and where does it actually sit right now? Most
            apps mix the two together until neither makes sense. Flousy keeps
            them separate, so you always know both — without spreadsheets,
            without guesswork.
          </p>
        </div>

        <div>
          <h2 className="font-display text-2xl lg:text-3xl text-foreground mb-4">
            Built for everyday life
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            We designed Flousy for real budgets — the cash in your wallet,
            the money sitting at home, and whatever's left in the bank. No
            bank connections required, no complicated setup. Just add your
            income, pick a style that fits how you think about money, and
            start logging as you go.
          </p>
        </div>

        <div>
          <h2 className="font-display text-2xl lg:text-3xl text-foreground mb-4">
            Free to start, honest about the rest
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            The core of Flousy — tracking, budgeting styles, savings goals —
            is free, and always will be. Flousy Pro exists for people who
            want a deeper look at their habits over time. We&apos;ll never
            hide basic budgeting behind a paywall.
          </p>
        </div>

        <div>
          <h2 className="font-display text-2xl lg:text-3xl text-foreground mb-4">
            Your business stays yours
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Budgeting means sharing personal details about your life. We take
            that seriously: your data is private to your account, never sold,
            and yours to export or delete whenever you choose.
          </p>
        </div>
      </div>
    </StaticPageShell>
  );
}
