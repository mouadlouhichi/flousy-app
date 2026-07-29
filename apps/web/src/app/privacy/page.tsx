'use client';
import { StaticPageShell } from "@/components/static/page-shell";
import { useLightLanguage } from "@/lib/i18n-light";

export default function PrivacyPage() {
  const { messages: m, language } = useLightLanguage();
  const sections = [
    { title: m.legal.privacy.s1Title, body: m.legal.privacy.s1Body },
    { title: m.legal.privacy.s2Title, body: m.legal.privacy.s2Body },
    { title: m.legal.privacy.s3Title, body: m.legal.privacy.s3Body },
    { title: m.legal.privacy.s4Title, body: m.legal.privacy.s4Body },
    { title: m.legal.privacy.s5Title, body: m.legal.privacy.s5Body },
    { title: m.legal.privacy.s6Title, body: m.legal.privacy.s6Body },
    { title: m.legal.privacy.s7Title, body: m.legal.privacy.s7Body },
    { title: m.legal.privacy.s8Title, body: m.legal.privacy.s8Body },
  ];
  return (
    <StaticPageShell eyebrow={m.legal.eyebrow} title={m.legal.privacyTitle} subtitle={m.legal.privacySubtitle}>
      <div className="space-y-12">
        {language !== 'en' && (<div className="p-4 bg-muted/30 border border-foreground/10 rounded-xl text-sm text-muted-foreground italic">{m.legal.authoritativeNotice}</div>)}
        {sections.map(s=>(<div key={s.title}><h2 className="font-display text-2xl text-foreground mb-3">{s.title}</h2><p className="text-muted-foreground leading-relaxed">{s.body}</p></div>))}
      </div>
    </StaticPageShell>
  );
}
