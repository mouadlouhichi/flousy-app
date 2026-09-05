"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Menu, X, Moon, Sun, Globe } from "lucide-react";
import { useLightLanguage } from "@/lib/i18n-light";
import { useAuthStatus } from '@/lib/auth-status';

export function Navigation() {
  const { messages: m, language, setLanguage, localeNames } = useLightLanguage();
  const { signedIn: user } = useAuthStatus();
  const isDemo = typeof window !== 'undefined' && localStorage.getItem('flousy_demo_mode') === 'true';
  const isLoggedIn = Boolean(user || isDemo);

  const navLinks = [
    { name: m.landing.nav.features, href: "/features" },
    { name: "Budgeting Methods", href: "/budgeting-methods" },
    { name: "MAD Guide", href: "/features/multi-currency-mad" },
    { name: m.landing.nav.pricing, href: "/#pricing" },
    { name: "Blog", href: "/blog" },
  ];
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLang, setShowLang] = useState(false);
  const [isThemeDark, setIsThemeDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (isThemeDark) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [isThemeDark]);

  // Lock background scroll and allow Escape to close the full-screen menu.
  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isMobileMenuOpen]);

  const toggleTheme = () => setIsThemeDark((d) => !d);

  return (
    <header
      className={`fixed z-50 transition-all duration-500 ${
        isScrolled 
          ? "top-4 start-4 end-4" 
          : "top-0 start-0 end-0"
      }`}
    >
      {/* `relative z-50` keeps the bar — and crucially the mobile close (X)
          button — stacked ABOVE the full-screen menu overlay below, which is
          its sibling. Without it the overlay painted over the X and the menu
          could not be closed. */}
      <nav 
        className={`relative z-50 mx-auto transition-all duration-500 ${
          isScrolled || isMobileMenuOpen
            ? "bg-background/80 backdrop-blur-xl border border-foreground/10 rounded-2xl shadow-lg max-w-[1200px]"
            : "bg-transparent max-w-[1400px]"
        }`}
      >
        <div 
          className={`flex items-center justify-between transition-all duration-500 px-6 lg:px-8 ${
            isScrolled ? "h-14" : "h-20"
          }`}
        >
          {/* Logo */}
          <a href="/" className="flex items-center gap-2 group">
            <Image
              src="/logo.png"
              alt={m.common.appName}
              width={34}
              height={34}
              className="object-contain"
              priority
            />
            <span className={`font-display tracking-tight transition-all duration-500 ${isScrolled ? "text-xl" : "text-2xl"}`}>SmartJib</span>
          </a>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-12">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-sm md:text-base font-semiBold text-foreground/70 hover:text-foreground transition-colors duration-300 relative group"
              >
                {link.name}
                <span className="absolute -bottom-1 start-0 w-0 h-px bg-foreground transition-all duration-300 group-hover:w-full" />
              </a>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-foreground/10 transition-colors text-foreground/70 hover:text-foreground"
              aria-label={isThemeDark ? m.landing.nav.switchToLight : m.landing.nav.switchToDark}
              title={isThemeDark ? m.landing.nav.lightMode : m.landing.nav.darkMode}
            >
              {isThemeDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Language Switcher */}
            <div className="relative">
              <button
                onClick={() => setShowLang((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-foreground/10 transition-colors"
                aria-label={m.landing.nav.changeLanguage}
                title={m.landing.nav.changeLanguage}
              >
                <Globe className="w-4 h-4" />
                <span className="uppercase text-xs font-bold">{language}</span>
              </button>
              <div
                className={`absolute end-0 top-full mt-2 bg-background border border-foreground/10 rounded-xl shadow-xl overflow-hidden transition-all duration-200 ${
                  showLang ? 'opacity-100 pointer-events-auto translate-y-0' : 'opacity-0 pointer-events-none translate-y-1'
                }`}
              >
                {(['en', 'fr', 'ar'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => { setLanguage(lang); setShowLang(false); }}
                    className={`w-full text-start px-4 py-2.5 text-sm hover:bg-foreground/5 transition-colors font-medium ${language === lang ? 'text-primary bg-primary/5' : 'text-foreground/80'}`}
                  >
                    {localeNames[lang]}
                  </button>
                ))}
              </div>
            </div>

            {isLoggedIn ? (
              <Button
                asChild
                size="sm"
                className={`bg-primary hover:bg-primary/90 hover:cursor-pointer rounded-full transition-all duration-500 ${isScrolled ? "px-4 h-8 text-sm" : "px-6"}`}
              >
                <a href="/dashboard">{m.landing.nav.goToDashboard}</a>
              </Button>
            ) : (
              <>
                <a href="/login" className={`font-bold text-foreground/70 hover:text-foreground transition-all duration-500 ${isScrolled ? "text-sm" : "text-base"}`}>
                  {m.landing.nav.signIn}
                </a>
                <Button
                  asChild
                  size="sm"
                  className={`bg-primary hover:bg-primary/90 hover:cursor-pointer rounded-full transition-all duration-500 ${isScrolled ? "px-4 h-8 text-sm" : "px-6"}`}
                >
                  <a href="/login">{m.landing.nav.startBudgeting}</a>
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden relative z-50 -me-2 flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-foreground/10"
            aria-label={isMobileMenuOpen ? m.landing.nav.closeMenu : m.landing.nav.openMenu}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-menu"
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

      </nav>
      
      {/* Mobile Menu - Full Screen Overlay */}
      <div
        id="mobile-menu"
        aria-hidden={!isMobileMenuOpen}
        className={`md:hidden fixed inset-0 bg-background z-40 transition-all duration-500 ${
          isMobileMenuOpen 
            ? "opacity-100 pointer-events-auto" 
            : "opacity-0 pointer-events-none"
        }`}
        style={{ top: 0 }}
      >
        <div className="flex flex-col h-full px-8 pt-28 pb-8">
          {/* Navigation Links */}
          <div className="flex-1 flex flex-col justify-center gap-8">
            {navLinks.map((link, i) => (
              <a
                key={link.name}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`text-5xl font-display text-foreground hover:text-muted-foreground transition-all duration-500 ${
                  isMobileMenuOpen 
                    ? "opacity-100 translate-y-0" 
                    : "opacity-0 translate-y-4"
                }`}
                style={{ transitionDelay: isMobileMenuOpen ? `${i * 75}ms` : "0ms" }}
              >
                {link.name}
              </a>
            ))}
          </div>
          
          {/* Mobile Theme + Language */}
          <div className={`flex items-center justify-center gap-3 pt-4 transition-all duration-500 ${
            isMobileMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`} style={{ transitionDelay: isMobileMenuOpen ? '150ms' : '0ms' }}>
            <button
              onClick={toggleTheme}
              className="p-3 rounded-full border border-foreground/10 text-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-colors"
              aria-label={isThemeDark ? m.landing.nav.lightMode : m.landing.nav.darkMode}
            >
              {isThemeDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <div className="flex gap-2">
              {(['en', 'fr', 'ar'] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  aria-label={localeNames[lang]}
                  className={`px-3 py-2 rounded-full text-xs font-bold uppercase border transition-colors ${language === lang ? 'bg-primary text-on-primary border-primary' : 'border-foreground/10 text-foreground/70 hover:text-foreground'}`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>

          {/* Bottom CTAs */}
          <div className={`flex gap-4 pt-8 border-t border-foreground/10 transition-all duration-500 ${
            isMobileMenuOpen 
              ? "opacity-100 translate-y-0" 
              : "opacity-0 translate-y-4"
          }`}
          style={{ transitionDelay: isMobileMenuOpen ? "300ms" : "0ms" }}
          >
            {isLoggedIn ? (
              <Button
                asChild
                className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-full h-14 text-base"
              >
                <a href="/dashboard" onClick={() => setIsMobileMenuOpen(false)}>{m.landing.nav.goToDashboard}</a>
              </Button>
            ) : (
              <>
                <Button
                  asChild
                  variant="outline"
                  className="flex-1 rounded-full h-14 text-base"
                >
                  <a href="/login">{m.landing.nav.signIn}</a>
                </Button>
                <Button
                  asChild
                  className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-full h-14 text-base"
                >
                  <a href="/login">{m.landing.nav.startBudgeting}</a>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
