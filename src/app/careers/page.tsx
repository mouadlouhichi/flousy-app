import type { Metadata } from "next";
import { StaticPageShell } from "@/components/static/page-shell";
import { Mail } from "lucide-react";

export const metadata: Metadata = {
  title: "Careers — Flousy",
  description: "Join the team building Flousy.",
};

const values = [
  {
    title: "Clarity over complexity",
    description: "We'd rather ship something simple that works than something clever that confuses people.",
  },
  {
    title: "Privacy as a default",
    description: "We build as if every user is watching how we handle their data, because in spirit, they are.",
  },
  {
    title: "Small team, real ownership",
    description: "Everyone here shapes the product directly — no layers between an idea and the people using it.",
  },
];

export default function CareersPage() {
  return (
    <StaticPageShell
      eyebrow="Careers"
      title="We're not hiring right now — but we'd still love to hear from you."
      subtitle="Flousy is a small team building a budgeting app people actually enjoy using. There are no open roles at the moment, but we keep every introduction on file for when that changes."
    >
      <div className="space-y-10 mb-16">
        <h2 className="font-display text-2xl lg:text-3xl text-foreground">What we care about</h2>
        <div className="grid sm:grid-cols-3 gap-8">
          {values.map((value) => (
            <div key={value.title} className="border border-foreground/10 p-6">
              <h3 className="font-medium text-foreground mb-2">{value.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{value.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border border-foreground/10 p-8 flex items-start gap-4">
        <Mail className="w-5 h-5 text-foreground mt-0.5 shrink-0" />
        <div>
          <h3 className="font-medium text-foreground mb-1">Get on our radar</h3>
          <p className="text-muted-foreground leading-relaxed">
            Send a short note and whatever you'd like us to see to{" "}
            <span className="text-foreground">careers@flousy.app</span>. We
            read everything, even without an open role to point you to.
          </p>
        </div>
      </div>
    </StaticPageShell>
  );
}
