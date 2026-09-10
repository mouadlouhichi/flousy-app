---
name: Forest & Lime
colors:
  # Brand
  forest: '#0f3b36'
  forest-soft: '#1a4f48'
  forest-deep: '#0a2c28'
  lime: '#c5e6a6'
  lime-bright: '#d6f0bd'
  lime-deep: '#a9d383'
  mint: '#e3f0e6'
  sage: '#c9dccb'
  # Light surfaces
  background: '#f3f7f3'
  surface: '#f3f7f3'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fbfdfb'
  surface-container: '#ffffff'
  surface-container-high: '#edf3ee'
  surface-container-highest: '#e4ede5'
  surface-variant: '#e4ede5'
  on-surface: '#0e1a17'
  on-surface-variant: '#5b6b63'
  outline: '#8a9a91'
  outline-variant: '#dbe5dc'
  # Roles
  primary: '#0f3b36'
  primary-hover: '#1a4f48'
  on-primary: '#ffffff'
  secondary: '#4f7f5b'
  secondary-container: '#e3f0e6'
  tertiary: '#8b5a2b'
  success: '#2f7d4f'
  warning: '#b3781a'
  error: '#c2382f'
  chart-1: '#0f3b36'
  chart-2: '#7fb069'
  chart-3: '#c5e6a6'
  chart-4: '#4f7f5b'
  chart-5: '#a9d383'
dark:
  background: '#081513'
  surface-container-lowest: '#050f0d'
  surface-container-low: '#0d1f1c'
  surface-container: '#112825'
  surface-container-high: '#17332e'
  surface-container-highest: '#1d3d38'
  on-surface: '#e8f1ea'
  on-surface-variant: '#a6bbb1'
  outline-variant: '#22403a'
  primary: '#c5e6a6'
  primary-hover: '#d6f0bd'
  on-primary: '#0a2c28'
  primary-container: '#1a4f48'
  mint: '#17332e'
  sage: '#2a4a44'
typography:
  family: Plus Jakarta Sans (variable, self-hosted in src/app/fonts)
  display: 600 weight, letter-spacing -0.03em to -0.04em
  figure: Jakarta + tabular/lining numerals (`.text-figure`, `.tabular`), never monospace
  code: JetBrains Mono via `.font-code` only (receipts, PINs, barcodes)
  label: 11px, 600 weight, uppercase, letter-spacing 0.08em
rounded:
  control: 9999px (pills)
  input: 1rem
  panel: 1.25rem
  card: 1.75rem
  hero: 2rem
shadows:
  ambient: 0 4px 24px -6px rgba(15,59,54,.10), 0 1px 2px rgba(15,59,54,.04)
  floating: 0 18px 48px -12px rgba(15,59,54,.28), 0 2px 6px rgba(15,59,54,.08)
  forest: 0 20px 40px -14px rgba(15,59,54,.45)
  primary-button: 0 8px 20px -8px rgba(15,59,54,.45)
---

## Brand & Style

SmartJib's visual language is **Forest & Lime**: a deep evergreen ink, a fresh lime accent and a
mint-washed canvas. It borrows the calm, premium feel of contemporary fintech wallets — big
tabular figures, pill-shaped controls, white cards floating on a soft tinted backdrop — without
becoming loud. Money is the protagonist; colour is used to *group and point*, not to decorate.

The product name stays **SmartJib**. The wordmark is set lowercase in Jakarta with a lime full
stop: `smartjib` + `<span class="text-lime-deep dark:text-lime">.</span>`.

## Colors

- **Forest (`#0f3b36`)** is the primary ink: filled buttons, the balance hero panel, the bottom
  nav, the "Income" KPI tile, active states. Hover darkens *softly* to `forest-soft`.
- **Lime (`#c5e6a6`)** is the single accent: "+27%" chips, the money-place strip, the active
  puck in dark mode, currency glyphs on forest surfaces, the "Fixed bills" KPI tile. Never use
  lime for large body text on white — use `forest-deep` on lime instead.
- **Mint / Sage** are ambient: the page backdrop glow (`body` / `.backdrop-mint`), hairline
  rings behind the budget donut (`.rings-sage`), dotted textures (`.dot-matrix`).
- **Secondary green (`#4f7f5b`)** is the mid-tone used for the "Wants" slice and neutral
  progress bars; the Needs / Wants / Savings triplet is always **forest / secondary / lime-deep**.
- Semantic colours are muted: `success #2f7d4f`, `warning #b3781a`, `error #c2382f`. Do not
  reach for raw Tailwind `amber-*` / `slate-*` / `emerald-*` classes — use the tokens.
  (Exception: the grocery nutrition traffic-light bands in `courses-*` keep their own scale.)

### Dark mode

Dark mode is derived from the same hues, not inverted: an almost-black green canvas
(`#081513`), forest-tinted containers, and **lime becomes the primary** (`on-primary` =
`forest-deep`). Forest surfaces (hero panel, bottom nav, CTA) stay forest in both themes, so
anything placed on them uses white / lime regardless of theme.

## Typography

One family — **Plus Jakarta Sans** — for everything. Headlines are semibold with tight
tracking; large figures use `MoneyFigure` (currency as a small raised glyph beside big tabular
digits). `font-mono` intentionally resolves to Jakarta + `tnum` so legacy amount markup lines
up; true monospace is opt-in with `.font-code`.

## Layout & Spacing

Mobile-first, 4px base. Cards sit edge to edge with 16px page margins and 16–24px gaps; desktop
uses a 12-column grid with the balance hero spanning 7 columns and the budget ring 5. The
dashboard root and every public page inherit the mint backdrop from `body`.

## Elevation & Depth

Three shadow levels, all tinted forest rather than black:

- **Ambient** — every card (`bg-surface-container-lowest border border-outline-variant shadow-ambient`).
- **Floating** — modals, popovers, the scrolled landing nav, the FAB action sheet.
- **Forest** — forest-filled surfaces that must lift off the page (bottom nav, FAB, CTA panel).

Modal backdrops are `forest-deep/40` with a 6px blur.

## Shapes

Everything interactive is a **pill**. Cards are `rounded-[1.75rem]`, hero frames `rounded-[2rem]`,
inputs and inner panels `1rem`–`1.25rem`. Icon buttons are circles (`size-9/10`, white with a
hairline border, or forest when active).

## Components

- **BalanceHeroCard** (`dashboard/balance-hero-card.tsx`) — white frame → lime strip of
  money-place tabs → notched forest panel with the total figure → primary/secondary pill actions.
- **BudgetRing** (`dashboard/budget-ring.tsx`) — circular Needs / Wants / Savings ring with sage
  hairlines, a sparkline and the "left to spend" figure.
- **StatCard** (`dashboard/stat-card.tsx`) — KPI tile in `default`, `forest` or `lime` tone with
  a diagonal arrow affordance and an optional lime delta chip.
- **MoneyFigure** (`ui/money-figure.tsx`) — sizes `xs`–`hero`, `redacted`, `tone`
  (`default | accent | inherit`), optional `prefix` sign.
- **Button** — `default` forest pill with the primary shadow; `outline` white pill with hairline;
  `lime` accent; circular icon size.
- **Badge** — `lime` variant for positive deltas and "Pro".
- **Bottom nav** — forest pill with a sliding white puck (lime in dark mode).
- **Eyebrow pill** — lime dot + short label, used on the landing sections and static page shells.

## Accessibility notes

- Interactive cards keep their visible label first in the accessible name; screen-reader action
  notes (e.g. "View Bank history", "View all") are appended with `sr-only` *after* the visible
  content, never via `aria-label` (WCAG 2.5.3).
- Lime on white fails contrast for text — pair lime with `forest-deep`, and use `lime-deep` only
  for the wordmark dot and small decorative marks.
