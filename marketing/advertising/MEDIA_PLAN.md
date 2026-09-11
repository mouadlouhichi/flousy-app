# Paid media plan — Morocco pilot

## Objective

Find a repeatable message and high-intent audience that produces activated first budgets at an acceptable cost while preserving SmartJib’s privacy posture.

## Preconditions

Paid campaigns remain **paused** until:

1. the production funnel passes mobile QA;
2. consented landing/account/onboarding events are verified with no financial payloads;
3. UTMs survive attribution in an approved, privacy-safe way;
4. campaign owners, caps and emergency pause access are assigned;
5. every local-language paid asset has final review.

## Channel roles

| Channel | Role | Initial message | Landing page |
| --- | --- | --- | --- |
| Search | Capture active “budget app / MAD / cash tracking” intent | Local relevance or manual privacy | Relevant feature/method page |
| Meta feed/Reels/Stories | Create demand and validate hooks visually | Calm, purpose/place, privacy | Home or matching feature page |
| Creator/UGC paid usage | Add explanation and local credibility | Product walkthrough with demo data | Home page |
| Display | Retargeting only after consent approval; otherwise contextual placements | Manual privacy | No-bank-connection page |

Do not add more channels during the pilot. TikTok, YouTube, partnerships and affiliates are next-stage options after one acquisition system is understood.

## Pilot budget and allocation

Example for a **30,000 MAD monthly ceiling**:

| Bucket | Planned | Release rule |
| --- | ---: | --- |
| Meta prospecting | 9,000 | Three equal message cells; release weekly |
| Search high intent | 6,000 | Exact/phrase intent with query review |
| Creator pilots | 5,000 | 2–3 transparent demo-data briefs |
| Creative/localization | 4,000 | Includes native review and subtitles |
| Scale reserve | 4,000 | Only after activation-quality winner |
| Incident/learning reserve | 2,000 | Keep unspent unless needed |

A smaller budget should reduce the number of simultaneous cells, not starve every test. Start with Meta calm vs purpose/place and one high-intent search group if spend is below 10,000 MAD.

## Meta structure

```text
Campaign: clarity_ma_pilot_meta
  Ad set: broad_ma_fr
    calm_feed_fr_v1
    purpose_place_feed_fr_v1
    private_feed_fr_v1
  Ad set: broad_ma_ar
    calm_feed_ar_v1
    purpose_place_ar_v2 (after production/review)
    private_ar_v2 (after production/review)
```

Use broad/contextual platform options and age settings supported by current policy. Do not infer vulnerable financial status or target predatory “debt desperation” interests. Keep French and Arabic creative separate so delivery and experience can be interpreted.

## Search structure

| Group | Example intent themes | Negative themes |
| --- | --- | --- |
| `budget_mad_fr` | application budget maroc, budget mensuel mad, gérer budget dirham | crédit rapide, prêt, trading, crypto, emploi |
| `budget_cash_fr` | suivre dépenses cash, budget portefeuille argent | banque login, relevé bancaire piraté |
| `private_manual_fr` | application budget sans connexion bancaire, suivi manuel dépenses | anonymat garanti, cacher argent |
| `budget_ar` | تطبيق ميزانية المغرب, تنظيم المصروف بالدرهم | قرض سريع, تداول, ربح مضمون |

Keyword examples require live query/tool validation before launch. Use exact/phrase control initially, review search terms frequently, and keep negative lists updated.

## Landing alignment

- `calm` → homepage.
- `purpose_place` → `/blog/what-its-for-vs-where-it-is` or `/features/track-bank-home-wallet`.
- `private` → `/features/no-bank-connection`.
- `mad` → `/features/multi-currency-mad`.

Do not route every ad to the homepage if a focused page answers the promise better. Preserve language where the site supports it and QA the full flow.

## Pacing

- Daily cap at campaign and account level.
- First 72 hours: only integrity, policy and spend-anomaly changes unless an immediate block occurs.
- Weekly: creative/message decision using activated-budget cost and landing-to-activation.
- Scale by no more than 20–30% per week during the learning phase.
- Watch support volume and product incidents as guardrails.

## Reporting

Report spend, impressions, qualified landing sessions, CTA starts, account completions, onboarding completions and week-one quality. Label platform and first-party attribution separately. Never present CTR as the business outcome.
