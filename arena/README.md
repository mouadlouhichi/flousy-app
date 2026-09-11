# SmartJib Team Pack — Arena Agent Usage

Arena Agent Mode has **no skills runtime** (no auto-invoke, no `/command` wiring) — so this folder is used as **workspace playbooks** the agent reads on request. Copy `skills/` and `agents/` into your Arena workspace (`/home/user/`), then invoke by name.

This pack is written for **SmartJib**: the private, mobile-first budget tracker (Next.js 16 + React 19 + TypeScript, Firebase Auth + Firestore, PWA) that separates what money is **for** (budget envelopes: needs / wants / savings) from where it is **held** (money places: bank / home / wallet / custom). It is grounded in the repository itself — `README.md`, `DESIGN.md`, `MVP_TODO.md`, `PRODUCTION_CHECKLIST.md`, `firebase-blueprint.json` and `firestore.rules` are the canonical references.

## Setup

```bash
# from this folder, in an Arena workspace:
cp -r skills agents /home/user/
```

## How to invoke

| You say | Agent does |
|---|---|
| `Use the <skill> skill to …` | Reads `skills/<skill>/SKILL.md` and follows its workflow |
| `Act as the <agent> agent` | Adopts `agents/<agent>.md` persona and rules |
| `Route this: …` | Reads `skills/team-skills/SKILL.md` router, picks one skill |
| `Run /eng:rules-audit for …` | Executes the named workflow from the agent/skill text |

## Examples

- "Use the software-development skill to add a field to the household month document."
- "Act as the Quality Assurance agent and run /qa:invariants on the transfer flow."
- "Route this: users on 3G say the dashboard feels stale after adding expenses."
- "Run /pm:prioritize on the post-launch backlog in MVP_TODO.md."

## The team

| Agent | Skill | Owns |
|---|---|---|
| Product Manager | `product-management` | Roadmap, PRDs, RICE, sprints, MVP_TODO |
| Software Developer | `software-development` | Next.js/React/TypeScript, Firestore Rules, outbox, releases |
| Quality Assurance | `quality-assurance` | Money invariants, test strategy, release gates, incident drills |
| Design UX UI | `design-ux-ui` | Serene Finance system, flows, prototypes, AR/FR/EN + RTL, a11y |
| Data Science | `data-science` | Consent-gated analytics, taxonomy, funnels, experiments |
| Marketing Sales | `marketing-sales` | Campaigns, SEO/blog, Instagram kit, signup funnel |
| Customer Support | `customer-support` | SLAs, runbooks, macros, help center, ticket feedback loops |
| Legal Compliance | `legal-compliance` | Law 09-08/CNDP, GDPR, terms/privacy, future CMI/Stripe billing |
| Operations | `operations` | Budgets, runway, hiring, vendors (Vercel/Firebase/Resend) |
| Business Development | `business-development` | Partnerships, distribution pilots, renewals |
| Public Relations | `public-relations` | Press, messaging, crisis comms |
| — | `team-skills` | Router that picks the right skill for ambiguous requests |

## Tips

- **Start of a work session**: name the skill + paste the relevant context — Arena agents don't preload skills into context.
- **Cross-domain work**: say "hand off per the skill's escalation matrix" and the agent will switch playbooks explicitly.
- **Money-domain truth**: when a request touches balances, envelopes, transfers or entitlements, have the agent read the actual code/tests (`src/lib/store.ts`, `src/lib/pro-features.ts`, `tests/`) rather than rely on memory — every skill tells it to.
- **Multi-model**: Arena routes across models, so keep instructions explicit — what's obvious to one model may not trigger another. Naming the skill file path helps.
