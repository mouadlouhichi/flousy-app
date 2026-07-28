import type { Metadata } from "next";
import { StaticPageShell } from "@/components/static/page-shell";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const metadata: Metadata = {
  title: "Help Center — Flousy",
  description: "Answers to common questions about budgeting with Flousy.",
};

const faqs = [
  {
    question: "Do I need to connect my bank account?",
    answer:
      "No. Flousy never asks for your bank login, card number, or account number. You add your income and expenses yourself, and choose which place — bank, home, or wallet — each one belongs to.",
  },
  {
    question: "How does Flousy decide my budget?",
    answer:
      "You pick a budgeting style that fits how you think about money. Flousy then splits your income into needs, wants, and savings automatically. You can switch styles at any time, and your categories adjust to match.",
  },
  {
    question: "What's the difference between 'what it's for' and 'where it is'?",
    answer:
      "Your budget decides what your money is for — rent is a need, dinner out is a want. Separately, Flousy tracks where that money actually sits — in your bank, at home, or in your wallet. Keeping these separate means your numbers always make sense.",
  },
  {
    question: "Can I use more than one currency?",
    answer:
      "Yes. Flousy supports 12 currencies, and you can switch your display currency anytime from Settings.",
  },
  {
    question: "What happens if I delete an expense by mistake?",
    answer:
      "The money is returned to wherever it came from, instantly and exactly. Nothing about your balances is ever left out of sync.",
  },
  {
    question: "What do I get with Flousy Pro?",
    answer:
      "Pro adds spending trends over time, automatic recurring bills, overspending alerts, and the ability to import your past spending in one go — on top of everything in the free plan.",
  },
  {
    question: "Can I export my data?",
    answer:
      "Yes, anytime. Head to Settings to download your full budgeting history as a spreadsheet.",
  },
  {
    question: "How do I delete my account?",
    answer:
      "You can permanently delete your account and all of your data from Settings, with no need to contact support.",
  },
];

export default function HelpPage() {
  return (
    <StaticPageShell
      eyebrow="Help center"
      title="Questions, answered."
      subtitle="Can't find what you're looking for? Reach out and we'll get back to you."
    >
      <Accordion type="single" collapsible className="w-full">
        {faqs.map((faq, index) => (
          <AccordionItem key={faq.question} value={`item-${index}`} className="border-foreground/10">
            <AccordionTrigger className="text-lg font-display hover:no-underline py-6">
              {faq.question}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed text-base">
              {faq.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <p className="mt-16 text-muted-foreground">
        Still stuck?{" "}
        <a href="/contact" className="text-foreground underline underline-offset-4 hover:no-underline">
          Get in touch with us
        </a>
        .
      </p>
    </StaticPageShell>
  );
}
