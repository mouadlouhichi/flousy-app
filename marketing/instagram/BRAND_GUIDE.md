# SmartJib social brand guide — Morocco-first refresh

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

## Voice

| Do | Avoid |
| --- | --- |
| “Ton budget, ton rythme.” | Scolding, shame, or “you must” language. |
| “Commence avec ton vrai montant.” | Claiming one rule works for everyone. |
| “بشوية وبلا ضغط.” | Overly formal or literal translations of English marketing copy. |
| “Chaque dirham peut avoir un rôle.” | Promises of wealth, guaranteed savings, or investment outcomes. |
| Explain the next small step. | Dense finance jargon and fear-based urgency. |

## Color system

The refreshed palette is friendly and recognizably SmartJib: deep teal carries trust; cream, mint, coral, and saffron add warmth and local everyday energy.

| Name | Hex | Role |
| --- | --- | --- |
| Teal | `#006B62` | Primary brand surface, buttons, key icons |
| Deep teal | `#004F49` | High-contrast dark panels |
| Bright teal | `#058F82` | Secondary emphasis |
| Mint | `#9CE9DB` | Gentle support, progress, icon accent |
| Cream | `#FFF9F1` | Friendly default background |
| Paper | `#F7FAF8` | Cool neutral background |
| Coral | `#E98362` | Joy, warmth, needs / wants emphasis |
| Saffron | `#E9B35C` | Savings, optimism, small sparkles |
| Ink | `#172622` | Main text |
| Muted | `#5E716B` | Supporting text only |

Use one warm accent per layout. Do not flood a post with all accent colors at once.

## Typography

The generator now uses the actual licensed font files in [`fonts/`](fonts/), not DejaVu fallback fonts.

| Role | Font | Weight | Rule |
| --- | --- | --- | --- |
| Latin / French display | **Instrument Sans** | 750–800 | Short, confident headlines; sentence case. |
| Latin / French body & labels | **Instrument Sans** | 520–740 | Clear and friendly; avoid technical all-caps blocks longer than 3 words. |
| Arabic / Darija display | **Cairo** | 750–790 | Always use Cairo in visual assets; right-align the headline. |
| Arabic / Darija body | **Cairo** | 550–650 | Leave generous vertical rhythm and a clear right edge. |

### Correct line-height

The previous designs were too loose for Latin display and too tight for Arabic display. Preserve this corrected rhythm:

- **Latin display, multi-line:** `0.91–0.96` of the font size in the generator’s explicit placement system.
- **Arabic display, multi-line:** `1.24–1.28` of the font size. Arabic glyphs need more vertical breathing room.
- **Body copy:** use approximately `1.35–1.5` line-height; do not stack text closer than 24 px at final 1080 px width.
- Keep a visible gap of at least one small-text line between a headline and its support line.
- Never place display text over a dark decorative shape unless the contrast remains clear.

The source font files are included with their SIL Open Font License files:

- `fonts/InstrumentSans-Variable.ttf` + `fonts/InstrumentSans-OFL.txt`
- `fonts/Cairo-Variable.ttf` + `fonts/Cairo-OFL.txt`

## Icon language

Use the custom rounded line icons in the generated kit: wallet, target, location pin, shield, calendar, coins, language, and chat. They use a consistent soft stroke, circular color field, and a mint accent.

- Put an icon in a generous circle or card—not in a cramped corner.
- Keep icon strokes at a consistent visual weight.
- Use a familiar symbol before adding explanatory words.
- Do not mix outlined icons with random emoji, clip-art, or glossy 3D stock illustrations.
- Use the official SmartJib wallet mark for the avatar and primary brand moments only.

## Illustration and layout

1. Prefer rounded cards, small sparkles, circles, and calm progress graphics.
2. Use real-but-generic amounts such as `10 000 MAD`; never show user financial data.
3. Let one message dominate each post. A viewer should understand the topic before reading the caption.
4. Keep the top 110 px quiet enough for Instagram interface overlays in Stories/Reels.
5. Keep critical Story/Reel information within approximately `y=220–1650` on a 1080 × 1920 canvas.
6. Highlights must keep the icon in the central circle-safe area; titles outside that zone are only a production aid.
7. Use original abstract motifs, not copied layouts, wording, or artwork from other Instagram accounts.

## Dimensions and export

| Asset | Canvas | Delivery format |
| --- | ---: | --- |
| Feed post / carousel slide | 1080 × 1350 | PNG |
| Story / Reel cover | 1080 × 1920 | PNG |
| Highlight cover | 1080 × 1920 | PNG, icon centered for circle crop |
| Profile avatar | 1080 × 1080 | PNG, wallet mark stays in the central crop-safe area |

Export at native dimensions, use sRGB, and do not upscale a smaller canvas.

## Accessibility and trust

- Keep key claim text at readable contrast; avoid mint or saffron text on cream for essential information.
- Write alt text for every feed post. The matching fields are in [`CAPTIONS.md`](CAPTIONS.md).
- Burn subtitles into every Reel and leave visual room for native Instagram captions.
- Never invite people to share account numbers, balances, passwords, bank credentials, or private screenshots.
- SmartJib is a planning tool, not personalized financial, legal, tax, or investment advice.
