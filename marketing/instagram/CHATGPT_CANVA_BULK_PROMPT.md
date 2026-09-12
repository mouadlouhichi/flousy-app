# ChatGPT + Canva — bulk Instagram post prompt

How to use:

1. Open ChatGPT, enable the **Canva** connector/GPT.
2. Upload `brand/smartjib-logo-mark-transparent.png` (and optionally `brand/smartjib-horizontal-wordmark.png`) to the chat so it can place the real mark.
3. Paste **Prompt 1** and wait for the plan table. Approve or edit it.
4. Paste **Prompt 2** to make it actually build the designs in Canva.
5. Use **Prompt 3** for captions, and **Prompt 4** for the follow-on batches.

Canva reality check: the plugin builds designs from a text brief and can fill a template, but it cannot pixel-place elements at exact coordinates. Treat the coordinates in this prompt as intent ("generous margins, one dominant message"), and expect to nudge a few frames by hand in Canva afterwards.

---

## Prompt 1 — set the brand system and get a plan first

```
You are my brand designer for SmartJib and you have the Canva connector.

Before you create anything in Canva, read this brand system and then give me a plan table for my approval. Do not open Canva yet.

PRODUCT
SmartJib is a private, manual budget tracker for people in Morocco planning everyday money in MAD. It separates what money is FOR (needs / wants / savings) from WHERE it is held (bank / cash / wallet). It does NOT connect to bank accounts and never asks for bank credentials. Every claim must stay factual and inside those limits. It is a planning tool, not financial, tax, legal, or investment advice. Never promise wealth, guaranteed savings, or investment returns.

AUDIENCE AND LANGUAGE
Primary audience: people in Morocco budgeting in MAD.
- Moroccan Darija / Arabic: community hooks, quick tips, questions.
- French: product explainers and education.
- English: only when it genuinely adds clarity.
ONE primary language per post. Never put three language versions in one graphic. Rotate languages across the feed so it feels local.
Darija terms to reuse exactly: كل درهم عندو دور (each dirham has a role), ضروريات / رغبات / توفير (needs / wants / savings), فين كاينة فلوسك؟ (where is your money), ما خاصكش تكون كامل، غير بدا (you don't need to be perfect, just start).
For Arabic, right-align the headline and keep the letters properly connected — no tatweel/kashida, no reversed or disconnected glyphs.

VOICE
Warm, clear, practical, never judgmental — a helpful friend who makes money planning less intimidating.
Do: "Ton budget, ton rythme." / "Commence avec ton vrai montant." / "بشوية وبلا ضغط." / explain the next small step.
Avoid: shame, "you must", fear-based urgency, dense finance jargon, claiming one rule fits everyone.

COLOR — Forest & Lime, use these hex values only
Forest #0F3B36 (primary ink, dark surface, key CTA)
Forest deep #0A2C28 (highest-contrast dark panel)
Forest soft #1A4F48 (raised treatment on forest)
Lime #C5E6A6 (the ONE high-attention accent)
Lime bright #D6F0BD (light tonal strip)
Lime deep #A9D383 (savings role, borders, chart strokes)
Mint #E3F0E6 (pale ambient tint)
Sage #C9DCCB (rings, shadows, quiet texture)
Background #F3F7F3 (default canvas)
Surface #FFFFFF / #FBFDFB (cards)
Ink #0E1A17 (main text), Muted #5B6B63 (supporting text only)
Rules: use lime ONCE per design as the accent, not as decoration everywhere. NEVER set lime text on white. Put forest-deep text and icons on lime surfaces. Needs / wants / savings are always forest #0F3B36, secondary green #4F7F5B, and lime deep #A9D383, each with a visible label.

TYPOGRAPHY
Latin/French display: Inter Semibold 600, sentence case, line-height 1.02-1.08.
Latin body and labels: Inter Regular/Semibold 400-600, line-height 1.4-1.6.
Arabic/Darija display: Cairo ExtraBold (heaviest Cairo available), line-height 1.32-1.40.
Arabic body: Cairo 400-600.
Max three headline lines. If a fourth line is needed, shorten the message — never shrink the type or crush the leading.

LAYOUT (canvas 1080 x 1350 px)
- 72-82 px outer margin on all sides; every card aligns to the same left and right edges.
- ~32-48 px from the last headline line to the support line; 72-140 px from copy to the main card or image.
- ONE dominant message and ONE primary panel per post. A viewer should get the topic before reading the caption.
- Avoid empty central gaps larger than ~240 px — rebalance the headline, panel, or CTA instead of adding another claim.
- Use rounded cards and calm progress graphics. Use realistic generic amounts like 10 000 MAD. Never show real user data.
- Icons: Lucide outline style only (wallet, target, map pin, shield, calendar, coins, languages, message-circle), rounded single-weight strokes, each inside a generous circle or card. No emoji, no clip-art, no glossy 3D stock.
- The SmartJib wallet mark (attached) is for the avatar and primary brand moments only — do not stamp it on every slide.
- Export 1080 x 1350 PNG, sRGB, never upscaled.

ACCESSIBILITY
WCAG AA contrast on all claim text. Every post needs alt text. Never invite anyone to share account numbers, balances, passwords, or screenshots.

CONTENT PILLARS — rotate across the batch
1. Calm planning (budget without pressure)
2. Purpose vs place (what money is for vs where it sits)
3. Money places (bank / cash / wallet)
4. Savings goals
5. Private by design (no bank connection)
6. MAD and your language (Darija/French/English)
7. Small practical tips

TASK NOW
Plan 12 feed posts. Output ONE markdown table, no design work yet, with columns:
No | Pillar | Language | Headline (in that language, max 3 lines, use \n) | Support line | Visual concept in one sentence | Accent usage | CTA | Alt text
Rules for the batch: at least 5 Darija/Arabic and at least 5 French; no two consecutive rows share a pillar; the 12 must read as a coherent 3x3-plus grid, varying dark-forest posts with light-background posts so the profile grid has rhythm.
Then stop and ask me to approve or edit before you touch Canva.
```

---

## Prompt 2 — build the approved batch in Canva

```
Approved. Now build these in Canva.

1. Create ONE Canva design, 1080 x 1350 px, named "SmartJib — IG Feed Batch 1", with 12 pages — one per approved row, in table order.
2. Apply the Forest & Lime palette, typography, margin, and layout rules from my brief exactly. Set the brand colors as the design's color set so the hex values stay exact.
3. Page 1 is the template of record: build it carefully, then reuse its grid (margins, headline block position, card position, CTA position) on all other pages so the batch is visually consistent.
4. Alternate backgrounds so the grid has rhythm: light #F3F7F3 canvas for most, and forest #0F3B36 full-bleed for roughly every third post with light text on it.
5. For the Arabic pages set the text direction to RTL, right-align, and use Cairo. Verify the Arabic letters render connected and in the right order before moving on.
6. Use the attached wallet mark only on the 2 posts I marked as brand moments, sized small and in a quiet corner with clear space around it.
7. Do not invent new claims, statistics, testimonials, or features. Use only the approved copy.

When done, give me the Canva edit link, then list per page: page number, exactly what text you placed, and anything you had to compromise versus my spec so I can fix it manually.
```

---

## Prompt 3 — captions, alt text, hashtags

```
Now write the publishing pack for those 12 posts, matching each page number.

For each post give me:
- Caption in the SAME primary language as the graphic. 1 short hook line, 2-4 short lines of value, then the CTA. Warm, practical, never shaming. No emoji spam — 0-2 max.
- Alt text, one factual sentence describing what is actually visible.
- 8-12 hashtags mixing Morocco/MAD budgeting terms with the language of the post. No banned, spammy, or unrelated finance-guru tags.
- A one-line Story teaser to drive people to the post.

Hard rules: no promises of wealth or guaranteed savings; no claim that SmartJib connects to a bank; no request for anyone's financial details; SmartJib is a planning tool, not financial advice.
Output as a markdown table I can paste into a scheduler.
```

---

## Prompt 4 — keep the batches coming

```
Same brand system, same Canva design dimensions and layout rules. Build Batch 2: 12 more feed posts.

Constraints: do not repeat any headline, visual concept, or hook from Batch 1. Shift the language mix toward French this time. Lead with the pillars that performed best — I'll tell you which, otherwise weight toward "purpose vs place" and "money places".

Start again with the plan table for approval, then build into a new Canva design named "SmartJib — IG Feed Batch 2".
```

---

## Quick QA before you publish

- Lime used once per design, and never as text on white.
- Arabic connected, right-aligned, in Cairo — not reversed.
- One dominant message per post; topic readable as a thumbnail.
- Amounts are generic (e.g. 10 000 MAD), never real user data.
- No "connects to your bank" implication anywhere.
- Exported 1080 x 1350 PNG, sRGB, not upscaled.
