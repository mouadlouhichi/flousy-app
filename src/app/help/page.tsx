"use client";
import { StaticPageShell } from "@/components/static/page-shell";
import { useLightLanguage } from "@/lib/i18n-light";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function HelpPage() {
  const { messages: m } = useLightLanguage();
  const s = m.static.help;
  const faqs = s.faqs as Array<{question:string;answer:string}>;
  return (
    <StaticPageShell eyebrow={s.eyebrow} title={s.title} subtitle={s.subtitle}>
      <Accordion type="single" collapsible className="w-full">
        {faqs.map((faq,i)=>(<AccordionItem key={faq.question} value={`item-${i}`} className="border-foreground/10"><AccordionTrigger className="text-lg font-display hover:no-underline py-6">{faq.question}</AccordionTrigger><AccordionContent className="text-muted-foreground leading-relaxed text-base">{faq.answer}</AccordionContent></AccordionItem>))}
      </Accordion>
      <p className="mt-16 text-muted-foreground">{s.stillStuck}{" "}<a href="/contact" className="text-foreground underline underline-offset-4 hover:no-underline">{s.getInTouch}</a>.</p>
    </StaticPageShell>
  );
}
