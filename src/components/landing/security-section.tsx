"use client";

import { useEffect, useState, useRef } from "react";
import { Shield, Lock, Eye, FileCheck } from "lucide-react";
import { useLightLanguage } from "@/lib/i18n-light";

const securityFeatures = [
  {
    icon: Shield,
    title: "Private by default",
    description: "Firestore security rules isolate each account so signed-in users can access only their own budget.",
  },
  {
    icon: Lock,
    title: "No bank connections",
    description: "We never ask for your card or account numbers. You stay in control of what you enter.",
  },
  {
    icon: Eye,
    title: "No advertising profiles",
    description: "We do not use your financial data to build advertising profiles or sell it to third parties.",
  },
  {
    icon: FileCheck,
    title: "Export or delete anytime",
    description: "Download everything as a spreadsheet, or erase your account completely, whenever you like.",
  },
];

const certifications = ["Private accounts", "No bank sync required", "Data export", "Easy account deletion", "No ad tracking"];

export function SecuritySection() {
  const { messages: m } = useLightLanguage();
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="security" ref={sectionRef} className="relative py-24 lg:py-32 bg-foreground/[0.02] overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24">
          {/* Left: Content */}
          <div
            className={`transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
              <span className="w-8 h-px bg-foreground/30" />
              Privacy
            </span>
            <h2 className="text-4xl lg:text-6xl font-display tracking-tight mb-8">
              {m.landing.security.titleLine1}
              <br />
              {m.landing.security.titleLine2}
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed mb-12">
              Budgeting means sharing personal details about your life. We
              take that seriously — your information stays private, protected,
              and always under your control.
            </p>

            {/* Certifications */}
            <div className="flex flex-wrap gap-3">
              {certifications.map((cert, index) => (
                <span
                  key={cert}
                  className={`px-4 py-2 border border-foreground/10 text-sm font-mono transition-all duration-500 ${
                    isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                  }`}
                  style={{ transitionDelay: `${index * 50 + 200}ms` }}
                >
                  {cert}
                </span>
              ))}
            </div>
          </div>

          {/* Right: Features */}
          <div className="grid gap-6">
            {securityFeatures.map((feature, index) => (
              <div
                key={feature.title}
                className={`p-6 border border-foreground/10 hover:border-foreground/20 transition-all duration-500 group ${
                  isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
                }`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-10 h-10 flex items-center justify-center border border-foreground/10 group-hover:bg-foreground group-hover:text-background transition-colors duration-300">
                    <feature.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium mb-1 group-hover:translate-x-1 transition-transform duration-300">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
