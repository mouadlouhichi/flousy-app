# SmartJib mailing kit

Consent-safe lifecycle and newsletter material for a Morocco-first launch.

## Included

| File | Use |
| --- | --- |
| [`LIFECYCLE_STRATEGY.md`](LIFECYCLE_STRATEGY.md) | Segments, triggers, suppression and operating rules |
| [`EMAIL_COPY.md`](EMAIL_COPY.md) | Eight ready campaign briefs with French and Darija/Arabic copy |
| [`SEND_CHECKLIST.md`](SEND_CHECKLIST.md) | Deliverability, QA, legal and post-send controls |
| [`send-calendar.csv`](send-calendar.csv) | Importable 90-day send schedule |
| [`templates/launch-fr.html`](templates/launch-fr.html) | Responsive French launch/newsletter email |
| [`templates/launch-ar.html`](templates/launch-ar.html) | Responsive RTL launch/newsletter email |
| [`templates/welcome-fr.html`](templates/welcome-fr.html) | Responsive first-step email |
| [`templates/welcome-ar.html`](templates/welcome-ar.html) | RTL first-step email |
| [`assets/smartjib-email-header-1200x480.png`](assets/smartjib-email-header-1200x480.png) | Generated optional header image |

## Critical consent boundary

SmartJib account creation, a household invitation, a contact request or a service email does **not** grant marketing permission. Send these campaigns only when the recipient has explicitly opted into marketing and the consent source/time can be demonstrated.

Before any real send, the operator must provide:

- a verified sender domain and monitored reply address;
- explicit marketing consent storage;
- a one-click unsubscribe mechanism and suppression list;
- accurate sender identity and postal/legal details appropriate to the operator;
- a retention/deletion policy and privacy notice update;
- bounce and complaint webhook handling;
- a tested preference/unsubscribe URL replacing all template placeholders.

This repository currently uses Resend for narrow transactional flows. It does not contain a marketing subscriber system; the templates are production copy/design assets, not permission to send.

## Recommended program

1. **Newsletter subscriber:** E01 launch → E02 method explainer → E05 month reset, maximum one useful email per week initially.
2. **New user who separately consented:** E03 first-plan help → E04 purpose/place → E06 privacy/manual → E07 goal habit.
3. **Inactive consented user:** E08 gentle return once; suppress if there is no response.

Keep transactional and marketing streams separate in provider configuration, message classification, templates and unsubscribe behavior.

## Template variables

Replace safely in the ESP; escape all values.

- `{{preference_url}}` — required.
- `{{unsubscribe_url}}` — required, one click where applicable.
- `{{privacy_url}}` — usually `https://smartjib.app/privacy`.
- `{{company_name}}`, `{{company_address}}` — verified operator identity.
- `{{first_name}}` — optional. If missing, remove the greeting token rather than showing a blank.

Do not use financial amounts, budget progress, category names or goal names as merge fields.

## Send defaults

- From name: `SmartJib`.
- Reply-to: `hello@smartjib.app` only when monitored.
- Frequency cap: 1 marketing email per 7 days per person during launch; service messages are governed separately.
- Primary CTA: `Commencer mon budget` / `نبدا ميزانيتي`.
- Prefer one primary language based on explicit preference; never infer language from sensitive behavior.
- Use UTM conventions in `../strategy/MEASUREMENT_PLAN.md`.
