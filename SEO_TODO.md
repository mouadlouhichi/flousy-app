# SEO and External Presence Checklist

> Last reconciled: 2026-09-02 check
>
> Repository SEO work is implemented and regression-tested. The unchecked items
> below require control of DNS, hosting, search or social accounts. They must not
> be represented as complete by application code.

The release/operator source of truth is
[`PRODUCTION_CHECKLIST.md`](PRODUCTION_CHECKLIST.md). This file contains only
SEO, email-domain and public-presence follow-up.

## Domain and search — external

- [ ] Point the intended production domain to the recorded production deployment
      and verify HTTPS/redirect behavior.
- [ ] Set production `NEXT_PUBLIC_SITE_URL` to that exact origin and rebuild.
- [ ] Verify that canonical links, Open Graph URLs, `robots.txt`, `sitemap.xml`
      and `llms.txt` resolve on the production origin.
- [ ] Add the site to Google Search Console and any other chosen webmaster tools;
      verify ownership through an operator-controlled method.
- [ ] Submit `/sitemap.xml` only after DNS is stable and inspect indexing/coverage
      reports for real errors.
- [ ] Run Lighthouse/PageSpeed and real-device Core Web Vitals checks against the
      deployed production build, targeting the public homepage (`/`) — not
      `/dashboard`, `/login` or `/onboarding`. Those routes are intentionally
      `noindex, nofollow` plus `robots.txt`-disallowed (private app screens), so
      Lighthouse's "page is blocked from indexing" audit caps them at ~66 SEO
      by design. Raising that score would mean exposing private screens to
      crawlers and must not be done.
- [ ] Define a factual content/partnership strategy. Do not buy links or publish
      misleading directory listings.

## Locale routing decision

At launch, SmartJib intentionally has one URL per page. English, French and Arabic
are client preferences; `/en`, `/fr` and `/ar` routes do not exist. The app
therefore publishes self-canonical URLs and no fabricated hreflang cluster.

Post-launch, if localized search acquisition is a priority:

- [ ] Implement real locale-prefixed routes and server-rendered localized
      metadata/content.
- [ ] Add reciprocal hreflang (including an intentional `x-default`) only after
      every advertised URL returns localized indexable content.
- [ ] Generate locale-aware sitemap entries and structured data, then add crawler
      regressions.

## Sending-domain authentication — external launch gate

Resend supplies the exact records for the configured sender domain:

- [ ] Publish and validate Resend DKIM records.
- [ ] Publish one valid SPF record that includes every legitimate sender; do not
      create conflicting SPF TXT records.
- [ ] Publish DMARC with an owned report mailbox, start in monitoring mode and
      move to quarantine/reject only after reports are understood.
- [ ] Verify production `RESEND_FROM_EMAIL` is on that domain and is not
      `@resend.dev`.
- [ ] Test contact and invitation delivery, links and Reply-To behavior across
      several mailbox providers.

## Social and organization identity — external, non-blocking unless advertised

No social profile is linked from the app until an operator confirms it is owned,
branded and monitored.

- [ ] Decide which networks SmartJib will actually operate.
- [ ] Reserve and verify official handles; do not assume `smartjibapp` or another
      handle is available or owned.
- [ ] Enable MFA, record primary/backup owners and define a response policy.
- [ ] Add footer links and `Organization.sameAs` only for verified live profiles.
- [ ] Keep social-ad pixels out of scope unless a separate consent, privacy,
      retention and payload review is completed.

## Repository status

Implemented in code:

- validated environment-owned canonical origin;
- public route metadata and generated Open Graph image;
- root Open Graph/Twitter/robots defaults, so routes without their own
  social block still unfurl with brand title and image;
- large-image social cards with OG image on all static marketing pages;
- explicit crawler directives with large image previews for Googlebot;
- factual SoftwareApplication, Organization, WebSite, Blog and FAQ JSON-LD;
- factual `public/llms.txt`;
- no invalid locale alternates;
- hydration keeps prerendered keyword titles on public pages (English) and
  never degrades unmapped marketing routes to a generic title;
- one link per URL per footer nav block;
- SEO tests aligning currency, strategy, pricing FAQ, public routes,
  social/robots baselines, hydrated titles and footer links.
