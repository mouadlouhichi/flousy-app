'use client';
import { StaticPageShell } from "@/components/static/page-shell";
import { useLightLanguage } from "@/lib/i18n-light";

export default function TermsPage() {
  const { messages: m, language } = useLightLanguage();
  const sections = [
    { title: m.legal.terms.s1Title, body: m.legal.terms.s1Body },
    { title: m.legal.terms.s2Title, body: m.legal.terms.s2Body },
    { title: m.legal.terms.s3Title, body: m.legal.terms.s3Body },
    { title: m.legal.terms.s4Title, body: m.legal.terms.s4Body },
    { title: m.legal.terms.s5Title, body: m.legal.terms.s5Body },
    { title: m.legal.terms.s6Title, body: m.legal.terms.s6Body },
    { title: m.legal.terms.s7Title, body: m.legal.terms.s7Body },
    { title: m.legal.terms.s8Title, body: m.legal.terms.s8Body },
    { title: m.legal.terms.s9Title, body: m.legal.terms.s9Body },
  ];
  return (
    <StaticPageShell eyebrow={m.legal.eyebrow} title={m.legal.termsTitle} subtitle={m.legal.termsSubtitle}>
      <div className="space-y-12">
        {language !== 'en' && (<div className="p-4 bg-muted/30 border border-foreground/10 rounded-xl text-sm text-muted-foreground italic">{m.legal.authoritativeNotice}</div>)}
        {sections.map(s=>(<div key={s.title}><h2 className="font-display text-2xl text-foreground mb-3">{s.title}</h2><p className="text-muted-foreground leading-relaxed">{s.body}</p></div>))}
      </div>
    </StaticPageShell>
  );
}
