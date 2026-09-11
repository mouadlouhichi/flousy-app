# Marketing email send checklist

## Sender and permission

- [ ] Marketing consent source, timestamp, policy version and language are available.
- [ ] Transactional-only contacts are excluded.
- [ ] Unsubscribed, complained, hard-bounced and deletion-requested addresses are suppressed.
- [ ] From name/domain and reply-to are recognizable and monitored.
- [ ] SPF/DKIM pass; DMARC reporting is monitored.
- [ ] Recipient source is first-party opt-in—never bought, scraped or silently imported.

## Content

- [ ] Subject, preview and body use one primary language.
- [ ] Local reviewer approved Darija/Arabic.
- [ ] Claim is approved in `../BRAND_GOVERNANCE.md`.
- [ ] One clear CTA and useful no-click takeaway.
- [ ] No balance, income, debt, goal, category or transaction merge field.
- [ ] Plain-text version included.
- [ ] Image has alt text; message still works with images blocked.

## Links and legal footer

- [ ] Production URLs and UTMs tested.
- [ ] CTA destination loads on mobile and in the selected language.
- [ ] One-click unsubscribe works and updates the global suppression list.
- [ ] Preference, privacy, company identity and required address placeholders are replaced.
- [ ] Reply address is monitored.

## Rendering and accessibility

- [ ] 320 px mobile, desktop and dark-mode previews checked.
- [ ] Gmail/webmail, Apple Mail and Outlook proofed where available.
- [ ] RTL email checked in a real Arabic-capable client.
- [ ] Body is at least 16 px; CTA is touch-friendly; contrast passes review.
- [ ] No essential text appears only inside the header image.

## Audience and launch

- [ ] Segment query peer-reviewed and count is expected.
- [ ] Frequency cap and local send time checked.
- [ ] Internal seed/proof received before the real audience.
- [ ] Abort owner and provider access identified.
- [ ] Campaign ID recorded in `send-calendar.csv`.

## After send

- [ ] Delivery, bounce, complaint, click and unsubscribe checked after 1 hour and 24 hours.
- [ ] Suppression webhooks succeeded.
- [ ] Aggregate downstream activation reviewed after the decision window.
- [ ] Learning and next action logged; no public reporting of small cohorts.
