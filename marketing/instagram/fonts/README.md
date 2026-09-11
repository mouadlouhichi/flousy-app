# Social-kit font files

These checked-in files keep generated social assets reproducible without depending on the host machine’s font list. The product UI and email system continue to follow the published Plus Jakarta Sans baseline; Instagram and paid-social artwork intentionally use Inter for cleaner small-screen Latin rendering. Every Arabic/Darija element uses Cairo.

| Use | File | Weight | Why it is used | License |
| --- | --- | ---: | --- | --- |
| French / Latin display | `Inter-SemiBold.ttf` | 600 | Crisp social headlines without the previous heavy, compressed feel | SIL Open Font License 1.1 — `Inter-OFL.txt` |
| French / Latin body and labels | `Inter-Regular.ttf` | 400 | Clear mobile labels, data and support copy | SIL Open Font License 1.1 — `Inter-OFL.txt` |
| Arabic / Darija display and strong labels | `Cairo-ExtraBold.ttf` | 850 | Strong contemporary hooks with clear Arabic forms | SIL Open Font License 1.1 — `Cairo-OFL.txt` |
| Arabic / Darija body | `Cairo-Variable.woff2` | 400–600 | Keeps every supporting RTL line in the Cairo family | SIL Open Font License 1.1 — `Cairo-OFL.txt` |

Plus Jakarta Sans files remain checked in for product-aligned editable work and email artwork. New Instagram/paid-social exports use the assignments above.

## Rules

- Use **Inter Semibold** for short Latin social hooks and **Inter Regular** for supporting Latin text, data, and labels.
- Use **Cairo ExtraBold** for short Arabic/Darija hooks and strong labels. Use **Cairo Variable** for every supporting Arabic/Darija line. Do not mix Arabic font families.
- Arabic runs are shaped and bidi-reordered by `scripts/generate-instagram-kit.mjs`. Do not add a kashida/tatweel or a faux leading dash to force a connection; letters such as `ا د ذ ر ز و` remain naturally unjoined.
- Keep Arabic copy right aligned, use Western numerals consistently (`10 000 MAD`, `68%`), and leave visibly more line-height than a Latin hook.
- Use `1.02–1.08` leading for multi-line Latin display and `1.32–1.40` for multi-line Cairo display.
