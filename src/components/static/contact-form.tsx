"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, CheckCircle2, Mail } from "lucide-react";
import { useLightLanguage } from "@/lib/i18n-light";

const SUPPORT_EMAIL = "hello@flousy.app";

type SendState = "idle" | "sending" | "sent" | "failed" | "rate_limited" | "not_configured";

/**
 * Real contact form. It POSTs to `/api/contact` and only shows "sent" when
 * the server accepted the message — the previous version flipped to a success
 * screen without transmitting anything (2026-09 audit finding). Every failure
 * mode is truthful and offers the direct support address as a fallback.
 */
export function ContactForm() {
  const { messages: m, t } = useLightLanguage();
  const s = m.static.contact;
  const [state, setState] = useState<SendState>("idle");
  // One id per form session: retries and double-clicks reuse it, so the server
  // can deduplicate instead of mailing twice.
  const requestIdRef = useRef<string>("");
  if (!requestIdRef.current) {
    requestIdRef.current =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (state === "sending") return;
    const form = e.currentTarget;
    const data = new FormData(form);
    setState("sending");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(data.get("name") || ""),
          email: String(data.get("email") || ""),
          topic: String(data.get("topic") || ""),
          message: String(data.get("message") || ""),
          website: String(data.get("website") || ""),
          requestId: requestIdRef.current,
        }),
      });
      if (response.ok) {
        setState("sent");
        return;
      }
      if (response.status === 429) {
        setState("rate_limited");
        return;
      }
      if (response.status === 503) {
        setState("not_configured");
        return;
      }
      setState("failed");
    } catch {
      setState("failed");
    }
  };

  if (state === "sent") {
    return (
      <div className="border border-foreground/10 p-12 text-center">
        <CheckCircle2 className="w-10 h-10 mx-auto mb-6 text-primary" />
        <h2 className="font-display text-2xl text-foreground mb-3">{s.sentTitle}</h2>
        <p className="text-muted-foreground">
          {s.sentDescription}
        </p>
      </div>
    );
  }

  const errorMessage =
    state === "rate_limited"
      ? s.rateLimited
      : state === "not_configured"
        ? t(s.notConfigured, { email: SUPPORT_EMAIL })
        : state === "failed"
          ? t(s.sendFailed, { email: SUPPORT_EMAIL })
          : "";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="name">{s.yourName}</Label>
          <Input id="name" name="name" placeholder={s.yourName} maxLength={120} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">{s.emailAddress}</Label>
          <Input id="email" name="email" type="email" placeholder={m.auth.emailPlaceholder} maxLength={254} required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="topic">{s.topic}</Label>
        <Input id="topic" name="topic" placeholder={s.topicPlaceholder} maxLength={150} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">{s.message}</Label>
        <Textarea id="message" name="message" placeholder={s.messagePlaceholder} maxLength={5000} className="min-h-40" required />
      </div>

      {/* Honeypot: hidden from people (and from the accessibility tree), a
          classic bot trap. The server silently drops submissions that fill it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {errorMessage && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {errorMessage}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={state === "sending"}
        className="bg-primary hover:bg-accent-foreground text-primary-foreground px-8 h-14 text-base rounded-full group"
      >
        {state === "sending" ? s.sending : s.send}
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
