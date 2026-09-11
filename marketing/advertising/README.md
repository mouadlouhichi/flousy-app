# SmartJib advertising kit

A controlled paid-acquisition pilot for Morocco, aligned to the published brand and privacy posture.

## Included

| File | Use |
| --- | --- |
| [`MEDIA_PLAN.md`](MEDIA_PLAN.md) | Channels, budget, phasing, targeting and pacing |
| [`AD_COPY.md`](AD_COPY.md) | French and Darija/Arabic copy bank by message |
| [`CREATIVE_BRIEFS.md`](CREATIVE_BRIEFS.md) | Production briefs, crops, proof and creator guidance |
| [`EXPERIMENTS.md`](EXPERIMENTS.md) | First six test cards and decision rules |
| [`PAID_LAUNCH_CHECKLIST.md`](PAID_LAUNCH_CHECKLIST.md) | Build, privacy, QA and monitoring controls |
| [`campaign-matrix.csv`](campaign-matrix.csv) | Campaign/ad-set build sheet and destination URLs |
| [`assets/`](assets/) | Generated feed, Story, landscape and preview PNGs |

## Campaign system

- Campaign family: `clarity_ma`.
- Geography: Morocco.
- Primary languages: French and Darija/Arabic in separate creatives/ad groups.
- Conversion: activated budget, once a reliable privacy-safe signal exists.
- Pilot messages: calm planning, purpose/place and manual privacy.
- Exclude existing users using a first-party privacy-safe mechanism only where consent and platform policy allow; never upload unconsented product accounts.

## Ready artwork

Run:

```bash
node scripts/generate-marketing-ad-kit.mjs
```

Expected output:

- `assets/meta/01-calm-plan-fr-feed.png`
- `assets/meta/02-purpose-place-fr-feed.png`
- `assets/meta/03-private-fr-feed.png`
- `assets/meta/04-calm-plan-ar-feed.png`
- `assets/meta/05-calm-plan-fr-story.png`
- `assets/meta/06-calm-plan-ar-story.png`
- `assets/display/07-private-fr-landscape.png`
- `assets/previews/smartjib-paid-creative-preview.png`

Artwork is an approved starting point, not a platform-ready campaign by itself. Supply ad-platform primary text/headline/description from `AD_COPY.md`, set accurate alt text, and inspect each placement preview.

## Hard rules

- Do not install or fire advertising pixels before consent/privacy review.
- Do not optimize using balances, income, expenses, debts, goals, household activity or other financial data.
- Do not use fear, wealth promises, false urgency or “100% secure/private” claims.
- Do not say “download” unless a real app-store listing is live.
- Review paid Darija/Arabic with a Morocco-based specialist.
- Pause immediately for broken tracking, product incidents, incorrect claims or unexpected spend.
