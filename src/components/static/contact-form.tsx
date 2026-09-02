"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, CheckCircle2, Mail } from "lucide-react";
import { useLightLanguage } from "@/lib/i18n-light";

export function ContactForm() {
  const { messages: m, language } = useLightLanguage();
  const s = m.static.contact;
  const [submitted, setSubmitted] = useState(false);
  const requestIdRef = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");

    const form = event.currentTarget;
    const values = new FormData(form);
    requestIdRef.current ||= crypto.randomUUID();
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.get('name'),
          email: values.get('email'),
          topic: values.get('topic'),
          message: values.get('message'),
          website: values.get('website'),
          locale: language,
          requestId: requestIdRef.current,
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`contact_${response.status}`);
      setSubmitted(true);
      form.reset();
    } catch (submitError) {
      console.error('Contact message was not delivered:', submitError);
      setError(s.sendError);
    } finally {
      window.clearTimeout(timeout);
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <div className="border border-foreground/10 p-12 text-center" role="status">
        <CheckCircle2 className="w-10 h-10 mx-auto mb-6 text-primary" />
        <h2 className="font-display text-2xl text-foreground mb-3">{s.sentTitle}</h2>
        <p className="text-muted-foreground">{s.sentDescription}</p>
        {requestIdRef.current && (
          <p className="mt-4 text-xs text-muted-foreground">
            {s.requestId}: <code className="select-all font-mono">{requestIdRef.current}</code>
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={(event) => { void handleSubmit(event); }} className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="name">{s.yourName}</Label>
          <Input id="name" name="name" placeholder={s.yourName} maxLength={100} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">{s.emailAddress}</Label>
          <Input id="email" name="email" type="email" placeholder={m.auth.emailPlaceholder} maxLength={254} required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="topic">{s.topic}</Label>
        <Input id="topic" name="topic" placeholder={s.topicPlaceholder} maxLength={120} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">{s.message}</Label>
        <Textarea
          id="message"
          name="message"
          placeholder={s.messagePlaceholder}
          className="min-h-40"
          minLength={10}
          maxLength={5000}
          required
        />
      </div>

      <div className="hidden" aria-hidden="true">
        <Label htmlFor="website">Website</Label>
        <Input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}

      <Button
        type="submit"
        size="lg"
        disabled={busy}
        className="bg-primary hover:bg-accent-foreground text-primary-foreground px-8 h-14 text-base rounded-full group"
      >
        {busy ? s.sending : s.send}
        <ArrowRight className="w-4 h-4 ms-2 transition-transform group-hover:translate-x-1 rtl:rotate-180" />
      </Button>
    </form>
  );
}

export function ContactEmailNote() {
  const { messages: m } = useLightLanguage();
  return (
    <div className="flex items-center gap-3 text-muted-foreground mb-12">
      <Mail className="w-4 h-4" />
      <span>{m.static.contact.emailNote}</span>
    </div>
  );
}
