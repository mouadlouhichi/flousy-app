# SmartJib Instagram launch kit

A ready-to-upload, original Instagram identity and first-launch content system for **SmartJib**, refreshed for a friendly **Morocco-first** audience and synchronized with the product’s **Forest & Lime** system. It uses the current wallet mark, forest/lime/mint/sage tokens from [`../../DESIGN.md`](../../DESIGN.md), Plus Jakarta Sans with Cairo / IBM Plex Sans Arabic support, and French plus Arabic/Darija content. The launch grid combines supporting editorial imagery with crisp product-style information cards and renders Arabic/Darija with an explicit shaping and bidi pass. It does **not** copy artwork or copy from the supplied reference profile.

> **Start with:** [`previews/smartjib-instagram-profile-preview.png`](previews/smartjib-instagram-profile-preview.png) for the profile and first-grid preview.

## What is included

| Need | Location | Ready-to-upload asset |
| --- | --- | --- |
| Profile logo / avatar | [`brand/`](brand/) | `smartjib-instagram-avatar-1080.png` — 1080 × 1080 PNG, circular-crop safe |
| Official transparent logo mark | [`brand/`](brand/) | `smartjib-logo-mark-transparent.png` |
| Horizontal wordmark | [`brand/`](brand/) | `smartjib-horizontal-wordmark.png` — transparent 1800 × 600 PNG |
| Palette reference | [`brand/`](brand/) | `smartjib-social-palette.png` — Forest & Lime token reference |
| Production fonts + licenses | [`fonts/`](fonts/) | Plus Jakarta Sans for Latin/French, and Cairo + IBM Plex Sans Arabic for Arabic/Darija |
| Highlight covers | [`highlights/`](highlights/) | 8 × 1080 × 1920 PNG Story covers with Forest & Lime icon treatments |
| First feed grid | [`posts/`](posts/) | 9 × 1080 × 1350 PNG posts, designed as a coherent French + Arabic/Darija 3 × 3 launch grid |
| Starter stories | [`stories/`](stories/) | 8 × 1080 × 1920 PNG frames, one starter item for each Highlight |
| Reel covers | [`reels/`](reels/) | 3 × 1080 × 1920 PNG covers |
| Captions, alt text, hashtags | [`CAPTIONS.md`](CAPTIONS.md) | Copy/paste-ready text for all 9 feed posts |
| Bio and account fields | [`PROFILE_COPY.md`](PROFILE_COPY.md) | English, French, and Arabic bio variants |
| Reel scripts / story instructions | [`REELS_AND_STORIES.md`](REELS_AND_STORIES.md) | 3 short video scripts + sticker guidance |
| Brand system | [`BRAND_GUIDE.md`](BRAND_GUIDE.md) | Color, typography, accessibility, and asset rules |
| Lucide icon record | [`ICON_SOURCES.md`](ICON_SOURCES.md) | Exact official Lucide icons used across the kit |
| Original source image | [`source/`](source/) | Text-free editorial still life used as a supporting launch visual |
| Future editable files | [`templates/`](templates/) | SVG starter templates for Feed, Story, Reel, and Highlight art |

## Set up the account

Use the exact setup card in [`PROFILE_COPY.md`](PROFILE_COPY.md). The recommended starting configuration is:

- **Username:** `@smartjib.app` *(confirm availability first; backup options are included)*
- **Name field:** `SmartJib | Budget Maroc`
- **Account type:** Professional **Business** account
- **Category:** `Product/service` (hide the category label if it makes the profile feel crowded)
- **Website:** `https://smartjib.app/?utm_source=instagram&utm_medium=social&utm_campaign=launch_ma`
- **Profile image:** `brand/smartjib-instagram-avatar-1080.png`
- **Primary bio:** the local bilingual version in `PROFILE_COPY.md`
- **Contact button:** add Email only when `hello@smartjib.app` is monitored and replies have an owner.

## Upload order for the 3 × 3 launch grid

`previews/smartjib-3x3-launch-grid.png` is arranged in the desired visual order: `01 → 09`, left-to-right and top-to-bottom.

Instagram puts the **newest** post in the top-left of the grid, so publish in this reverse order to achieve the preview:

```text
09 → 08 → 07 → 06 → 05 → 04 → 03 → 02 → 01
```

Posts **03, 05, 08, and 09** are Arabic/Darija-first and rendered in Cairo; pair them with the matching Arabic/Darija caption option. The remaining launch posts lead in friendly French and use Moroccan MAD examples.

A sustainable launch cadence is one post each day for nine days. If the account is already warm and the grid matters more than gradual release, schedule three posts per day over three days instead. After publishing, pin:

1. `01-your-money-on-purpose.png` — What SmartJib is
2. `04-purpose-and-place.png` — The differentiator
3. `06-private-by-design.png` — The trust message

## Add Highlight covers

1. Post the corresponding starter Story from `stories/`, or add it to Close Friends and move it to the public Highlight when ready.
2. Create the Highlight with the short label in the table below.
3. Choose **Edit Highlight → Edit Cover** and upload the matching file from `highlights/`.
4. Keep Instagram’s crop centered. The icons were placed in the circle-safe center zone.

| Highlight label | Cover | First Story | Purpose |
| --- | --- | --- | --- |
| Start | `01-start-cover.png` | `01-welcome-to-smartjib.png` | Brand intro and “how to begin” |
| Budget | `02-budget-cover.png` | `02-three-buckets.png` | Budget basics and framework explainers |
| Places | `03-places-cover.png` | `03-money-places.png` | Bank, home, wallet, and custom places |
| Goals | `04-goals-cover.png` | `06-savings-goals.png` | Savings goals and progress moments |
| Private | `05-private-cover.png` | `04-private-by-design.png` | Manual tracking and no-bank-connection clarity |
| Tour | `06-tour-cover.png` | `07-app-tour.png` | Product walkthroughs and feature demos |
| Tips | `07-tips-cover.png` | `08-budget-tip.png` | Small, practical habits and post re-shares |
| FAQ | `08-faq-cover.png` | `05-ask-a-budget-question.png` | Replies to questions and common setup help |

## Publish safely

- Replace `smartjib.app` if the final production URL differs before posting.
- Use the captions in [`CAPTIONS.md`](CAPTIONS.md) only for features currently live in the app.
- Do not quote user balances, names, screenshots, or financial data without explicit consent and a second privacy check.
- Keep every caption educational and non-judgmental. SmartJib is a budgeting tool, not individualized financial, tax, legal, or investment advice.
- Add Instagram-native polls, questions, location tags, and link stickers in the app; they are intentionally not baked into static artwork.

## Recreate or update the PNGs

The checked-in PNGs are the delivery files. Their reproducible source is:

```bash
node scripts/generate-instagram-kit.mjs
```

The command needs ImageMagick’s `convert` and `montage` commands plus the repository’s installed Node dependencies. It refreshes only generated image folders under `marketing/instagram/` and keeps the copy documents, source imagery, and editable SVG templates intact.
