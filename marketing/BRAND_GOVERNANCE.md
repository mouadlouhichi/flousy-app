# SmartJib brand, message and claims governance

This is the cross-channel source of truth. The visual detail lives in [`instagram/BRAND_GUIDE.md`](instagram/BRAND_GUIDE.md).

## Brand idea

SmartJib turns money planning into a calm next step, not a judgment. It should feel **warm, clear, practical and private**.

### Message hierarchy

1. **Emotional promise:** more clarity, less pressure.
2. **Functional promise:** plan needs, wants and savings in one monthly view.
3. **Distinctive model:** separate what money is for from where it is held.
4. **Trust reason:** manual tracking without connecting a bank account.
5. **Local relevance:** MAD-first examples, Morocco-first language and everyday cash/bank/wallet context.

### Signature copy

| Purpose | French | Darija / Arabic |
| --- | --- | --- |
| Master line | `Ton budget. Ton rythme.` | `فلوسك بوضوح، بلا ضغط.` |
| Planning | `Donne un rôle à chaque dirham.` | `كل درهم عندو دور.` |
| Reassurance | `Pas besoin d’un budget parfait.` | `ما خاصكش تكون كامل، غير بدا.` |
| Product distinction | `Pour quoi ? Et où ? Deux questions. Un budget plus clair.` | `علاش؟ وفين؟ جوج أسئلة، رؤية أوضح.` |
| CTA | `Commencer mon budget` | `نبدا ميزانيتي` |

A Morocco-based reviewer must approve the Darija/Arabic lines before paid distribution.

## Visual system — Forest & Lime

[`../DESIGN.md`](../DESIGN.md) is authoritative. Marketing artwork extends those product tokens; it does not invent a separate social palette.

- Brand anchors: forest `#0F3B36`, forest-deep `#0A2C28`, forest-soft `#1A4F48`.
- Sole brand accent: lime `#C5E6A6`, with lime-bright `#D6F0BD` and lime-deep `#A9D383` for tonal variation.
- Ambient surfaces: background `#F3F7F3`, white `#FFFFFF`, mint `#E3F0E6`, sage `#C9DCCB`.
- Text: ink `#0E1A17`; muted `#5B6B63`; outline-variant `#DBE5DC`.
- Category roles: needs = forest `#0F3B36`; wants = secondary green `#4F7F5B`; savings = lime-deep `#A9D383`. Always include a label, not color alone.
- Product and email Latin typography follows Plus Jakarta Sans. Instagram and paid-social exports use Inter Semibold / Regular for cleaner mobile rendering.
- Every Arabic word in marketing artwork uses Cairo: ExtraBold for display and Cairo Variable for support copy. Do not mix Arabic font families.
- Functional icons: Lucide only. Use the approved 3D wallet from `public/logo.png`; do not mix logo generations or icon families. The wallet and every functional icon must contrast with its container—never reuse the icon’s dark forest as its background.
- Lime is an accent, not body text. Never put lime text on white; pair lime surfaces with forest-deep text.
- Use one dominant message, balanced breathing room, pill controls, and soft rounded cards. Avoid large unfinished-looking gaps, gradients, glass effects, neon glows, and loud multi-accent decoration.

## Approved claims matrix

Verify against the live build on the publish date. “Approved” means factually supportable, not permanently guaranteed.

| Claim | Approved wording | Proof / constraint |
| --- | --- | --- |
| Morocco relevance | `Un budget simple en MAD, pensé pour le quotidien au Maroc.` | MAD is supported; use “for Morocco,” not “made in Morocco,” unless company facts support it. |
| Manual tracking | `Tu ajoutes les informations que tu choisis de suivre.` | Do not imply transactions appear automatically. |
| No bank connection | `SmartJib ne se connecte pas à ton compte bancaire.` | Pair with manual-entry explanation. |
| No bank credentials | `Pas d’identifiants bancaires à partager avec SmartJib.` | Do not generalize this to “zero risk” or “unhackable.” |
| Purpose/place model | `Sépare le rôle de ton argent de l’endroit où il est gardé.` | Examples: needs/wants/savings versus bank/home/wallet. |
| Languages | `Disponible en العربية, Français et English.` | Confirm all promoted flows work in each language. |
| Currencies | `12 monnaies prises en charge, dont le MAD.` | Recount before publishing if product configuration changes. |
| Core plan | `Le budget de base est gratuit, sans limite de durée.` | Do not imply every feature is free. |
| Pro trial | `Les comptes éligibles peuvent démarrer un essai Pro de 90 jours, sans carte et sans renouvellement automatique.` | Eligibility and current launch terms must appear; billing is not live. |
| PWA | `Utilise SmartJib sur le web et installe-le comme application web.` | Do not use app-store badges without listings. |
| Data controls | `Export et sauvegarde complète restent disponibles depuis le profil.` | Validate in live release. |

## Claims requiring product/legal review

- Any superlative: “the best,” “the safest,” “number one.”
- “Encrypted,” unless the exact layer and scope are explained and verified.
- “Anonymous,” “100% private,” “zero risk,” “unhackable,” “bank-grade.”
- Guaranteed savings, debt reduction, wealth or behavioral outcomes.
- User counts, ratings, testimonials or performance percentages without evidence and permission.
- A fixed Pro price or billing promise before a live provider-owned offer exists.
- “Free forever,” “all features free,” or language hiding trial eligibility.
- “AI financial advice,” investment advice or personalized recommendations.

## Voice rules

| Use | Avoid |
| --- | --- |
| One small next step | Commands, shame or fear |
| `Ajuste quand la vraie vie bouge.` | `Tu as encore raté ton budget.` |
| Concrete MAD examples labeled as examples | Results presented as typical or guaranteed |
| Short, everyday sentences | Finance jargon and literal translations |
| `Essaie`, `commence`, `découvre` | False urgency, countdowns or scarcity |
| Educational guidance | Personalized tax, legal, investment or financial advice |

## Privacy-safe marketing

Never place the following in analytics, ad platforms, email merge fields, screenshots or audience uploads:

- balances, income, expenses, debts, goals or category names;
- transaction descriptions, receipts, invoices or product scans;
- bank/account identifiers, passwords or authentication data;
- household member data or invite codes;
- support text that reveals someone’s financial situation.

Use fictional demo data and generic amounts such as `10 000 MAD`, explicitly presented as examples.

## Review checklist

Before publish, the owner confirms:

- [ ] Claim matches current product and this matrix.
- [ ] CTA destination and UTM link work.
- [ ] One primary language; no cramped trilingual visual.
- [ ] Darija/Arabic reviewed where required.
- [ ] Contrast, type size, captions/alt text and mobile crop checked.
- [ ] No real user or financial data.
- [ ] No individualized advice or outcome guarantee.
- [ ] Correct legal footer/unsubscribe for email.
- [ ] Final file and approval date recorded in the campaign log.
