---
name: "team-skills"
description: "Router/index for the 11 team skills bundled in this pack: product-management (roadmap, PRDs, RICE, sprints), software-development (React, Firebase, WebRTC, CI/CD), design-ux-ui (flows, prototypes, usability, a11y), marketing-sales (campaigns, funnels, CAC), customer-support (SLAs, runbooks, macros), legal-compliance (CNDP, contracts, risk), operations (budgets, hiring, payouts), clinical-team (vetting, handbook, QA, safety), business-development (pilots, proposals, renewals), public-relations (press, crisis), and data-science (tracking, experiments, ML). Use when a request doesn't obviously match one skill and you need to pick the right one (e.g., 'bookings dropped', 'launch the pilot', 'review this feature')."
version: 1.0.0
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

This pack bundles **11 team skills** (this router is the 12th folder under `skills/`). Each skill is self-contained.

## Routing table

| Request signals | Skill | Path |
|---|---|---|
| Roadmap, PRD, user story, prioritization, RICE, sprint, backlog | product-management | `skills/product-management/` |
| React, Firebase, Firestore rules, WebRTC, CI/CD, deploy, bug, ADR | software-development | `skills/software-development/` |
| Wireframe, mockup, prototype, usability test, accessibility, WCAG, RTL | design-ux-ui | `skills/design-ux-ui/` |
| Campaign, lead gen, funnel, content calendar, SEO, CAC, ROAS | marketing-sales | `skills/marketing-sales/` |
| Ticket, SLA, escalation, macro, runbook, help center, CSAT, refund | customer-support | `skills/customer-support/` |
| Privacy, CNDP, consent, contract, DPA, liability, IP, breach, retention | legal-compliance | `skills/legal-compliance/` |
| Budget, forecast, runway, hiring, onboarding, payroll, vendor, payout | operations | `skills/operations/` |
| Therapist vetting, credentials, supervision, handbook, QA, crisis, boundaries | clinical-team | `skills/clinical-team/` |
| Partnership, B2B, pilot, proposal, negotiation, renewal, co-marketing | business-development | `skills/business-development/` |
| Press release, media pitch, crisis, holding statement, spokesperson, coverage | public-relations | `skills/public-relations/` |
| Event taxonomy, funnel analysis, dashboard, A/B test, churn, ML model | data-science | `skills/data-science/` |

If several match (e.g., "bookings dropped" → product, data, or marketing), route to the skill owning the **diagnosis first step**: data-science for metric truth, then hand off per its findings. If a request spans a handoff (e.g., "support keeps seeing join failures"), start where the user feels it (customer-support), then escalate per that skill's matrix.

## Quick start

```bash
# Example: route a product request
cat skills/product-management/SKILL.md

# Or a tracking question
cat skills/data-science/SKILL.md

# List all skills
ls skills/*/SKILL.md
```

## Related (paired agents, not in this bundle path)

- `agents/` — 11 agent personas (Product Manager, Software Developer, Design UX UI, Marketing Sales, Customer Support, Legal Compliance, Operations, Clinical Team, Business Development, Public Relations, Data Science), each linked to its skill(s) via frontmatter `skills:`.
- Root commands like `/pm:prd` or `/ds:experiment` live on the agents; skills hold the execution playbooks.

## Rules

- Route to exactly one skill, then follow that skill's workflow. This router ships no tools of its own.
- Respect each skill's escalation matrix for cross-domain handoffs (e.g., safety → clinical-team, data collection → legal-compliance).
- Therapy content (session text/audio/notes) is off-limits for analytics and models — route any such request to clinical-team + legal-compliance for a hard no with the compliant alternative.
