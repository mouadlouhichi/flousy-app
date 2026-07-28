import type { Metadata } from "next";
import { StaticPageShell } from "@/components/static/page-shell";
import { ContactForm, ContactEmailNote } from "@/components/static/contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the Flousy team.",
};

export default function ContactPage() {
  return (
    <StaticPageShell
      eyebrow="Contact"
      title="Let's talk."
      subtitle="Questions about your account, Flousy Pro, or just want to say hi? Send us a message and we'll get back to you soon."
    >
      <ContactEmailNote />
      <ContactForm />
    </StaticPageShell>
  );
}
