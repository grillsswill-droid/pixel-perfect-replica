# Prioritised security remediation plan

This is a proposed implementation roadmap, not a claim that fixes have been applied. Preserve guest checkout, pricing/customisation, historical receipts, hosted payment and kitchen/admin functionality. All application/dependency/infrastructure changes await authorization after the audit. Lovable-managed schema/migrations, generated code and deployment Secrets must be changed through their managed workflows; published connected Git history must not be rewritten.

## Immediate action

| Priority / finding | Concrete action and responsible boundary | Risks and verification |
|---|---|---|
| 1 — SEC-001 | Owner inventories every deployment using the exposed DB URI, administrator passcode or signing key, then rotates/revokes affected credentials in Secrets and restricts access to old credentials. Review history readers and suspicious auth/database/action logs. Assess all other historical credentials for continued use. | Do not automatically authenticate with old values. Coordinate DB connection replacement and deployment restart. Signing rotation invalidates sessions/share links; provide legitimate order-access recovery. Verify new values are distinct and old synthetic seals fail. Do not force-push/remove Lovable history. |
| 2 — SEC-002, SEC-004 | Establish verified server-issued guest authority and signed, expiring checkout continuation. Derive ownership independently of body UUID and provider transaction ID. Minimise shared order responses. | Preserve guest cart/history migration and legitimate return from hosted checkout; never grant read authority merely because payment is verified. Compiled two-guest and one-order-sharing tests must fail cross-access. |
| 3 — SEC-003 | Remove the production-exposed demo RPC and require positive payment verification for ordinary fulfillment/rewards. | Inventory existing legitimate legacy/manual records first. Assert production resolver absence and reject unpaid/no-provider synthetic fulfillment. Keep explicit privileged exception workflow if needed. |

## Before production

1. **Repair reward and promotion invariants (SEC-005, SEC-006).** `payments.server.ts`, the order/guest/promotion model and managed indexes need atomic idempotent reservations at initialization, consumption at verified settlement and exactly-once release on cancellation/expiry. Reservation ownership must use verified guest identity. Validate sequential and concurrent checkouts against an isolated replica set, including transaction retries and late paid attempts. Do not solve the issue by clamping negative points or checking a stale balance only at finalization after the customer has paid.

2. **Repair attempt/event reconciliation (SEC-009, SEC-010, SEC-011, SEC-015).** Keep immutable attempt references, original order/amount/currency binding and terminal state. Recheck the attempt transactionally before marking paid. Treat unsigned callback status as display-only. Persist retryable pending provider verification and recover it; complete a successful event only after its intended durable outcome. Add compare-and-set webhook leases. Test delayed provider consistency, expired checkout paid late, callback/webhook races, duplicate charges and crashed worker recovery using provider mocks, then an official sandbox. Existing actual charges, if any, require owner-reviewed reconciliation rather than automatic refunds during audit.

3. **Throttle privileged and public abuse (SEC-007, SEC-012).** Persist limits across instances for administrator/staff login, callback verification, checkout initialization, comments, catering and likes. Use verified guest/operator identity and trusted network signals; count/insert quota reservations must be atomic. Define trusted proxies before accepting forwarding headers. Enforce strong distinct operator secrets at startup. Use conservative fixtures and thresholds; avoid lockout of legitimate shared-network operators/guests.

4. **Make privileged sessions revocable (SEC-008).** Add opaque stored sessions or a verified ID/version/revocation lookup. Invalidate at logout, passcode/account changes and disablement. Preserve role-separated cookies, absolute expiry, `HttpOnly`, production `Secure` and existing CSRF/SameSite controls. Test copied old seals after each lifecycle transition across instances. Disable unused session-header transport only as a supplementary change.

5. **Bound parsing before allocation (SEC-013).** Stream-check actual bytes, reject excessive keys/depth/array lengths early and enforce a global request budget for JSON/form/server-function POSTs. Update affected Zod/framework development dependencies only after documented compatibility review. Zod 3→4 may affect schema/refinement/error APIs; use meaningful checkout/cart/admin regressions. Test chunked/multibyte requests, missing/fake Content-Length and small key/depth fuzz fixtures before DB access; use timeouts, not exhaustion loads.

Production release gates should include the original 64-test suite, all audit regressions rewritten to assert secure outcomes, compiled resolver/API checks, isolated Mongo transactions/index validation, official provider sandbox reconciliation, refreshed SCA/secret scans and staging response/TLS/edge controls. Existing lint failure should be repaired or explicitly separated from security checks so CI can provide a usable gate. A successful build alone is insufficient.

## High-priority hardening

| Area | Recommended change | Verification / possible breakage |
|---|---|---|
| Operator identity / monitoring — SEC-016 | Individually revocable staff/admin identities, optional role-appropriate MFA, structured failures/denials/session/credential events, actor/request correlation and protected durable logs. | Preserve kitchen role scope and customer guest access. Synthetic events must be useful without passwords/tokens/contact bodies; test incident investigation and alerts in staging. |
| Response policy — OBS-001 | Private RPC/API/receipt responses explicitly `no-store`; compatible CSP, frame policy, `nosniff`, referrer policy and HTTPS/HSTS at actual serving boundary. | Framework inline scripts and error-page actions may need nonce/hash handling. Check payment redirects, image delivery, printable receipts and deployed CDN caching. Do not infer production headers from source alone. |
| Dependencies | Apply targeted compatible patches from the dependency inventory. Remove inactive Stripe/legacy tooling only after import/build review; reconcile root/nested lockfiles and deprecated packages. | Avoid blanket upgrades, broad version overrides or disabling useful features. Re-run lock-consistency, runtime/production build and vulnerability checks; pin deployment toolchain. |
| Secret lifecycle | CI pre-commit/history secret scanning, placeholder template check, explicit environment validation and production-only secret delivery. | False-positive fixtures need narrow documented exceptions; do not globally suppress `.env.example`. Review preview live-payment keys and ensure payment tests always use official sandbox/mocks. |

## Medium-priority improvements

- **Share capability lifecycle (SEC-014):** Separate owner historical receipts from third-party sharing, with purpose/time/version and per-order revocation. Provide guest-owner refresh/recovery. Verify old shared links fail after revocation while owners retain receipts.
- **Media lifecycle (OBS-002):** Define public draft/retention semantics. If drafts require confidentiality, introduce staged private access and publication transitions; reconcile GridFS and gallery deletion plus immutable-cache revocation. Keep signature/size checks and consider safe decode/re-encode/pixel limits if image processing is introduced.
- **MongoDB provisioning:** Owner reviews Atlas ACLs, TLS flags, least-privilege roles, encryption, managed collection validators, indexes and backup/restore. Separate index-provisioning privileges from runtime identity where feasible. Validate sparse/legacy checkout uniqueness on synthetic migrated records and referential deletion behaviour. All schema changes go through Lovable.
- **Legacy surface (POT-002):** Review whether the Supabase project, bootstrap function, old grants and nested demo remain deployed. Decommission or secure intentionally retained external surfaces through the managed owner workflow. Confirm main app and nested demo deployment targets separately.
- **Option integrity (POT-001):** Reject duplicate selections and define allowed negative adjustments/final price bounds. Preserve legitimate single-choice size adjustments; test synthetic multiselect discounts without assuming the live catalog contains them.
- **Client data minimisation:** Consider contact/address retention and shared-device clearing; keep privileged seals out of JavaScript storage. Verify share URL/referrer/log handling with the deployed edge. Do not remove convenient guest persistence without a safe replacement.

## Long-term security improvements

Establish an owned threat model and API inventory change gate; install official Codex Security for standard/deep scans plus compatible SAST, SCA and SBOM tooling; regularly refresh advisories and dependency provenance. Add CI secret/dependency/authorization/commerce checks and meaningful transaction/attempt integration tests. Stage provider retry simulations and backup restoration drills. Define incident response contacts, event retention/access, data retention/deletion and credential rotation procedures. Review privileged access and production/preview separation periodically.

## Proposed implementation sequence and acceptance

| Stage | Reviewable deliverable | Acceptance |
|---|---|---|
| A | Owner credential incident response and deployment reuse inventory | Exposed values replaced wherever applicable; access/log review documented; legitimate session/order recovery available |
| B | Guest session/DTO/continuation plus demo endpoint removal | Two-guest and share-scope tests pass through compiled handlers; no unpaid rewards/fulfillment path |
| C | Managed attempt/reservation/event model and recovery worker | Real isolated Mongo concurrency/idempotency and mocked/sandbox provider late-success tests pass |
| D | Revocable operator sessions, persistent abuse controls, parser budgets | Old seals rejected, cross-instance quotas bounded, oversized/structural inputs rejected early |
| E | Targeted dependency/header/monitoring/retention improvements | Fresh scans, deployed staging checks and incident/backup exercises completed |

Authorize stages as concrete scopes. Implementation should include its own source review and independent verification; the original exploit tests must be changed to assert rejection/conservation rather than continuing to pass by demonstrating the defect.

