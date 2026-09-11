# SmartJib marketing operating folder

A launch-ready, Morocco-first marketing system built on the published SmartJib identity: calm teal, warm cream, mint, coral and saffron; confident Plus Jakarta Sans / Cairo display typography; and a clear, non-judgmental voice.

## Start here

| Workstream | Primary document | Ready-to-use output |
| --- | --- | --- |
| Brand and claims | [`BRAND_GOVERNANCE.md`](BRAND_GOVERNANCE.md) | Cross-channel rules, approved claims, forbidden claims, review gates |
| Marketing strategy | [`strategy/MARKETING_STRATEGY.md`](strategy/MARKETING_STRATEGY.md) | Positioning, audience, funnel, channel mix, budget scenarios |
| 90-day execution | [`strategy/90_DAY_PLAN.md`](strategy/90_DAY_PLAN.md) | Week-by-week launch plan and owner checklist |
| Measurement | [`strategy/MEASUREMENT_PLAN.md`](strategy/MEASUREMENT_PLAN.md) | KPI tree, event requirements, UTM convention and dashboard spec |
| Instagram | [`instagram/README.md`](instagram/README.md) | Existing upload-ready launch grid, Reels, Stories, captions and templates |
| Instagram month 1 | [`instagram/30_DAY_CALENDAR.csv`](instagram/30_DAY_CALENDAR.csv) | Daily publish/community schedule |
| Mailing | [`mailing/README.md`](mailing/README.md) | Consent-safe lifecycle map, send plan and responsive HTML templates |
| Email copy | [`mailing/EMAIL_COPY.md`](mailing/EMAIL_COPY.md) | French and Darija/Arabic campaign copy |
| Advertising | [`advertising/README.md`](advertising/README.md) | Media plan, ad matrix, copy bank, experiments and generated artwork |
| Paid campaign import | [`advertising/campaign-matrix.csv`](advertising/campaign-matrix.csv) | Build sheet with audience, creative, URL and KPI |

## Strategic headline

> **Ton budget. Ton rythme.**  
> SmartJib helps people in Morocco plan everyday money in MAD without connecting a bank account. It keeps two questions separate: what money is for, and where it is held.

Arabic/Darija companion line:

> **فلوسك بوضوح، بلا ضغط.**

## Campaign architecture

- **Brand campaign:** `clarity_ma`
- **Core promise:** a clearer monthly plan, at the user’s pace.
- **Product distinction:** purpose (needs, wants, savings) is separate from place (bank, home, wallet).
- **Trust proof:** manual tracking; no bank connection and no bank credentials requested.
- **Market:** Morocco first; MAD examples by default.
- **Language rotation:** Darija/Arabic for community and familiarity, French for explanation, English only where it broadens discovery.
- **Primary conversion:** start SmartJib on the web/PWA. Never say “download” unless an app-store listing exists.

## Non-negotiable launch gates

Do not start paid acquisition or marketing email sends until all applicable boxes are complete:

- [ ] Production URL and `/login` flow pass a mobile smoke test.
- [ ] Analytics remains opt-in and the conversion events in `strategy/MEASUREMENT_PLAN.md` are implemented and tested.
- [ ] Marketing email has its own explicit consent record, lawful sender identity, unsubscribe flow and suppression list. Product or household email permission is **not** marketing permission.
- [ ] `hello@smartjib.app` is monitored with a named response owner.
- [ ] A Morocco-based Darija/Arabic reviewer approves paid copy and email subject lines.
- [ ] Every promoted product claim is present in `BRAND_GOVERNANCE.md` and still matches the live build.
- [ ] Ad platform pixels/cookies are not installed without an updated consent and privacy review.
- [ ] Demo screenshots contain no real names, balances, email addresses or account information.

## Roles and approval flow

| Role | Accountable for | Required before publish |
| --- | --- | --- |
| Marketing lead | Strategy, calendar, budget and final go/no-go | Every campaign |
| Brand/copy lead | Voice, visual identity and claim accuracy | Every asset |
| Morocco localization reviewer | Darija/Arabic fluency and cultural fit | Paid, legal and major local-language copy |
| Lifecycle owner | Consent, segmentation, delivery and suppression | Every marketing send |
| Paid acquisition owner | Platform setup, pacing, exclusions and experiment log | Every paid launch/change |
| Product/analytics owner | Landing flow, consented events, attribution and QA | Before spend and weekly |
| Support/community owner | Replies, escalation and abuse handling | Before public launch |

One person can cover several roles, but each approval must still be explicit.

## Source-of-truth rules

1. Product reality wins over campaign copy.
2. [`BRAND_GOVERNANCE.md`](BRAND_GOVERNANCE.md) wins over an older caption or ad.
3. Generated PNGs are delivery files; their checked-in scripts/templates are the editable source.
4. Record every campaign URL, date, creative and result in the supplied CSVs.
5. Report aggregated behavior only. Never send financial amounts, category names, transaction text or personal identifiers to advertising/analytics platforms.

## Regenerate visual assets

```bash
node scripts/generate-instagram-kit.mjs
node scripts/generate-marketing-ad-kit.mjs
```

Both scripts use the locally licensed fonts in `marketing/instagram/fonts/` and ImageMagick. The ad generator writes only inside `marketing/advertising/assets/` and `marketing/mailing/assets/`.
