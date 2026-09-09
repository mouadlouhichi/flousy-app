# Social-kit font files

These checked-in font files make the generated social assets reproducible without relying on a host machine's font list. The selected system is intentionally split by purpose, so a viewer can read the hook at grid size and still scan supporting amounts comfortably on a phone.

| Use | File | Weight | Why it is used | License |
| --- | --- | ---: | --- | --- |
| French / Latin hook | `PlusJakartaSans-ExtraBold.ttf` | 800 | Confident, modern FinTech display face with friendly geometry | SIL Open Font License 1.1 — `PlusJakartaSans-OFL.txt` |
| French / Latin body | `Inter-Regular.ttf` | 400 | Highly legible at small sizes for figures, steps, and supporting copy | SIL Open Font License 1.1 — `Inter-OFL.txt` |
| French / Latin strong labels | `Inter-SemiBold.ttf` | 600 | Keeps labels and numbers crisp without competing with the hook | SIL Open Font License 1.1 — `Inter-OFL.txt` |
| Arabic / Darija hook | `Cairo-ExtraBold.ttf` | 850 | Strong, contemporary display face with clear Arabic forms | SIL Open Font License 1.1 — `Cairo-OFL.txt` |
| Arabic / Darija body | `IBMPlexSansArabic-Regular.ttf` | 400 | Calm, technical clarity for RTL support lines and labels | SIL Open Font License 1.1 — `IBMPlexSansArabic-OFL.txt` |
| Arabic / Darija strong labels | `IBMPlexSansArabic-SemiBold.ttf` | 600 | Maintains hierarchy in compact RTL cards | SIL Open Font License 1.1 — `IBMPlexSansArabic-OFL.txt` |

`PlusJakartaSans-Variable.ttf` and `Inter-Variable.ttf` are included as editable source families. The generator uses the static instances above because ImageMagick does not reliably honour the weight axis in direct variable-font paths.

## Rules

- Use **Plus Jakarta Sans ExtraBold** only for short French/Latin display hooks. Use **Inter** for all supporting French/Latin text, data, labels, and captions embedded in art.
- Use **Cairo ExtraBold** only for short Arabic/Darija hooks. Use **IBM Plex Sans Arabic** for all supporting Arabic/Darija text.
- Arabic runs are shaped and bidi-reordered by `scripts/generate-instagram-kit.mjs`. Do not add a kashida/tatweel or a faux leading dash to force a connection; letters such as `ا د ذ ر ز و` remain naturally unjoined.
- Keep Arabic copy right aligned, use Western numerals consistently (`10 000 MAD`, `68%`), and leave visibly more line-height than a Latin hook.
