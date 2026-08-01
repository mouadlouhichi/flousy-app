"use client";
import { StaticPageShell } from "@/components/static/page-shell";
import { useLightLanguage } from "@/lib/i18n-light";

export default function AboutPage() {
  const { messages: m } = useLightLanguage();
  const s = m.static.about;
  return (
    <StaticPageShell eyebrow={s.eyebrow} title={s.title} subtitle={s.subtitle}>
      <div className="prose-flousy space-y-10">
        {[{t:s.s1Title,b:s.s1Body},{t:s.s2Title,b:s.s2Body},{t:s.s3Title,b:s.s3Body},{t:s.s4Title,b:s.s4Body}].map(x=>(
          <div key={x.t}><h2 className="font-display text-2xl lg:text-3xl text-foreground mb-4">{x.t}</h2><p className="text-muted-foreground leading-relaxed">{x.b}</p></div>
        ))}
      </div>
    </StaticPageShell>
  );
}
