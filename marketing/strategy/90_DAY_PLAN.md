# SmartJib 90-day go-to-market plan

`D1` is the first public Instagram post, not the date the repository is prepared.

## Pre-launch: D-14 to D-1

| Window | Marketing lead | Product/analytics | Email | Social/community | Paid |
| --- | --- | --- | --- | --- | --- |
| D-14–10 | Freeze positioning and claims | Mobile smoke test; define non-financial events | Choose ESP; document consent source | Secure account, 2FA, profile owner | Create ad accounts and billing roles only |
| D-9–7 | Approve final links and offers | QA `/` → `/login` → onboarding; UTM persistence | Authenticate sender domain; create suppression list | Load profile, saved replies, Highlights | Build draft campaigns paused |
| D-6–4 | Approve 30-day calendar | Validate consented event payloads contain no financial data | Proof FR/AR templates in major clients | Schedule first nine posts | Validate URLs, exclusions, geography |
| D-3–1 | Go/no-go and incident owner | Capture a clean baseline | Seed only internal QA list | Response drills; Arabic review complete | Stay paused until organic baseline exists |

## Days 1–14: establish the story

### Publish

- Release Instagram grid in the reverse order documented in `instagram/LAUNCH_PLAN.md`.
- Publish 3–5 Stories each week and one FAQ answer.
- Pin the “what,” “difference” and “privacy” posts after the grid completes.
- Send **no launch blast** to product accounts unless those people separately opted into marketing.

### Learn

- Conduct 8–12 conversations with Morocco-based target users across the priority segments.
- Ask for a plain-language retelling of “purpose versus place.”
- Record objections without storing financial details.
- Compare French and Darija/Arabic engagement by content purpose, not language in isolation.

### Gate to Day 15

- [ ] Profile and site links resolve with correct UTMs.
- [ ] Support questions have an owner and <1 business-day target.
- [ ] Onboarding completion can be measured in aggregate for consenting users.
- [ ] No material claim confusion or broken localization remains.

## Days 15–30: validate messages organically

| Week | Test | Control | Variant | Decision signal |
| --- | --- | --- | --- | --- |
| 3 | Hook | Calm plan | Purpose/place | Saves + qualified site starts |
| 3 | Format | Static/carousel | 20-sec demo Reel | Landing CTA starts per reach |
| 4 | Trust frame | Manual control | No bank connection | Product starts plus trust-question rate |
| 4 | Language | French explainer | Darija/Arabic community hook | Completion/engagement within comparable format |

- Publish two Reels and two feed posts per week.
- Launch the newsletter only to explicit subscribers; send `E01` then `E02` from `mailing/EMAIL_COPY.md`.
- Do not infer a winner from likes alone.

### Gate to paid launch

- [ ] At least two messages produced qualified starts organically.
- [ ] Conversion QA passed on mobile for each landing URL.
- [ ] Campaign matrix, daily caps, exclusions and kill switch are assigned.
- [ ] Paid Darija/Arabic copy has local approval.
- [ ] Consent/legal review covers any pixel or retargeting setup.

## Days 31–45: controlled paid pilot

- Launch **Search — high intent** and **Meta — three message cells** from `advertising/campaign-matrix.csv`.
- Use equal initial budgets for the three Meta message cells.
- Keep one creative variable per ad set.
- Check spend, delivery, URL and conversion integrity daily; make strategic decisions weekly.
- Run creator outreach with a demo-data brief; commission at most 2–3 pilots before a result readout.

**Week 6 readout:** identify the best message by activated-budget cost and landing-to-activation rate. A cheap click with poor activation loses.

## Days 46–60: landing and proof iteration

- Route each winning message to its most relevant existing landing page.
- Test CTA copy (`Commencer mon budget` vs `Voir comment ça marche`) without changing headline simultaneously.
- Use FAQ/support themes to make one new organic explainer.
- Send the month-start checklist and one privacy explainer to appropriate consented segments.
- Pause placements/audiences that spend without enough quality signal; document why.

## Days 61–75: focus and habit

- Reallocate no more than 20–30% of budget per week to avoid abrupt learning resets.
- Introduce one approved creator asset against the winning branded creative.
- Test the savings-goal retention message after onboarding, not as a replacement for core positioning.
- Measure week-one return directionally and interview both returners and drop-offs.

## Days 76–90: consolidate

- Keep the top one or two acquisition systems; pause the rest.
- Publish a 90-day learning report: audience, message, creative, landing page, activation and retention.
- Decide next quarter: deepen Morocco direct-to-consumer, add partnerships, or improve activation before more reach.
- Refresh the claim matrix, creative fatigue log and email suppression audit.

## Weekly operating rhythm

| Day | Action |
| --- | --- |
| Monday | Dashboard and data-quality check; decide what not to change |
| Tuesday | Publish educational content; review support themes |
| Wednesday | Creative/localization review and next test build |
| Thursday | User conversation or creator check-in |
| Friday | Experiment readout, budget pacing and decision log |
| Daily | Community response, spend anomaly check and product incident watch |

## Go/no-go rules

**Immediate pause:** broken destination, spend anomaly, incorrect claim, privacy issue, missing unsubscribe, abusive comments requiring escalation, or conversion payload containing sensitive data.

**Continue unchanged:** delivery is healthy but the predeclared test window is incomplete.

**Scale carefully:** message wins on activated-budget cost and downstream quality, tracking is stable, support can absorb volume, and no trust signal deteriorates.
