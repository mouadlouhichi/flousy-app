# Icon source of truth

Every functional icon in the generated Instagram kit is rendered from [Lucide](https://lucide.dev/icons/), via the app's existing `lucide-react` dependency (`0.468.0`). The generator consumes Lucide's exported SVG geometry directly rather than maintaining a separate, hand-drawn icon set.

| Content use | Lucide icon |
| --- | --- |
| Budget / money place | `WalletCards` |
| Location / places | `MapPin` |
| Savings goals | `Target`, `PiggyBank`, `Coins` |
| Privacy | `ShieldCheck` |
| Tour / planning cycle | `CalendarDays` |
| Questions | `MessageCircleQuestion` |
| Languages | `Languages` |
| Friendly emphasis | `Sparkles`, `Heart`, `Moon` |
| CTAs / progress / video | `ArrowUpRight`, `CircleCheck`, `Play` |
| Bank / home context | `Landmark`, `House` |

## Editing rule

For a new icon, choose the clearest existing Lucide glyph first and keep its standard rounded outline. Do not introduce emoji, clip art, a second icon family, or copied logo marks. In Figma or another design tool, import the SVG directly from Lucide and keep the Lucide attribution/license information with the source design files when required by your workflow.
