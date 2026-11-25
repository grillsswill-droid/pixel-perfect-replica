# Security finding register

Assessed revision: `cd56b33ef334d98f81e9d9bde23727ace5d71265`, branch `main`, 25 November 2026. Application and deployment files were not changed. Synthetic demonstrations establish application behaviour; they do not establish exploitation of a deployed service. A passing demonstration test means the vulnerable behaviour was reproduced.

Severity is contextual and qualitative. No numerical CVSS 4.0 score is asserted because deployed exposure, credential validity, edge controls and financial impact were not measured. Scanner advisory ratings are recorded separately in the dependency inventory. Findings sharing an attack chain are not independent estimates of loss.

## Register

| ID | Severity | Classification / confidence | Finding |
|---|---|---|---|
| SEC-001 | High | Confirmed exposure; high | Historical committed secrets are still reused in local configuration |
| SEC-002 | High | Confirmed vulnerability; high | Single-order access expands to other orders, private data and cart writes |
| SEC-003 | High | Confirmed vulnerability; high | Production publishes demo checkout that bypasses payment and awards rewards |
| SEC-004 | High | Confirmed vulnerability; high | Payment transaction ID alone exchanges into a private order capability |
| SEC-005 | High | Confirmed integrity vulnerability; high | Multiple pending checkouts spend the same rewards balance |
| SEC-006 | Medium | Confirmed integrity vulnerability; high | Pending Flutterwave checkouts exceed promotion usage limits |
| SEC-007 | Medium | Confirmed source weakness; high | Privileged login lacks throttling and staff passcode strength validation |
| SEC-008 | Medium | Confirmed vulnerability under cookie compromise; high | Copied privileged sessions survive logout and passcode changes |
| SEC-009 | Medium | Confirmed vulnerability; high | Unsigned GET callbacks change pending payment state |
| SEC-010 | Medium | Confirmed integrity defect; high | Payment retries discard attempts and settlement omits an attempt recheck |
| SEC-011 | Medium | Confirmed conditional integrity defect; high | A success webhook verified as pending permanently suppresses retries |
| SEC-012 | Medium | Confirmed abuse-control defect; high | Caller-selected identities and count/insert races bypass creation quotas |
| SEC-013 | Medium | Confirmed parser weakness / known affected package; high | Request and structural budgets do not bound validation work |
| SEC-014 | Low | Confirmed access-persistence weakness; high | Shared order capabilities have no expiration or individual revocation |
| SEC-015 | Low | Confirmed concurrency weakness; high | Concurrent workers both reclaim the same stale webhook event |
| SEC-016 | Low | Confirmed source monitoring gap; high | Security events lack individual attribution and authentication monitoring |
| OBS-001 | Informational | Observed in compiled handlers; high | HTTP security headers and private-response caching need explicit policy |
| OBS-002 | Informational | Confirmed design behaviour; high | Uploaded media is public before publication and retained after gallery deletion |
| POT-001 | Low if prerequisites hold | Potential; medium | Duplicate negative-price multiselect choices can reduce an order price |
| POT-002 | Undetermined | Unable to verify deployment | Legacy Supabase schema/auth surface may still exist independently |

Known vulnerable dependencies are also itemised in [DEPENDENCY_RISK_INVENTORY.md](DEPENDENCY_RISK_INVENTORY.md). Zod parser exposure is counted once as SEC-013. Development-tool advisories do not imply the same severity for the production restaurant service.

## SEC-001 — Historical committed secrets are still reused locally

**Component and exact location:** Historical `.env.example` at commit `24ced0ae762131b4ed77470e745929fd6ad1319a`, blob `5116f9aa6a8a4bb3afe7bc29700493db48806858`: line 1 `MONGODB_URI`, line 3 `SESSION_SECRET`, line 5 `ADMIN_PASSCODE`. The same blob appears in subsequent commits. Older `.env` and `.env.example` blobs also contain credential material. See [secret-validation.json](agent-supply/secret-validation.json) and [secret-review.json](agent-supply/secret-review.json).

**Root cause and impact:** Example/environment files containing credentials entered published history. Exact-value comparison in memory confirmed these three historical values still match the ignored current `.env.local`. A valid database credential could expose application records; a reused signing secret could enable forged privileged sessions and order capabilities; a valid administrator passcode grants operational access. This audit did not use any discovered credential, query a real database or verify deployed reuse, so actual external compromise is unverified.

**Preconditions:** Access to the repository history and reuse of those values by the targeted environment. Repository visibility and deployed credential validity are unknown.

**Evidence and safe reproduction:** The redacted scanner/history evidence names only paths, lines, commits and boolean matches. Re-run `agent-supply/scan_secrets.py`; compare historical assignments against configured values in memory and emit only booleans. Never use `git show` or `cat` to print the affected files. Gitleaks independently detected committed secret material, but supplemental scanning was required to find all affected names.

**Remediation:** Owner must rotate/revoke the affected database credential, administrator passcode and signing secret in every environment where reused, assess logs and repository access, and update deployment Secrets. Determine whether additional historical credentials remain active. Signing-key rotation invalidates existing operator sessions and order links; plan recovery for legitimate guests. Keep templates placeholder-only and add CI secret scanning. Do not rewrite Lovable-connected published history; removing values from the current file does not revoke them. No rotation was performed during this audit.

**Regression:** Tracked files and all available history contain no new credential material; deployment secrets differ from exposed values; old synthetic signing credentials cannot authenticate; private environment files remain ignored and deployment-only secrets never reach client bundles.

## SEC-002 — Single-order capability expands to guest-wide access

**Component and exact locations:** [orders.functions.ts](../src/lib/orders.functions.ts):399, 405, 409, 431, 443, 449, 462, 490; [cart.functions.ts](../src/lib/cart.functions.ts):39, 40, 56, 83; [use-guest.ts](../src/hooks/use-guest.ts):7.

**Root cause:** The device UUID supplied by a caller is treated as authority for history, rewards and carts. `getOrder` returns the whole order, including `guest_id`. `getGuestRewards` accepts that ID without authenticated ownership, returns full order fields because its runtime projection is only `{ _id: 0 }`, and mints access tokens for other orders. A TypeScript `Pick` does not remove fields at runtime.

**Impact and preconditions:** A person with one legitimately shared tracking/receipt link can read other order history, email, phone/address and payment/checkout fields, obtain additional order tokens, and read/overwrite the guest cart. Knowing a disclosed guest UUID is sufficient; UUID brute forcing was neither needed nor tested. Checkout/rewards also accept the same unproven identity. No administrator escalation or arbitrary database query is claimed.

**Evidence:** `Guest ownership and order capabilities` in the current 41-test suite; independent guest tests in `agent-backend/additional-boundaries.test.ts`; production-compiled checks `order response discloses guest identifier`, `built anonymous guest endpoint returns other private orders and access tokens`, and `built anonymous cart write accepts another guest identifier` in [session-built-handler-results.json](evidence/session-built-handler-results.json).

**Safe reproduction:** Seed two synthetic orders for guest A; read the first with its valid single-order token, extract its guest ID, request rewards/history with that ID, then read the second using the returned capability and overwrite the synthetic cart. The test harness uses process-local Mongo substitutes and no external access.

**Remediation:** Issue a server-verifiable guest session and derive the guest identity from it for cart, history, redemption and checkout. Keep share links separately scoped to one order. Return explicit DTOs that omit guest identifiers and internal payment/request fields from shared views. This preserves account-free checkout.

**Regression and migration risk:** Test guest A/B isolation across every read and mutation, including reused checkout requests; a shared token must not grant history/cart/redemption authority. Migrate existing local carts and receipt ownership to a verified guest identity without exposing old UUIDs as credentials.

## SEC-003 — Published demo checkout bypasses payment

**Component and exact locations:** [orders.functions.ts](../src/lib/orders.functions.ts):110, 311, 324, 325, 397; [staff.functions.ts](../src/lib/staff.functions.ts):77, 139, 140; [admin.functions.ts](../src/lib/admin.functions.ts):1285.

**Root cause:** The legacy `placeOrder` server function accepts a four-digit display card suffix, writes `payment_method: "Demo card"`, `payment_status: "not_charged"` and no provider, and immediately credits rewards. Kitchen accepts `not_charged` records; fulfillment guards require paid status only when a provider field exists.

**Impact and preconditions:** An anonymous caller can create an unpaid order that appears in normal kitchen fulfillment and earns spendable rewards. A valid catalog/store and synthetic guest input are sufficient. The current screen does not call this path, but the production resolver includes `placeOrder_createServerFn_handler`, so frontend disuse does not remove the endpoint.

**Evidence and safe reproduction:** The isolated production build includes all 44 server functions; [session-built-function-inventory.json](evidence/session-built-function-inventory.json) records the resolver entry. Submit a valid synthetic pickup order through its compiled POST RPC, then inspect the synthetic record/rewards and kitchen board. Both `Legacy demo checkout behavior` and the compiled `production compiled legacy checkout creates uncharged reward-bearing order` / `built kitchen board accepts unpaid legacy order for fulfillment` checks succeeded. No provider request or real payment occurred.

**Remediation:** Remove the obsolete production-callable demo path, or constrain any test-only replacement so production builds cannot publish it. Normal fulfillment and earned rewards must require a positively verified paid state. Explicitly handle legitimate historical/manual exceptions through privileged, auditable workflows.

**Regression and risk:** Assert the compiled resolver has no public demo endpoint; unpaid/no-provider records cannot enter normal fulfillment or earn points. Review legacy unpaid records before tightening guards so legitimate operations are not silently stranded.

## SEC-004 — Transaction ID alone grants order access

**Component and exact locations:** [api.payments.verify.ts](../src/routes/api.payments.verify.ts):29, 31, 54, 57; [payments.server.ts](../src/lib/payments.server.ts):1106, 1124, 1155, 1160; [orders.functions.ts](../src/lib/orders.functions.ts):449, 490.

**Root cause:** A merchant-owned numeric provider transaction identifies a payment, but the callback treats it as ownership proof. `tx_ref` and `order_id` are optional and there is no signed checkout continuation before the callback returns a token-bearing redirect.

**Impact and preconditions:** An attacker who knows or discovers a merchant transaction ID can read the matching order's private details and then exploit SEC-002. Sequential identifiers or practical guessing success were not established. Provider verification still validates the payment; this is not a demonstrated forged-payment acceptance issue.

**Evidence and reproduction:** `issues a private order capability from a numeric transaction ID alone` in `agent-payments/payments-boundaries.test.ts` mocks one valid merchant transaction, calls `GET /api/payments/verify?transaction_id=90001`, and verifies the 303 capability can read synthetic email/phone without a session. Wrong supplied order/reference values fail, demonstrating omission is the problem.

**Remediation:** Bind browser continuation to a high-entropy, expiring, server-issued proof of initiating guest, order and attempt. Settle authentic provider payments independently of granting access to the requesting browser. Require the expected attempt binding plus this proof, and throttle verification. Merely making order ID mandatory is insufficient.

**Regression and risk:** Missing/wrong/expired continuation never returns a private capability, even for a genuine known merchant transaction. Legitimate hosted-checkout redirects, lost browser cookies and webhook settlement must retain safe recovery paths.

## SEC-005 — Rewards can be spent repeatedly through pending checkouts

**Component and exact locations:** [payments.server.ts](../src/lib/payments.server.ts):706, 723, 727, 728, 781, 799, 1045, 1051.

**Root cause:** Each pending order prices its redemption using the current guest balance; initialization does not reserve/debit the points. Settlement uses `Math.max(0, currentPoints - points_redeemed)` instead of enforcing an available/reserved balance, so a shortfall does not invalidate the already-discounted order.

**Impact and preconditions:** A guest with points can prepare multiple different request IDs against one balance and pay each discounted total. This is sequentially reproducible and does not require a database race. SEC-002 also permits use of a disclosed victim guest identity. The attacker still pays the discounted provider amount; no arbitrary amount override was accepted.

**Evidence and reproduction:** `demonstrates two pending checkouts redeem the same reward balance` in `tests/backend-boundaries.test.ts`: 1,000 initial points, two orders each redeem 1,000, both mock verified transactions settle paid, total redemption 2,000. The test exercises actual application pricing/settlement against synthetic records.

**Remediation:** Transactionally reserve points during pending order creation under verified guest authority, with idempotent reservation ownership, expiration/release and final settlement. Do not rely on clamping a negative balance. Define late-success/retry handling alongside payment attempts. Model changes must go through Lovable.

**Regression and risk:** Two pending orders cannot reserve more than the balance; concurrent reservations, cancellation, expiry and verification retries conserve points exactly. Review existing pending orders and user-facing expiry before migration.

## SEC-006 — Promotion usage limits are not reserved

**Component and exact locations:** [payments.server.ts](../src/lib/payments.server.ts):430, 433, 713, 717, 720, 729, 780, 799, 1059, 1062. Compare the separate legacy atomic promotion guard in [orders.functions.ts](../src/lib/orders.functions.ts):266.

**Root cause:** Flutterwave checkout reads usage before creating pending discounted orders, but does not reserve a usage slot. Paid settlement increments usage without checking the configured limit.

**Impact and preconditions:** Multiple pending orders can all receive a one-use promotion and settle successfully. At least an active limited promotion is required. Financial magnitude depends on its value; no live coupons were consumed.

**Evidence and reproduction:** `demonstrates a one-use coupon is applied to two paid checkouts`: synthetic `usage_limit: 1`, two guests prepare discounted pending orders, both mock payments settle, `usage_count` reaches 2.

**Remediation:** Reserve promotion capacity atomically with the pending order, release exactly once on expiration/cancellation, consume exactly once on settlement, and define late-success policy. Use the same commerce invariants across all checkout paths.

**Regression and risk:** Concurrent/sequential pending orders cannot exceed capacity; same request retries do not consume twice; released reservations become usable. Migration must reconcile existing pending discounts rather than rejecting a valid already-paid customer without an explicit recovery workflow.

## SEC-007 — Privileged login has no application attempt limit

**Component and exact locations:** [staff.functions.ts](../src/lib/staff.functions.ts):47, 50, 54; [admin.functions.ts](../src/lib/admin.functions.ts):426, 437.

**Root cause:** Wrong passcodes cause a generic immediate failure, with no persistent throttle/backoff or failure event. The staff configuration accepts any nonempty secret. Administrator input requires a configured secret of at least 16 characters, but runtime distinction from staff and strong staff entropy are not enforced.

**Impact and preconditions:** Weak configured staff codes can be guessed for global kitchen/customer access and state changes. Production passcode entropy and edge throttling are unknown; this is rated Medium generally, with High impact if a short code is deployed. No real account was attacked or locked.

**Evidence and reproduction:** Current tests accept twenty incorrect attempts in each role without throttling and then accept a synthetic four-digit staff code. Timing-safe digest comparison and generic errors are positive controls, but neither limits guessing.

**Remediation:** Add persistent limits across instances, tied to role/operator and trusted network signals; enforce strong distinct operator secrets at startup; log redacted failure events. Prefer individually revocable operator accounts with MFA as a follow-on change. Do not impose customer signup.

**Regression and risk:** Conservative local attempts hit the configured threshold; shared serverless instances enforce one quota; spoofed untrusted forwarding headers cannot reset limits; valid operators recover without permanent denial.

## SEC-008 — Copied privileged sessions survive logout/credential rotation

**Component and exact locations:** [admin.functions.ts](../src/lib/admin.functions.ts):33, 51, 56, 439; [staff.functions.ts](../src/lib/staff.functions.ts):11, 37, 59. Actual library semantics are recorded in [BACKEND_REVIEW.md](agent-backend/BACKEND_REVIEW.md).

**Root cause:** Sealed client cookies contain role booleans without server-side revocation/version checks. Logout clears only the caller's cookie, and passcodes are checked only at login. The default h3 session header also accepts a valid staff seal.

**Impact and preconditions:** A stolen/copied valid administrator seal remains usable after logout and passcode change for its remaining eight-hour lifetime; staff seals last twelve hours. Cookie theft was not demonstrated. Cryptographic tampering and expiry were correctly rejected. The header does not bypass cryptography.

**Evidence and reproduction:** Independent tests use actual installed h3 sealing/unsealing, retain an in-memory synthetic cookie, call lock/logout, change the synthetic passcode, replay the cookie and observe authenticated state. No cookie/token was written to the evidence.

**Remediation:** Introduce revocable opaque sessions or a verified session ID/version lookup; invalidate at logout, credential change and explicit operator revocation. Disable unused header transport if appropriate. Global signing-key rotation revokes sessions but should not be the only routine revocation mechanism.

**Regression and risk:** Copied seals fail after logout/revocation/change; expiry/tamper and role separation remain enforced. Coordinate cookie/session migration and operator recovery across deployment instances.

## SEC-009 — Unsigned GET status callback mutates state

**Component and exact locations:** [api.payments.verify.ts](../src/routes/api.payments.verify.ts):19, 36, 46; [payments.server.ts](../src/lib/payments.server.ts):921, 952, 971.

**Root cause:** With no transaction ID, caller-supplied status and a matching reference update the unpaid order without provider verification or guest authorization. GET has durable effects.

**Impact and preconditions:** A caller knowing the random pending reference can mark an order cancelled/failed or change pending state, affecting tracking/retry behaviour. Random-reference guessing is not claimed. Already-paid records are protected and no refund is initiated.

**Evidence and reproduction:** Current baseline and payment-specific tests invoke the unsigned synthetic cancellation callback and observe changed state with zero provider/session calls; repeat on paid records and observe no downgrade.

**Remediation:** Treat redirect status as display-only until authentic verification. Use a guest-authorized POST for intentional abandonment and keep that state distinct from verified provider failure. Retain late-payment recovery.

**Regression and risk:** An unsigned GET with a valid known reference cannot persist payment state; authentic provider failures still update correctly; paid orders cannot downgrade.

## SEC-010 — Payment attempt replacement loses reconciliation

**Component and exact locations:** [payments.server.ts](../src/lib/payments.server.ts):519, 584, 597, 898, 992, 1017.

**Root cause:** Expired/retried checkout overwrites the sole reference, leaving no record by which a late successful previous attempt can find its order. Settlement reads current order by ID and updates non-paid state without rechecking the attempt reference validated outside the transaction.

**Impact and preconditions:** A retry/late payment or verification/retry interleaving can produce a charged-but-pending order or inconsistent reference/transaction association. Tests retain the original price; buying a differently priced order with one payment was not demonstrated.

**Evidence and reproduction:** Baseline `demonstrates checkout retry loses the reference needed for a delayed successful payment`; payment-specific `does not recheck an attempt reference that changes between verification and settlement`. These use a controlled application retry/interleaving, not attacker writes to a real database. MongoDB isolation was not measured.

**Remediation:** Persist append-only attempts bound to immutable order/amount/currency, uniquely resolve every verified reference, and transactionally check the attempt identity/state at settlement. Define duplicate actual charges and recovery/refund escalation. Lovable must make schema changes.

**Regression and risk:** Late old-attempt success is reconciled; concurrent retry/verification preserve attribution; two paid attempts do not double fulfill or silently lose money. Migrate historical references and retain provider reconciliation records.

## SEC-011 — Temporarily pending verification completes a success event

**Component and exact locations:** [api.webhooks.flutterwave.ts](../src/routes/api.webhooks.flutterwave.ts):87, 98; [payments.server.ts](../src/lib/payments.server.ts):1145, 1194, 1227.

**Root cause:** Any non-throwing verification result completes the incoming webhook event, including `pending`. An identical retry then stops at the processed-event check.

**Impact and preconditions:** If the provider sends a successful event before its verification API reflects success, a paid customer can remain pending/unfulfilled. The same later retry does not reconcile. A later valid browser callback or different event could recover; no scheduled reconciliation exists in this repository. Provider inconsistency frequency is unverified.

**Evidence and reproduction:** Payment test `permanently acknowledges a successful event while the verification API still reports pending`: first hash-authenticated synthetic event receives pending verification and is marked processed; provider stub changes to success, but identical replay causes no verification and order remains pending.

**Remediation:** Distinguish pending/retryable verification from terminal business completion. Persist bounded retries/reconciliation work and complete only the intended verified state; acknowledge only after recovery work is durable.

**Regression and risk:** Pending verification followed by success eventually settles once; retries cannot suppress eventual settlement or duplicate points. Preserve provider retry semantics and cover callbacks lost in transit.

## SEC-012 — Quotas can be bypassed by identity rotation/concurrency

**Component and exact locations:** [admin.functions.ts](../src/lib/admin.functions.ts):541, 548, 554, 577, 635, 666, 678, 684, 695.

**Root cause:** Comment/catering quotas use caller-selected `guest_id` and a non-atomic count then insertion. Likes lack a request throttle.

**Impact and preconditions:** Persistent comment/catering spam, manipulated likes and administrative workload/storage growth. This audit used at most small synthetic batches and did not attempt resource exhaustion.

**Evidence and reproduction:** Baseline rotating-UUID comment quota test; independent tests concurrently create six comments against a five/hour quota and four inquiries against a three/hour quota, all accepted.

**Remediation:** Bind identity to a verified guest session, atomically reserve quotas, and add layered persistent per-network/service limits using trusted proxy configuration. Provide moderation and abuse visibility while allowing ordinary shared-network guests.

**Regression and risk:** Same-identity concurrent batches admit no more than the quota; a body UUID cannot reset identity; global/network bounds apply to synthetic repeated creation; valid shared-network users retain usable access.

## SEC-013 — Validation work lacks early structural/request budgets

**Component and exact locations:** [cart.functions.ts](../src/lib/cart.functions.ts):6, 32; [orders.functions.ts](../src/lib/orders.functions.ts):67, 72; [api.payments.initialize.ts](../src/routes/api.payments.initialize.ts):54, 55, 60, 61; [api.webhooks.flutterwave.ts](../src/routes/api.webhooks.flutterwave.ts):49, 50, 56, 57; installed `zod@3.25.76` in `package-lock.json`. The exact input-limit implementation and advisory are detailed in the dependency inventory and payment assessment.

**Root cause:** `z.record` selection keys are unbounded; array `.max()` is not an early parsing budget in the installed Zod version. Server-function POST payloads lack an application-level byte budget. Explicit payment/webhook routes check declared length, then buffer the complete body before testing actual length; that test is on JavaScript characters rather than streamed byte consumption.

**Impact and preconditions:** Anonymous inputs can cause more parser/allocation/body buffering work than intended. Known Zod advisory `GHSA-mrhx-c7xc-m3w5` covers this mechanism. Full denial of service and deployment-specific limits were not tested, so application severity is Medium despite a higher advisory rating.

**Evidence and reproduction:** Bounded proof in [zod-bounded-proof.json](agent-supply/zod-bounded-proof.json) visits 1,000 children for `.max(2)` and creates 1,001 issues; selection schemas accept 1,000/1,500 distinct keys. A 256 KiB synthetic stream is fully consumed before a 413 response despite the nominal 128,000 limit. No stress test was performed.

**Remediation:** Enforce streamed byte limits before parsing, global POST/form budgets at the serving boundary, maximum object keys/depth and bounded early array checks. Migrate to a compatible patched parser after reviewing Zod 3→4 API changes; do not blindly replace the package. Apply limits consistently to generated server functions and explicit HTTP routes.

**Regression and risk:** Chunked/multibyte/undeclared-size bodies abort at the budget; nested/key-heavy inputs fail before database access or extensive child parsing; ordinary cart and upload sizes continue to work.

## SEC-014 — Shared capabilities persist indefinitely

**Component and exact locations:** [order-access.server.ts](../src/lib/order-access.server.ts):11, 17, 21.

**Root cause:** Deterministic HMAC binds only order and guest IDs, with no expiration, purpose/version or revocation nonce.

**Impact and preconditions:** A retained/leaked valid link remains usable while the record and signing secret exist. Long-lived owner receipts may be intentional; indefinite third-party sharing must be explicitly chosen. No token forgery was found. SEC-002 rates the separate scope expansion.

**Evidence and reproduction:** A synthetic capability verifies after advancing the clock one year; ID/guest substitutions and malformed tokens fail.

**Remediation:** Preserve historical receipts through verified owner access; give third-party sharing explicit expiry/revocation and purpose binding, plus owner refresh. Do not silently remove access to legitimate receipts.

**Regression and risk:** Expired/revoked shares fail; owner history remains accessible; signing-key rotation and link recovery are tested.

## SEC-015 — Stale webhook lease reclamation is non-atomic

**Component and exact locations:** [payments.server.ts](../src/lib/payments.server.ts):1190, 1201, 1209.

**Root cause:** Read of stale/failed status followed by an unconditional update of provider/event ID allows two claimants.

**Impact and preconditions:** Concurrent stale-event workers duplicate provider work and race event/log states. Paid settlement still guards exactly-once effects; duplicate financial credit was not demonstrated.

**Evidence and reproduction:** Seed one ten-minute-old synthetic processing event, concurrently claim twice, observe both return `claimed` and attempts rises from 1 to 3.

**Remediation:** Compare-and-set on status/lease timestamp, use lease IDs, and allow only the current lease holder to complete/fail. Use persistent recovery and bounded retries.

**Regression and risk:** Exactly one stale-event claimant; expired/crashed leases recover; normal webhook retries and settlement idempotency remain functional.

## SEC-016 — Security event visibility and attribution are incomplete

**Component and exact locations:** [admin.functions.ts](../src/lib/admin.functions.ts):408, 412, 414, 426; [staff.functions.ts](../src/lib/staff.functions.ts):47, 165; [mongodb.server.ts](../src/lib/mongodb.server.ts):104; [error-capture.ts](../src/lib/error-capture.ts):18, 28, 29, 40, 42, 56, 72.

**Root cause:** Shared role passcodes cannot identify individual operators; action logs use `admin_id: null`. No dedicated failure/login/logout/revocation/denied-access event pipeline is implemented. Error capture expands full causes/objects without a global sensitive-field redactor. Log storage access, integrity, retention and alerts are deployment unknowns.

**Impact and preconditions:** Operators cannot reliably attribute suspicious changes or investigate authentication abuse from application records alone. Error redaction risk is a hardening observation; actual live secret leakage in logs was not demonstrated.

**Evidence and reproduction:** Full login/action/error source review, generic wrong-credential responses and null actor IDs in synthetic action records. No real monitoring systems were queried or notifications sent.

**Remediation:** Individually attributable privileged identities, structured redacted security events with request/session correlation, durable protected storage and alerting. Separate internal details from public errors. Audit mutations and event recording should fail/recover coherently.

**Regression and risk:** Synthetic login failures, denied access, credential/session changes and privileged writes emit useful events; password/token/authorization/connection-string fields and CRLF payloads are redacted; alert/retention controls are verified in staging. Avoid recording guest addresses/contact bodies unnecessarily.

## Observations, potential findings and false positives

**OBS-001 — HTTP response policy.** Compiled successful public/private server-function responses had JSON content type and serialization marker, but no explicit `Cache-Control`, CSP, frame policy, HSTS, `Referrer-Policy` or `nosniff`. Explicit payment JSON uses `no-store`; media uses `nosniff` and deliberate immutable caching. Source `src/start.ts:27`, `src/server.ts:23` and `vite.config.ts` do not establish a global policy. Deployed CDN/browser cache/TLS headers were not accessed. Do not describe missing headers as proven cache leakage or clickjacking. Add private-response `no-store` and a compatible CSP/frame/referrer/security-header policy at the actual serving boundary, then test deployed responses. CSP must account for the existing inline SSR/framework scripts; preserve hosted checkout and printable receipts.

**OBS-002 — Public media retention.** `src/routes/api.media.$id.ts:18`, `:26` and `:35` serve any matching `admin-image` with `public, max-age=31536000, immutable`, independent of publication/ownership. `src/lib/admin.functions.ts:1250` deletes a gallery record/feedback but not GridFS bytes. Synthetic media tests confirm public access before gallery publication. There is no implemented private-document/customer-upload feature, so private-file IDOR is not claimed. Decide whether draft images are confidential and what deletion means; implement private staging access or explicit public retention/revocation accordingly.

**POT-001 — Negative option duplicates.** `src/lib/admin.functions.ts:107` permits negative option-price adjustments; `src/lib/pricing.ts:183` sums repeated multiselect IDs. Synthetic configuration demonstrates a -500-cent choice applied repeatedly, but no corresponding active negative multiselect was found in bundled catalog/seed sources, and the live catalog was not inspected. Treat as conditional. Reject duplicate selections and define bounded legitimate negative adjustments; regression should preserve single-choice sizing changes.

**POT-002 — Legacy Supabase exposure.** `drizzle/migrations/0000_grill_swill_core.sql:39` defines first-admin bootstrap functionality and Supabase auth tables/policies; migration `0001_guest_checkout_no_accounts.sql` removes some grants/flows. Active application paths use MongoDB and custom sessions. Whether the old hosted project/schema/auth API remains accessible is unverified. Owner should review connector/project lifecycle, grants and bootstrap state through Lovable/read-only infrastructure access. Do not hand-edit managed migrations or test the external Supabase project without authorization.

**Separated false positives:** No reachable user-fed `eval`, command execution or SQL interpolation was found. The chart helper's `dangerouslySetInnerHTML` (`src/components/ui/chart.tsx:73`) emits style configuration and has no discovered user-controlled consumer; it is not confirmed XSS. Zod UUID/scalar validation prevents tested Mongo operator objects from reaching filters. Cart display prices do not override authoritative payment totals. h3 session headers require a valid seal; they are not a standalone bypass. The dormant Supabase auth-attacher is not an active missing-auth control. Metadata omission alone did not bypass exact transaction/reference/amount checks. Fresh webhook duplicate detection and paid-transition replay guards passed. Gitleaks test-fixture/random BSON detections are not live credential exposures; classifications are in the supply/configuration evidence.

