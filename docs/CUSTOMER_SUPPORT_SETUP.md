# Customer support setup and operations

Reviewed against the application on **26 November 2026**. This guide covers the customer pages, durable support inbox and optional email delivery. It does not activate a provider, send email, change a database or deploy the application.

## What is included

Customers can use `/faq`, `/support`, `/privacy`, `/terms`, `/refund-policy`, `/delivery-policy`, `/allergens`, `/cookies` and `/accessibility`. The public support email defaults to the owner-confirmed **grillsswill@gmail.com**. Pages share the `2026-11-26` policy version date, link to Support and display confirmed public business/contact configuration when available.

`POST /api/support` saves a support request in MongoDB and returns an acknowledgement/reference. Its `202` success means the record was accepted; it does not mean an email was delivered, a refund approved or an order changed. There is no public request lookup by email, ID or reference. The authenticated Admin → Support workspace provides status filters, cursor pagination, request details, replies and delivery history.

The storefront supports a worldwide audience. Food ordering still depends on actual locations and the options accepted by checkout. If no real locations are configured, customer pages use the matching no-location wording; sample addresses and 555 contacts do not establish a physical operation. Global website access is not a worldwide food-shipping promise or a legal registration jurisdiction.

## Configuration

Use managed deployment Secrets/environment settings, or a private ignored local environment file. Start with [`.env.example`](../.env.example); keep secret values out of version control, browser code, screenshots and support messages. Do not use `VITE_*` variables for credentials. The customer configuration exposes only public contact/business facts and feature flags, not database or email-provider secrets.

| Variable                    | Purpose / requirement                                                                                                                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `MONGODB_URI`               | Private server connection string. Needed for persistent cases, replies and quotas; actual connectivity and database permissions must be checked in the intended environment.                                                                                 |
| `MONGODB_DATABASE`          | Deliberately select the application database. The existing Mongo driver can otherwise use the database selected by its configuration/URI; do not accidentally point local checks at production.                                                              |
| `SESSION_SECRET`            | Private secret of at least 32 characters. Used by existing operator sessions and support quota identifiers. Use a strong environment-specific value; this guide does not rotate it.                                                                          |
| `ADMIN_PASSCODE`            | Existing private administrator credential; runtime expects at least 16 characters. Needed for the Admin workspace, separate from the staff passcode. Use a strong distinct credential.                                                                       |
| `STAFF_PASSCODE`            | Existing kitchen credential. It does not substitute for administrator permission to read support requests.                                                                                                                                                   |
| `PUBLIC_SITE_URL`           | The intended public HTTPS root origin for production. Existing SEO/payment behavior also depends on it. Local development can use its documented localhost origin.                                                                                           |
| `SUPPORT_EMAIL`             | Public inbox/notification recipient. Defaults to `grillsswill@gmail.com` when absent. Set a valid bare email address if intentionally overriding it; an invalid explicit value can disable notification delivery even while public contact falls back.       |
| `SUPPORT_FROM_EMAIL`        | Optional automated sender: a valid bare email address on a domain you own and have verified with Resend. No display-name wrapper. Gmail/Googlemail senders are deliberately rejected by the application.                                                     |
| `RESEND_API_KEY`            | Optional server-only raw Resend key. The current adapter validates the expected `re_` key format and sends only to the fixed Resend endpoint. Leave empty to use durable inbox/manual email only. Do not paste a key into public configuration or commit it. |
| `SUPPORT_TRUSTED_IP_HEADER` | Optional trusted proxy client-IP header. Accepted names are `x-forwarded-for`, `x-real-ip`, `x-vercel-forwarded-for`. Leave empty unless the actual proxy overwrites the selected header and prevents client spoofing.                                       |
| `LEGAL_BUSINESS_NAME`       | Optional public registered operator name. Leave blank until confirmed; the brand fallback is Grill & Swill, not an invented registered company.                                                                                                              |
| `LEGAL_BUSINESS_ADDRESS`    | Optional confirmed public business-notice address. Do not use sample store data.                                                                                                                                                                             |
| `LEGAL_JURISDICTION`        | Optional confirmed operator jurisdiction. Worldwide audience is not an appropriate substitute. Mandatory rights in the customer's location remain preserved.                                                                                                 |
| `SUPPORT_HOURS`             | Optional actual public support hours. Leave blank rather than inventing staffing, response-time or emergency-service promises.                                                                                                                               |

The current form-availability flag checks for configured MongoDB and a sufficiently long session secret; it is not a successful connection/transaction health check. A database failure returns a failure acknowledgement and the customer retains the entered message. If the inbox is not configured, `/support` offers the real email contact instead of pretending to save a request.

## Durable inbox without automated email

MongoDB must support multi-document transactions (a replica set/Atlas deployment is appropriate). The support implementation uses transactions when reserving request quotas, persisting requests/replies and recording administrative changes. It uses `support_requests`, `support_replies`, `support_rate_limits` and existing `admin_logs`, with MongoDB's `_id` uniqueness; it does not add a migration or execute support-schema DDL.

Use database permissions limited to the intended application database and confirm the deployment's transaction support. Runtime writes create support records; no real customer record or cloud permission was changed by implementation tests. If schema/index/retention DDL becomes necessary, follow the repository's Lovable-managed database instructions rather than editing managed migrations.

Leave `RESEND_API_KEY` and `SUPPORT_FROM_EMAIL` empty to retain cases without provider calls. Staff can then read cases, save replies, copy text or open their email application. Use the confirmed support mailbox for operational correspondence. A manually sent email is not automatically marked Sent in the site's delivery history. Saving a draft/reply does not itself send it when delivery is not configured.

Local testing should use a synthetic database/provider harness or a separately approved test database; do not inherit live MongoDB/payment credentials. The source includes isolated tests with mocked MongoDB and email delivery. Actual production database connectivity, Atlas policies, backups and live inbox/provider access were not verified by those tests.

## Optional Resend delivery

The current server adapter calls `https://api.resend.com/emails` with a server-only key. It sends a plain-text support notification to the configured inbox, with the customer's email as Reply-To. Staff replies go to the case's stored email and use the support inbox as Reply-To. Staff do not enter an arbitrary recipient into the reply API.

To enable this optional path:

1. Use an authorised Resend account and a sending domain owned by the operator. Complete the provider's domain/DNS verification, and obtain an appropriately scoped sending credential through its dashboard.
2. Configure a bare sender address on that verified domain in `SUPPORT_FROM_EMAIL` and the raw key in `RESEND_API_KEY`. Keep `SUPPORT_EMAIL=grillsswill@gmail.com` if that remains the intended receiving/reply mailbox.
3. A receiving Gmail inbox is valid for this purpose, but the application will not accept Gmail as the automated From address. Do not spoof the Gmail domain or treat publishing a mailbox as permission to send from it through another service.
4. Redeploy/restart the intended environment after changing managed variables. A syntactically accepted key/sender is not proof of domain verification, sender reputation or successful delivery.
5. Verify delivery only with approved synthetic recipients and an explicitly authorised test; do not send surprise emails to real customers. Check the recorded case and provider result together. No such live activation/test was performed by this implementation.

If no verified sender domain or key is available, keep provider delivery disabled and use the durable admin inbox/manual email workflow. The owner-confirmed Gmail contact is sufficient for public mail links; it does not by itself supply the missing automated sender setup.

Useful activation references: [Resend domains](https://resend.com/docs/dashboard/domains/introduction), [send email API](https://resend.com/docs/api-reference/emails/send-email), [API keys](https://resend.com/docs/dashboard/api-keys/introduction), [idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys). Configuration behavior in this guide was checked against the application source; these provider links are for operator setup, not a claim that an external account was accessed.

## Delivery states and retries

| State            | Meaning and operator action                                                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `not_configured` | Case/reply retained without a configured email sender. Review it in Admin and use manual email, or enable the approved provider configuration.                             |
| `queued`         | Saved for a delivery attempt. Refresh the case to inspect progress; saved is not sent.                                                                                     |
| `sending`        | An attempt holds a delivery lease. Avoid parallel manual resends while the outcome is uncertain. The server can reclaim a stale two-minute lease on a later allowed retry. |
| `sent`           | The email service returned an accepted-message response. This does not prove final inbox delivery, absence of a bounce or customer reading.                                |
| `failed`         | Rejection, timeout, unavailable provider or an outcome that could not be confirmed. Inspect the case/provider records before retrying. The saved case remains available.   |

Requests and replies use stable IDs so an unchanged retry does not create another case/reply or intentionally send the same accepted email again. Editing a message creates a new request/reply identity. The current server bounds automatic delivery attempts to three and uses a 24-hour provider-idempotency safety window. After that window an attempted retry requires manual review rather than a blind provider resend. The panel reuses the exact saved reply ID and text for a reply retry.

There is no background email queue/cron worker implemented here. Initial notifications/reply attempts happen in the relevant request; subsequent retries are administrator actions. Refresh the panel to observe state. It does not continuously poll while closed, and private support query data/drafts are not retained in browser storage by the panel.

Public `POST /api/support` returns only acknowledgement/reference after persistence, even if the optional notification fails. A customer cannot infer delivery status or another customer's private information from an email/reference lookup. A request ID and the supplied email are not proof that the submitter owns an order; establish the relevant identity and transaction relationship before disclosing records or making a business change.

## Operational handling and refunds

Assign a real team member to review New cases, prioritise active-order/food concerns, set In progress while reviewing and use Resolved only when the case has been handled. Spam status prevents reply/notification actions but does not delete the case. An email and a case-status change are distinct events. Keep replies factual and avoid passwords, full card details, private tracking tokens and unnecessary health information.

The owner approved an operational review process and normally returning approved refunds to the original payment method where supported. This site does **not** implement a provider refund action:

1. Identify the order and any genuine provider transaction; review payment state, amounts, duplicate-charge evidence and the reported issue. A customer-submitted reference alone does not authorise disclosure or a refund.
2. Confirm the proposed remedy with the customer, including affected items, amount and the handling of delivery fees, discounts and redeemed/earned points. Do not automatically promise restoration that the application does not perform.
3. If a refund is agreed, an authorised operator must use the provider's approved refund process outside this support feature. Return funds to the original method where supported; any alternative needs explicit verification and agreement.
4. Retain the provider confirmation/reference and explain the outcome. A reply saying “approved”, a resolved case or a cancelled order is not proof that money has been returned. Provider/bank posting times vary; no fixed refund or response deadline is supplied.

Catering forms remain inquiries requiring separate confirmation of timing, availability, portions and payment. Food/allergy emergencies need appropriate local medical help, not a website/email response. Privacy/accessibility requests need staff review and enough verification to avoid disclosing another person's records; this task adds no automatic deletion, access export or legal-compliance certification.

## Privacy choices and retention

The `/cookies` page describes the application-specific device-data control. It clears only known Grill & Swill local/session keys: guest identifier, cart, saved contact/address, checkout retry reference and map preference. It preserves unrelated browser storage. Clearing can disconnect this device from history/rewards; it does not cancel an order, refund a payment or delete server records. The confirmation's cancellation path leaves the data intact.

OpenStreetMap is initially unloaded until a customer allows it. The choice can be remembered for later visits. Disabling the preference stops future automatic map loading; it does not remove information already received by the provider. Written location information remains usable without loading the map. Google Fonts and other disclosed external content are still external services; this is not a fictional optional-analytics consent centre.

Support quotas use short active windows: 30 new requests globally per minute, three per email per hour, and—only when a trusted IP source is explicitly configured—five per network per 15 minutes. Contact/network counter identifiers are HMAC-derived with the server secret, not stored as raw email/IP in the quota key. The original contact information remains in the support case because it is needed for review/reply.

Quota expiry markers stop old windows from consuming the current quota; they do not automatically delete the counter documents. No TTL/deletion scheduler or general customer-record retention schedule is implemented. Set and review an appropriate operational retention/cleanup procedure for counters, cases, replies, logs and backups; do not claim that an expiry timestamp itself removes personal data. Follow managed database rules for any future schema changes. The source safety controls are not a substitute for the application's separate security remediation work.

## Verification and outstanding activation work

The isolated support tests use synthetic records and mocked providers, not real customer data or charges. Run relevant checks after configuration/code changes:

```sh
npm test -- src/test/support.test.ts src/test/support-form.test.tsx src/test/admin-support.test.tsx src/test/customer-pages.test.tsx
npm test
npx tsc --noEmit
npm run build
```

Root verification covers routing, navigation, public SEO and the production build. The component tests cover persistence acknowledgement versus email, malformed/oversized input, quota/idempotency behavior, administrator-only operations, stored-email reply binding, literal text rendering, retries, private-cache cleanup, map choice and scoped browser clearing. Native MongoDB isolation/permissions, real provider/domain delivery, mail bounces and production monitoring need an authorised environment check; mocked tests do not prove those.

Before trusting the site with production users, finish the owner-specific facts and operational procedures: registered legal operator/address/jurisdiction, actual locations and fulfillment coverage, ingredient/allergen arrangements, support staffing/hours/escalation, verified sender/key if automated email is desired, record retention and privacy-request handling, and remaining security remediation. The current policies preserve mandatory rights according to the customer's applicable location rather than inventing an exclusive governing country or compliance status.

See [the customer policy review](CUSTOMER_POLICY_REVIEW.md) for source evidence/remaining decisions and [SEO setup](SEO.md) for indexing configuration. No production deployment, provider activation, real email, refund or destructive database operation was performed to create this guide.
