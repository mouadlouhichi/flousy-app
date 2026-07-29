"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, CheckCircle2, Mail } from "lucide-react";
import { useLightLanguage } from "@/lib/i18n-light";

export function ContactForm() {
  const { messages: m } = useLightLanguage();
  const s = m.static.contact;
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="name">{s.yourName}</Label>
          <Input id="name" name="name" placeholder="Jane Doe" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">{s.emailAddress}</Label>
          <Input id="email" name="email" type="email" placeholder="you@example.com" required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="topic">{s.topic}</Label>
        <Input id="topic" name="topic" placeholder="Question about Pro, a bug, feedback..." />
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">{s.message}</Label>
        <Textarea id="message" name="message" placeholder="Tell us a bit more..." className="min-h-40" required />
      </div>

      <Button
        type="submit"
        size="lg"
        className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 h-14 text-base rounded-full group"
      >
        Send message
        <ArrowRight className="w-4 h-4 ms-2 transition-transform group-hover:translate-x-1" />
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
