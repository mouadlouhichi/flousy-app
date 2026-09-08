# CosIng — local ingredient dataset

`cosing-ingredients.tsv` is the offline snapshot behind the INCI analysis
feature (`src/lib/ingredient-safety/*`, API route
`/api/inci/analyze`). It is read **only** by server code — never shipped to the
client bundle — so the app's privacy stance is unchanged (only barcode/INCI
text leaves the device, and only to the app's own route).

## File

| Column | Content |
| --- | --- |
| `inci` | Canonical INCI name (trimmed, source casing) |
| `cas` | CAS Registry Number(s) when recorded |
| `ec` | EC/EINECS number(s) when recorded |
| `functions` | CosIng cosmetic-function labels, comma-separated ("HUMECTANT, SKIN CONDITIONING") |
| `restriction` | Raw CosIng restriction text — annex codes (`II/1339`, `III/98`, `V/29`…) and conditions |

TSV, one row per ingredient, tab-separated, UTF-8, header row first.

## Provenance & freshness — READ THIS

This is a **merged snapshot** of the European Commission's *CosIng —
Ingredients & Fragrance Inventory* export:

1. **Primary (functions/restrictions)** — the official EC export
   `COSING_Ingredients-Fragrance Inventory_v2.csv`, mirrored in
   `walkowskis/CosIng_database_finder` (`testowa.db`, `cosing` table). The
   mirror's embedded dataset date is **13/03/2019**.
2. **Identifier layer (CAS/EC gaps)** — `beauteeru/cosmetic-ingredients-dataset`
   (`ingredients.csv`, MIT licensed, 2024-era) fills CAS/EC on rows the 2019
   export lacked them, and adds ~2,700 names absent from the 2019 snapshot.

Built with a one-off script (sources above → normalized merge, 28,733 rows,
~1.9 MB) on **2026-09-07**. Bans/restrictions adopted **after 2019-03-13 are
NOT in the raw rows** — they live in the versioned EU overlay in
`src/lib/ingredient-safety/eu-lists.ts` (Lilial, HICC, retinol caps, the
Reg (EU) 2023/1545 fragrance-allergen list, …), which is refreshed by hand and
dated in code.

## Refresh

### From the official source (needs internet access to the EC portal)

```bash
node scripts/fetch-cosing.mjs
```

The script tries the official export URLs (EC legacy + current portal +
data.europa.eu) and rewrites `cosing-ingredients.tsv` with today's data.
If the network blocks the EC endpoints (as in sandboxed CI), it exits with a
message and the current file is left untouched.

### Manual (mirror-based)

1. Download the official export (see `scripts/fetch-cosing.mjs` for the URLs;
   the portal page is *Cosmetic ingredient database (CosIng)* under
   single-market-economy.ec.europa.eu).
2. Normalize: drop the ~9 preamble lines, keep columns
   `Ref | INCI name | CAS | EC | Restriction | Function`, trim cells, collapse
   newlines inside cells, sort by INCI, dedupe on a case/punctuation-folded key
   (keep the row that has restriction text, else the one with functions).
3. Write `data/cosing/cosing-ingredients.tsv` with the same header as above.

Then bump the `snapshot` string in
`src/lib/ingredient-safety/dataset.ts` and run
`npm test` / `npm run check`.

## Attribution & licensing

- EU official data © European Union, reproduced with permission under
  Commission Decision 2011/833/EU on the reuse of Commission documents.
  The CosIng data is informative and has **no legal value** (per the EC);
  presence in the database does **not** constitute an authorization for use.
- Mirror repos used to assemble this snapshot:
  - `walkowskis/CosIng_database_finder` (sqlite export of the official CSV)
  - `beauteeru/cosmetic-ingredients-dataset` (MIT)
- This repository does not own the data. When refreshing, prefer the official
  source above; if you must redistribute the file elsewhere, keep this note.

## Known limits

- Snapshot vintage 2019-03-13 (overlay compensates for high-profile changes,
  but an ingredient added to CosIng after 2019 can only be matched if the
  identifier layer caught it — otherwise it shows as "not found").
- Names are matched with normalization + aliases + parenthetical stripping;
  exotic spellings may stay unrecognized (they lower `coverage`, they never
  produce a false flag).
- This is informational, not a medical or legal opinion — see
  `docs/COSMETIC_INGREDIENT_SCORING.md`.
