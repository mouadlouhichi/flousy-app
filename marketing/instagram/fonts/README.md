# Social-kit font files

These checked-in files keep generated social assets reproducible without depending on the host machine’s font list. **Forest & Lime** follows the product’s Plus Jakarta Sans Latin family. Arabic exports retain dedicated Cairo and IBM Plex Sans Arabic files because ImageMagick needs explicit shaping-compatible fonts.

| Use | File | Weight | Why it is used | License |
| --- | --- | ---: | --- | --- |
| French / Latin display | `PlusJakartaSans-ExtraBold.ttf` | 800 | Confident display face that matches the product | SIL Open Font License 1.1 — `PlusJakartaSans-OFL.txt` |
| French / Latin body and labels | `PlusJakartaSans-Variable.ttf` | 400–700 | One family across body, data and labels | SIL Open Font License 1.1 — `PlusJakartaSans-OFL.txt` |
| Arabic / Darija display | `Cairo-ExtraBold.ttf` | 850 | Strong, contemporary display face with clear Arabic forms | SIL Open Font License 1.1 — `Cairo-OFL.txt` |
| Arabic / Darija body | `IBMPlexSansArabic-Regular.ttf` | 400 | Calm clarity for RTL support lines and labels | SIL Open Font License 1.1 — `IBMPlexSansArabic-OFL.txt` |
| Arabic / Darija strong labels | `IBMPlexSansArabic-SemiBold.ttf` | 600 | Maintains hierarchy in compact RTL cards | SIL Open Font License 1.1 — `IBMPlexSansArabic-OFL.txt` |

The Inter files remain checked in only so older editable source files can open without font substitution; new artwork must use Plus Jakarta Sans for Latin text.

## Rules

- Use **Plus Jakarta Sans ExtraBold** for short Latin display hooks and **Plus Jakarta Sans Variable** for supporting Latin text, data and labels.
- Use **Cairo ExtraBold** only for short Arabic/Darija hooks. Use **IBM Plex Sans Arabic** for all supporting Arabic/Darija text.
- Arabic runs are shaped and bidi-reordered by `scripts/generate-instagram-kit.mjs`. Do not add a kashida/tatweel or a faux leading dash to force a connection; letters such as `ا د ذ ر ز و` remain naturally unjoined.
- Keep Arabic copy right aligned, use Western numerals consistently (`10 000 MAD`, `68%`), and leave visibly more line-height than a Latin hook.
