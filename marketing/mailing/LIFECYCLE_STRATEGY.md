# Mailing lifecycle strategy

## Goals

- Help a consenting subscriber understand SmartJib before asking them to start.
- Help a consenting new user complete a useful first plan.
- Encourage a calm check-in without using financial surveillance or shame.
- Protect sender reputation and user trust.

## Segments

| Segment | Entry rule | Exit/suppress rule | Program |
| --- | --- | --- | --- |
| `newsletter_opt_in` | Explicit marketing opt-in with timestamp/source | Unsubscribe, complaint, hard bounce, deletion request | E01, E02, E05 |
| `new_user_opt_in` | Account plus separate marketing/lifecycle consent | Same as above; stop onboarding tips when complete if trigger is known safely | E03–E07 |
| `inactive_opt_in` | Consented user with privacy-safe inactivity window | Any return, unsubscribe, complaint, or one E08 with no response | E08 once |
| `transactional_only` | Account/service relationship without marketing consent | N/A | **No marketing sends** |
| `suppressed` | Unsubscribe, complaint, hard bounce or legal request | Only explicit lawful resubscription where permitted | Nothing |

Do not upload product accounts to ad platforms or mailing tools as a “custom audience.”

## Trigger map

| Trigger | Delay | Message | Cancel when |
| --- | ---: | --- | --- |
| Newsletter confirmation | Immediate | Provider-native confirmed opt-in | Confirmation expires or is withdrawn |
| Confirmed newsletter | Immediate | E01 brand welcome | Suppressed |
| Account + lifecycle opt-in | 15–60 min | E03 first calm step | Onboarding already complete or suppressed |
| E03 delivered | +2 days | E04 purpose/place | Suppressed |
| E04 delivered | +3 days | E06 manual/privacy | Suppressed |
| Activated user | +4 days | E07 small goal/check-in | Suppressed |
| Month start preference | Chosen day | E05 reset checklist | Frequency cap or suppressed |
| Inactive consented user | 14–21 days | E08 return without guilt | Recent return or previous E08 |

If the implementation cannot evaluate cancellation safely and reliably, use a simpler subscriber newsletter rather than pretending to personalize lifecycle state.

## Content principles

- One idea and one action per email.
- Useful even when the recipient does not click.
- No countdowns, false urgency or shame.
- No financial details in subject, preview text, URL or merge field.
- No claims beyond `../BRAND_GOVERNANCE.md`.
- Text version must preserve meaning and unsubscribe links.

## Deliverability architecture

- Authenticate SPF and DKIM; publish DMARC with a monitored reporting address and tighten policy only after observation.
- Use a dedicated, recognizable marketing stream/domain configuration separate from transactional invites/support.
- Enforce hard-bounce, complaint and unsubscribe suppression globally.
- Use confirmed opt-in where appropriate, especially for imported or event-collected addresses.
- Do not buy, scrape or enrich lists.
- Warm sending gradually with the most recently consented, engaged recipients.
- Investigate complaint/bounce spikes before the next send.

## Privacy-safe personalization

Allowed:

- explicit language preference;
- first name when voluntarily supplied for communication;
- broad lifecycle state such as onboarding complete, if collected/used lawfully and not exported with financial detail.

Not allowed:

- income, balance, debt, spending, category, goal or transaction data;
- a household member’s activity;
- inferred financial stress or wealth;
- a subject line exposing account activity on a shared screen.

## Performance interpretation

Open-rate data is unreliable and can be privacy-invasive. Use delivery, unique click, unsubscribe, complaint and downstream aggregate activation as the core signals. Compare like-for-like audience freshness and language.

### Guardrails

Set launch thresholds with the provider and legal/marketing owners. Regardless of benchmark, pause immediately for a material complaint spike, broken unsubscribe, accidental non-consented send, sender spoofing issue or leaked personal data.
