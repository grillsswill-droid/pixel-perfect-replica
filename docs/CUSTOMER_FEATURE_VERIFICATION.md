# Customer feature verification

Reviewed on 26 November 2026. This records implementation validation for the help, policy, privacy controls and support inbox features. It supplements the previous security assessment; it is not a fresh clean bill of health for the entire application.

## Delivered scope

Seven policies (privacy, terms, cancellations/refunds, delivery, food/allergens, cookies/storage, accessibility), 32 searchable FAQ answers, customer support form/direct email, administrator support inbox/replies, browser storage/map controls, navigation/footer/checkout links, and public SEO for all nine new routes. The confirmed public email is **grillsswill@gmail.com**. Worldwide site access is distinguished from actual checkout fulfillment availability.

The policies were checked against source behavior and reviewed independently. Operator name/address/jurisdiction have configurable public fields, but no unconfirmed legal facts, automatic refunds, delivery deadlines, compliance certifications or staffing promises were invented. The [policy review](CUSTOMER_POLICY_REVIEW.md) records the source basis and outstanding legal/operational work.

## Executed checks

| Check | Actual result | Boundary |
|---|---|---|
| Complete Vitest suite | 244 tests in22 files passed | Synthetic database/provider fixtures; no production services |
| Support backend | 38 tests passed | Strict inputs, streamed byte/deadline limits, origin controls, quotas, persistence, idempotency, admin-only operations, fixed recipients, reply bounds and delivery retries |
| Support form | 9 tests passed | Label/error associations, durable acknowledgement, unchanged retries, malformed/empty acknowledgements, failure retention and direct email fallback |
| Customer pages/privacy controls | 14 tests passed | All7 policy sections/anchors, actual refund wording, FAQ answer search, no-results recovery, map choice and scoped clearing confirmation |
| Administrator support UI | 6 tests passed | Empty/error/pagination/detail/reply states, literal text, stable retry IDs, truthful unsent/manual handling and private query cleanup |
| SEO | 82 tests passed | Actual combined router matching, all15 public entries, original/private route preservation, canonical/schema/privacy gates and discovery behavior |
| TypeScript | `tsc --noEmit` passed | Whole configured project |
| Targeted ESLint | Zero errors; two Fast Refresh warnings | Customer modules, support modules, routing and SEO; not a claim that repository-wide legacy lint is clean |
| Design pattern detector | Zero findings on changed public customer surfaces and footer | Static design check, supplemented by browser review |
| Production builds | Node and Vercel builds passed | Separate credential-free copies; existing dependencies; no deployment |
| Compiled SSR/HTTP handlers |48/48 checks passed | All15 public pages with appropriate synthetic location setup, private noindex, 14-URL sitemap, all32 FAQ answers, support202 persistence/retries/input/origin/method behavior and404/preview responses |

The actual test commands and versions, initial failed checks and their corrections are recorded in [validation results](customer-feature-evidence/validation-results.json). The complete compiled check results are in [compiled evidence](customer-feature-evidence/compiled-checks.json).

The compiled checks can be repeated with [verify-customer-pages.mjs](../scripts/verify-customer-pages.mjs) against a credential-free **Node** build copy:

```sh
node scripts/verify-customer-pages.mjs /path/to/credential-free-built-copy
```

This harness injects process-local MongoDB fixtures and disables networking/provider calls and native environment-file loading before importing the application. It starts no TCP listener. It writes `customer-ssr-results.json` into the isolated build directory. It does not use the site's real database or payment/email keys.

## Coverage limits and activation

No live MongoDB transaction/permissions/backups, provider domain/key, Gmail delivery or bounce handling was tested. No real payment, email, refund, cloud change or deployment occurred. Process-local transaction fixtures model rollback, not replica-set concurrency/isolation or Mongo transaction retry semantics.

Configure the intended database and secure operator sessions to use the durable inbox. Automated email additionally needs a verified-domain Resend sender and server-only key; Gmail is the public recipient/manual mailbox, not a spoofed sender. Until configured, the site honestly offers direct email or saved replies rather than claiming delivery. The [support setup guide](CUSTOMER_SUPPORT_SETUP.md) describes configuration, retries and manual review/refund procedures.

Before production, finish the confirmed legal operator/address/jurisdiction, operational retention and privacy-request handling, actual fulfillment/allergen arrangements and the separate [security remediation plan](../security-audit/SECURITY_REMEDIATION_PLAN.md). The policies preserve mandatory local rights; worldwide operations do not establish one exclusive governing law.
