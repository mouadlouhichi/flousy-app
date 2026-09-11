# Privacy-safe measurement plan

## Principle

Measure whether marketing helps someone reach a useful plan without exporting their money story. Analytics is opt-in in the current app. Marketing measurement must preserve that default.

## KPI tree

### Business/behavior outcome

- Activated budgets per week (aggregate).
- Cost per activated budget for paid channels.
- Privacy-safe week-one return rate for activated cohorts.

### Funnel diagnostics

1. Landing sessions by campaign.
2. Primary CTA clicks.
3. Account starts/completions.
4. Onboarding starts/completions.
5. Week-one product return.

### Channel diagnostics

- Instagram: saves/reach, shares/reach, profile-to-link-tap rate, qualified starts.
- Email: delivered, unique clicks, unsubscribe, complaint and bounce rates; activation after click where consent permits aggregate attribution.
- Ads: CPM/CPC/CTR as delivery diagnostics; landing-to-activation and cost per activated budget as decisions.
- Search: query relevance, landing engagement and activated-budget cost.

## Required event specification

The current analytics seam allowlists only reviewed non-financial fields. Add events only after tests confirm no sensitive values.

| Event | Trigger | Allowed dimensions | Never include |
| --- | --- | --- | --- |
| `marketing_landing_view` | Public campaign landing renders after consent | `page_path`, `language` | full query string if it may contain unreviewed values |
| `marketing_cta_click` | Main public CTA selected | `page_path`, `language`, `type` | user ID, email |
| `account_start` | Auth method initiated | `method`, `language` | provider response or email |
| `account_complete` | Account successfully created | `method`, `language` | UID |
| `onboarding_start` | First onboarding screen viewed | `language` | income/currency amount |
| `onboarding_complete` | Onboarding succeeds | `language`, `currency`, `strategyId` | any allocation, bill or balance |
| `product_return` | Eligible aggregate day-window return | `duration_days`, `language` | page content or financial data |

`currency` and `strategyId` are already allowlisted dimensions; still use only when needed and review small-cohort privacy risk. Do not send category labels, custom strategy percentages or any amounts.

## Attribution minimum

Use UTMs on external links:

```text
utm_source={platform_or_partner}
utm_medium={social|paid_social|cpc|email|creator|partner}
utm_campaign=clarity_ma_{phase}
utm_content={message}_{format}_{language}_{version}
utm_term={keyword_only_for_search}
```

Example:

```text
https://smartjib.space/features/no-bank-connection?utm_source=instagram&utm_medium=paid_social&utm_campaign=clarity_ma_pilot&utm_content=private_feed_fr_v1
```

### Naming vocabulary

- Message: `calm`, `purpose_place`, `private`, `mad`, `goal`.
- Format: `feed`, `story`, `reel`, `search`, `email`, `creator`.
- Language: `fr`, `ar`, `en`.
- Version: `v1`, `v2`.

Lowercase ASCII and underscores only. Never put audience names, emails or personal data in a URL.

## Current implementation gaps before spend

- The app has an opt-in analytics seam, but this plan’s acquisition events are not all present.
- UTM persistence from public landing through account/onboarding completion needs an explicit privacy review and implementation.
- Marketing-email consent and subscriber lifecycle infrastructure are not present in this repository.
- Ad-platform pixels are not required for the first pilot and must not be added casually; use privacy-safe aggregate/server reporting only after review.

## Dashboard views

1. **Data quality:** event counts, missing campaign, duplicate rate, consented coverage, release marker.
2. **Funnel:** landing → CTA → account → onboarding by source/message/language.
3. **Paid:** spend → activated budgets → cost per activated budget → week-one quality.
4. **Content:** saves/shares/link taps and qualified starts by pillar.
5. **Email health:** delivered, bounced, complained, unsubscribed and clicked by campaign.

Suppress or aggregate slices with very low counts. Never expose an individual’s behavior in a marketing dashboard.

## Experiment card

Complete before launch:

- **ID:** `EXP-YYYY-NN`
- **Hypothesis:** one sentence.
- **Audience:** one segment.
- **Control / variant:** one changed variable.
- **Primary metric:** activated-budget rate or cost.
- **Guardrails:** unsubscribe/complaint, support issues, landing performance.
- **Decision window:** dates or qualified sample threshold.
- **Tracking QA owner/date:** required.
- **Decision:** keep / iterate / stop with evidence.

## Reporting cautions

- Analytics is consented and therefore not a census. Report observed, directional cohorts clearly.
- Platform-reported conversions and first-party aggregate outcomes may differ.
- Do not declare causality from week-over-week movement alone.
- Document outages, release changes, budget changes and creative swaps alongside charts.
