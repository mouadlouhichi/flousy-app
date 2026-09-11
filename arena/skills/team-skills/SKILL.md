---
name: "team-skills"
description: "Router/index for the 11 team skills bundled in the SmartJib pack: product-management (roadmap, PRDs, RICE, sprints, MVP_TODO), software-development (Next.js, Firebase, Firestore Rules, outbox, CI/CD), quality-assurance (money invariants, test plans, release gates, drills), design-ux-ui (flows, prototypes, usability, a11y, RTL), marketing-sales (campaigns, SEO, Instagram kit, signup funnel), customer-support (SLAs, runbooks, macros, help center), legal-compliance (Law 09-08/CNDP, GDPR, contracts, billing rules), operations (budgets, hiring, contractors, vendors), business-development (pilots, proposals, renewals), public-relations (press, crisis), and data-science (consent-gated tracking, experiments). Use when a request doesn't obviously match one skill and you need to pick the right one (e.g., 'activations dropped', 'launch the pilot', 'review this feature')."
version: 2.0.0
author: "Mouad"
license: MIT
tags:
  - router
  - team
  - product
  - engineering
  - operations
agents:
  - claude-code
  - codex-cli
  - openclaw
---

# Team Skills — Router

This pack bundles **11 team skills** for SmartJib, the private budget tracker (this router is the 12th folder under `skills/`). Each skill is self-contained.

## Routing table

| Request signals | Skill | Path |
|---|---|---|
| Roadmap, PRD, user story, prioritization, RICE, sprint, backlog, Free vs Pro, MVP_TODO | product-management | `skills/product-management/` |
| Next.js, React, TypeScript, Firebase, Firestore rules, outbox, migration, deploy, bug, ADR | software-development | `skills/software-development/` |
| Test plan, money invariant, regression, release gate, ship/hold, rules verification, drill | quality-assurance | `skills/quality-assurance/` |
| Wireframe, mockup, prototype, usability test, accessibility, WCAG, RTL, empty state, Serene Finance | design-ux-ui | `skills/design-ux-ui/` |
| Campaign, signup funnel, content calendar, SEO, Instagram, CAC, launch plan | marketing-sales | `skills/marketing-sales/` |
| Ticket, SLA, escalation, macro, runbook, help center, CSAT, sync conflict, restore, demo mode | customer-support | `skills/customer-support/` |
| Privacy, CNDP, Law 09-08, GDPR, consent, contract, DPA, billing rules, breach, retention, license | legal-compliance | `skills/legal-compliance/` |
| Budget, forecast, runway, hiring, onboarding, contractor, vendor, renewal, payout | operations | `skills/operations/` |
| Partnership, employer, school, NGO, pilot, proposal, negotiation, renewal, co-marketing | business-development | `skills/business-development/` |
| Press release, media pitch, spokesperson, holding statement, crisis, coverage | public-relations | `skills/public-relations/` |
| Event taxonomy, consent, allowlist, funnel analysis, dashboard, A/B test, retention, trial conversion | data-science | `skills/data-science/` |

If several match (e.g., "activations dropped" → product, data, or marketing), route to the skill owning the **diagnosis first step**: data-science for metric truth, then hand off per its findings. If a request spans a handoff (e.g., "support keeps seeing sync conflicts"), start where the user feels it (customer-support), then escalate per that skill's matrix.

## Quick start

```bash
# Example: route a product request
cat skills/product-management/SKILL.md

# Or a release-safety question
cat skills/quality-assurance/SKILL.md

# List all skills
ls skills/*/SKILL.md
```

## Related (paired agents, not in this bundle path)

- `agents/` — 11 agent personas (Product Manager, Software Developer, Quality Assurance, Design UX UI, Marketing Sales, Customer Support, Legal Compliance, Operations, Business Development, Public Relations, Data Science), each linked to its skill(s) via frontmatter `skills:`.
- Root commands like `/pm:prd`, `/eng:rules-audit` or `/qa:release-gate` live on the agents; skills hold the execution playbooks.

## Rules

- Route to exactly one skill, then follow that skill's workflow. This router ships no tools of its own.
- Respect each skill's escalation matrix for cross-domain handoffs (e.g., money-data defect → quality-assurance, consent/legal question → legal-compliance).
- User financial content (amounts, balances, categories, notes, receipts) is off-limits for analytics, marketing, and partner reporting — route any such request to data-science + legal-compliance for a hard no with the compliant alternative.
