"use client";
import { StaticPageShell } from "@/components/static/page-shell";
import { useLightLanguage } from "@/lib/i18n-light";

export default function CookiesPage() {
  const { messages: m } = useLightLanguage();
  const s = m.static.cookies;
  const sections = s.sections as Array<{title:string;body:string}>;
  return (
    <StaticPageShell eyebrow={s.eyebrow} title={s.title} subtitle={s.subtitle}>
      <div className="space-y-12">
        {sections.map(sec=>(<div key={sec.title}><h2 className="font-display text-2xl text-foreground mb-3">{sec.title}</h2><p className="text-muted-foreground leading-relaxed">{sec.body}</p></div>))}
      </div>
    </StaticPageShell>
  );
}
