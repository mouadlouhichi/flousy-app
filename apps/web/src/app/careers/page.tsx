"use client";
import { StaticPageShell } from "@/components/static/page-shell";
import { useLightLanguage } from "@/lib/i18n-light";
import { Mail } from "lucide-react";

export default function CareersPage() {
  const { messages: m } = useLightLanguage();
  const s = m.static.careers;
  const values = s.values as Array<{title:string;description:string}>;
  return (
    <StaticPageShell eyebrow={s.eyebrow} title={s.title} subtitle={s.subtitle}>
      <div className="space-y-10 mb-16">
        <h2 className="font-display text-2xl lg:text-3xl text-foreground">{s.valuesTitle}</h2>
        <div className="grid sm:grid-cols-3 gap-8">
          {values.map(v=>(<div key={v.title} className="border border-foreground/10 p-6"><h3 className="font-medium text-foreground mb-2">{v.title}</h3><p className="text-sm text-muted-foreground leading-relaxed">{v.description}</p></div>))}
        </div>
      </div>
      <div className="border border-foreground/10 p-8 flex items-start gap-4">
        <Mail className="w-5 h-5 text-foreground mt-0.5 shrink-0" />
        <div><h3 className="font-medium text-foreground mb-1">{s.getOnRadar}</h3><p className="text-muted-foreground leading-relaxed">{s.getOnRadarDescription}{" "}<span className="text-foreground">careers@flousy.app</span>{s.getOnRadarSuffix}</p></div>
      </div>
    </StaticPageShell>
  );
}
