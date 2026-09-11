# SmartJib social brand guide — Forest & Lime

## The feeling

SmartJib should feel like a helpful friend who makes money planning less intimidating: **warm, clear, practical, and never judgmental**.

The product is a private, manual budget tracker. It separates what money is for from where it is held, does not connect to bank accounts, and never requests bank credentials. Social content must keep those claims factual.

## Audience and language

The primary audience is people in **Morocco** planning everyday money in **MAD**. Use familiar local context—dirhams, monthly expenses, cash, bank, and wallet—without assuming one household type, income, city, or financial situation.

| Use | Default language | Notes |
| --- | --- | --- |
| Community hooks, quick tips, question stickers | Darija / Arabic | Friendly and direct; use Cairo for every Arabic word in visual artwork. |
| Product explainers, carousels, help | French | Clear, warm, conversational French. |
| Wider product discovery | English | Use sparingly when it adds clarity. |

Do not put three full language versions in one graphic. Let individual posts lead in one language, use a short supporting translation only when it improves comprehension, and rotate languages across the feed.

### Darija copy standard

Arabic social copy in this kit is **Moroccan Darija**. Keep the same everyday terms in visual art, captions, Stories, and replies:

| Meaning | Use in SmartJib social copy | Avoid when writing Darija-first copy |
| --- | --- | --- |
| each dirham has a role | `كل درهم عندو دور` | literal or overly formal “mission” wording |
| essentials / wants / savings | `ضروريات` · `رغبات` · `توفير` | switching between MSA category labels and Darija within one post |
| where money is | `فين كاينة فلوسك؟` | a literal French sentence structure |
| a low-pressure start | `ما خاصكش تكون كامل، غير بدا` | shaming or absolute instructions |
| manual tracking | `كتزيد غير اللي بغيتي تتابع، وصافي` | dialect from another region such as `وبس` |

Use a fluent Morocco-based Darija reviewer for paid campaigns, legal language, or major new claims before publishing. Keep naturally non-joining Arabic letters (`ا د ذ ر ز و`) separate; never add a kashida/tatweel or faux dash to make a word look artificially connected.

## Voice

| Do | Avoid |
| --- | --- |
| “Ton budget, ton rythme.” | Scolding, shame, or “you must” language. |
| “Commence avec ton vrai montant.” | Claiming one rule works for everyone. |
| “بشوية وبلا ضغط.” | Overly formal or literal translations of English marketing copy. |
| “Chaque dirham peut avoir un rôle.” | Promises of wealth, guaranteed savings, or investment outcomes. |
| Explain the next small step. | Dense finance jargon and fear-based urgency. |

## Color system

Social artwork uses the same **Forest & Lime** tokens as the product. [`../../DESIGN.md`](../../DESIGN.md) is authoritative; there is no separate “social-only” palette.

| Name | Hex | Role |
| --- | --- | --- |
| Forest | `#0F3B36` | Primary ink, dark surface, key icon and CTA |
| Forest deep | `#0A2C28` | Highest-contrast dark panel and pressed state |
| Forest soft | `#1A4F48` | Raised treatment on forest |
| Lime | `#C5E6A6` | Sole high-attention accent and highlighted surface |
| Lime bright | `#D6F0BD` | Light tonal strip or hover-style treatment |
| Lime deep | `#A9D383` | Savings role, borders and chart strokes |
| Mint | `#E3F0E6` | Pale ambient tint |
| Sage | `#C9DCCB` | Rings, shadows and quiet texture |
| Background | `#F3F7F3` | Default canvas |
| Surface | `#FFFFFF` / `#FBFDFB` | Cards and low containers |
| Ink | `#0E1A17` | Main text |
| Muted | `#5B6B63` | Supporting text only |

Use lime once as the clear accent, not as decoration everywhere. Never set lime text on white. Put forest-deep text and icons on lime or lime-deep surfaces. Needs / wants / savings use forest `#0F3B36`, secondary green `#4F7F5B`, and lime-deep `#A9D383`, always with visible labels.

## Typography

The generator now uses the actual licensed font files in [`fonts/`](fonts/), not DejaVu fallback fonts.

| Role | Font | Weight | Rule |
| --- | --- | --- | --- |
| Latin / French display | **Plus Jakarta Sans ExtraBold** | **800** | Short, confident headlines; sentence case. |
| Latin / French body & labels | **Plus Jakarta Sans** | 400–700 | Match the product while keeping amounts and support copy readable on mobile. |
| Arabic / Darija display | **Cairo ExtraBold** | **850** | Use Cairo for short RTL hooks; right-align the headline. |
| Arabic / Darija body | **IBM Plex Sans Arabic** | 400–600 | Use for RTL support text and cards; leave a clear right edge. |

### Bold display and line-height

The campaign must remain readable as a 3 × 3 grid before someone opens a post. Use the selected ExtraBold display fonts for display text, then let generous rhythm—not a lighter weight—create refinement.

- **Latin display, multi-line:** **800** weight and `0.91–0.96` leading in the generator’s explicit placement system.
- **Arabic / Darija display:** **850** weight and `1.24–1.28` leading. Arabic glyphs need more vertical breathing room even when they are bold.
- **Body copy:** use 400–600 weight and approximately `1.35–1.5` line-height; do not stack body lines closer than 24 px at final 1080 px width.
- Keep a visible gap of at least one small-text line between a headline and its support line.
- Never place display text over a dark decorative shape unless the contrast remains clear.

### Whitespace is part of the message

Treat empty space as a deliberate reading path, not an area that needs more decorations.

- Keep a **72–82 px outer margin** on feed art and Stories; cards align to the same left/right edges.
- Leave **48–64 px** from the final headline line to supporting copy, then **56–80 px** from copy to the main card or image.
- Keep a single primary panel per feed post. Let the footer sit in its own calm lower band rather than squeezing another claim beneath the panel.
- On Stories and Reels, keep critical content in the central `y=220–1650` region; use the lower band for only a lightweight CTA or the site label.
- If a headline needs a fourth line, remove secondary copy or shorten the message—never shrink the type or collapse the spacing.

The selected font files and their SIL Open Font License files are included in [`fonts/`](fonts/). See [`fonts/README.md`](fonts/README.md) for the exact display/body assignments and editable source families.

## Icon language

Use **Lucide** as the only functional-icon family. The generated kit renders the official Lucide SVG geometry for wallet, target, location pin, shield, calendar, coins, language, and chat. See [`ICON_SOURCES.md`](ICON_SOURCES.md) for the exact source icon names. Keep icons as rounded outlines with a single, high-contrast stroke; use a forest, mint or lime tonal container rather than an unrelated accent color.

- Put an icon in a generous circle or card—not in a cramped corner.
- Keep icon strokes at a consistent visual weight.
- Use a familiar symbol before adding explanatory words.
- Do not mix outlined icons with random emoji, clip-art, or glossy 3D stock illustrations.
- Use the official SmartJib wallet mark for the avatar and primary brand moments only.

## Illustration and layout

1. Combine rounded cards and calm progress graphics with occasional tactile, original lifestyle photography. Photo is a supporting visual—not a background for essential text or a substitute for a real customer testimonial.
2. Use real-but-generic amounts such as `10 000 MAD`; never show user financial data.
3. Let one message dominate each post. A viewer should understand the topic before reading the caption.
4. Keep the top 110 px quiet enough for Instagram interface overlays in Stories/Reels.
5. Keep critical Story/Reel information within approximately `y=220–1650` on a 1080 × 1920 canvas.
6. Highlights must keep the icon in the central circle-safe area; titles outside that zone are only a production aid.
7. Use original abstract motifs, photography, and layouts—not copied layouts, wording, or artwork from other Instagram accounts.
8. When recreating Arabic/Darija assets, use the generator's built-in Arabic shaping and bidi pass; do not rasterize disconnected or reversed glyphs.

## Dimensions and export

| Asset | Canvas | Delivery format |
| --- | ---: | --- |
| Feed post / carousel slide | 1080 × 1350 | PNG |
| Story / Reel cover | 1080 × 1920 | PNG |
| Highlight cover | 1080 × 1920 | PNG, icon centered for circle crop |
| Profile avatar | 1080 × 1080 | PNG, wallet mark stays in the central crop-safe area |

Export at native dimensions, use sRGB, and do not upscale a smaller canvas.

## Accessibility and trust

- Keep key claim text at WCAG AA contrast; never use lime text on white, and use forest-deep content on lime surfaces.
- Write alt text for every feed post. The matching fields are in [`CAPTIONS.md`](CAPTIONS.md).
- Burn subtitles into every Reel and leave visual room for native Instagram captions.
- Never invite people to share account numbers, balances, passwords, bank credentials, or private screenshots.
- SmartJib is a planning tool, not personalized financial, legal, tax, or investment advice.
