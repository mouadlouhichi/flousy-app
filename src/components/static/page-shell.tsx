import type { ReactNode } from "react";
import Link from "next/link";
import { Navigation } from "@/components/landing/navigation";
import { FooterSection } from "@/components/landing/footer-section";

export function StaticPageShell({
  eyebrow,
  title,
  subtitle,
  children,
  maxWidth = "max-w-3xl",
  breadcrumbs,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle?: string;
  children: ReactNode;
  maxWidth?: string;
  breadcrumbs?: Array<{ name: string; href: string }>;
}) {
  return (
    <main id="main-content" className="backdrop-mint relative min-h-screen overflow-x-hidden noise-overlay">
      <Navigation />

      <section className="relative pt-40 pb-16 lg:pt-48 lg:pb-24">
        <div className={`mx-auto px-6 lg:px-12 ${maxWidth}`}>
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav aria-label="Breadcrumb" className="mb-8 flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground">
              {breadcrumbs.map((crumb, idx) => (
                <span key={crumb.href} className="flex items-center gap-2">
                  {idx > 0 && <span aria-hidden="true">/</span>}
                  <Link href={crumb.href} className="hover:text-foreground">
                    {crumb.name}
                  </Link>
                </span>
              ))}
            </nav>
          )}
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container-lowest/80 py-1.5 pe-4 ps-1.5 text-[13px] font-medium text-on-surface shadow-ambient backdrop-blur">
            <span aria-hidden="true" className="flex size-6 items-center justify-center rounded-full bg-lime text-forest-deep"><span className="size-1.5 rounded-full bg-forest-deep" /></span>
            {eyebrow}
          </span>
          <h1 className="font-display font-semibold text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-[-0.03em] text-foreground mb-6">
            {title}
          </h1>
          {subtitle && (
            <p className="text-lg lg:text-xl text-muted-foreground leading-relaxed max-w-2xl">
              {subtitle}
            </p>
          )}
        </div>
      </section>

      <section className="relative pb-24 lg:pb-32">
        <div className={`mx-auto px-6 lg:px-12 ${maxWidth}`}>{children}</div>
      </section>

      <FooterSection />
    </main>
  );
}
