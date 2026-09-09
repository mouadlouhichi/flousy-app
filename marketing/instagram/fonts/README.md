# Social-kit font files

These files make the generated social assets reproducible without depending on the host machine’s font list.

| File | Purpose | Source | License |
| --- | --- | --- | --- |
| `InstrumentSans-Variable.ttf` | French, English, and Latin typography | [Google Fonts: Instrument Sans](https://github.com/google/fonts/tree/main/ofl/instrumentsans) | SIL Open Font License 1.1 — see `InstrumentSans-OFL.txt` |
| `Cairo-Variable.ttf` | Arabic and Darija typography | [Google Fonts: Cairo](https://github.com/google/fonts/tree/main/ofl/cairo) | SIL Open Font License 1.1 — see `Cairo-OFL.txt` |

Use Instrument Sans for all Latin text and Cairo for all Arabic text. The Cairo file is deliberately used by `scripts/generate-instagram-kit.mjs` for Arabic/Darija launch posts, Stories, and Reel artwork.
