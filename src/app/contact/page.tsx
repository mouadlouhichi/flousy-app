"use client";
import { StaticPageShell } from "@/components/static/page-shell";
import { useLightLanguage } from "@/lib/i18n-light";
import { ContactForm, ContactEmailNote } from "@/components/static/contact-form";

export default function ContactPage() {
  const { messages: m } = useLightLanguage();
  const s = m.static.contact;
  return (
    <StaticPageShell eyebrow={s.eyebrow} title={s.title} subtitle={s.subtitle}>
      <ContactEmailNote />
      <ContactForm />
    </StaticPageShell>
  );
}
