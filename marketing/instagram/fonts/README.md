# Social-kit font files

These files make the generated social assets reproducible without depending on the host machine’s font list.

| File | Purpose | Source | License |
| --- | --- | --- | --- |
| `InstrumentSans-Variable.ttf` | Supporting French, English, and Latin typography | [Google Fonts: Instrument Sans](https://github.com/google/fonts/tree/main/ofl/instrumentsans) | SIL Open Font License 1.1 — see `InstrumentSans-OFL.txt` |
| `InstrumentSans-Bold.ttf` | Static **700 Bold** instance for display and strong labels | Derived from the checked-in Instrument Sans variable font | SIL Open Font License 1.1 — see `InstrumentSans-OFL.txt` |
| `Cairo-Variable.ttf` | Supporting Arabic and Darija typography | [Google Fonts: Cairo](https://github.com/google/fonts/tree/main/ofl/cairo) | SIL Open Font License 1.1 — see `Cairo-OFL.txt` |
| `Cairo-ExtraBold.ttf` | Static **850 ExtraBold** instance for Arabic/Darija display | Derived from the checked-in Cairo variable font | SIL Open Font License 1.1 — see `Cairo-OFL.txt` |

Use **Instrument Sans Bold** for Latin display copy and **Cairo ExtraBold** for Arabic/Darija display copy; use their variable counterparts for supporting text. The generator automatically selects the static instance for display and strong label weights, which keeps bold text consistent even on ImageMagick installations that ignore variable-font `-weight` values.
