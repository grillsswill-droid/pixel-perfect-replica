# Payments, HTTP APIs, storage and client boundary assessment

Assessment date: 2026-11-25. Scope is repository source and process-local synthetic tests. No production database, payment provider, third-party API, or hosted app was contacted. Application code, generated files, schemas, manifests and lockfiles were left unchanged.

## Activated capability and evidence

Read and applied `/Users/john/.agents/skills/api-design-principles/SKILL.md` to assess HTTP method safety, explicit validation, pagination/rate limiting and documentation coverage. Authentication integration here is guest capabilities plus staff/admin encrypted sessions; Better Auth and Stripe guidance was not applied because those services are not used by this implementation.

Reviewed the existing `security-audit/vitest.security.config.ts`, `security-audit/scripts/no-network.cjs`, and entire `security-audit/tests/memory-mongo.ts` before reuse. The own config disables env-file loading and preloads the network-denial guard. Tests use test-only environment values, local records, fake sessions, a fake provider and in-memory GridFS streams. The in-memory database is a limited semantic substitute, not proof of MongoDB transaction concurrency behavior.

Executed `./node_modules/.bin/vitest run --config security-audit/agent-payments/vitest.config.ts --reporter=json --outputFile=security-audit/agent-payments/test-results.json` three times while extending validation. Latest run: **46 tests passed, zero failed or skipped** (32 payments/webhooks, 14 media/upload). JSON evidence is `test-results.json`. A passing exploit-demonstration test confirms the current defect, not successful remediation. Vitest comes from the existing local installation; no dependencies were installed.

## Explicit HTTP endpoint inventory

| Method and path | Access control / accepted input | Effects and response | Limits / error controls |
|---|---|---|---|
| `POST /api/payments/initialize` | Public guest checkout; same-origin check when Origin is supplied; no guest ownership proof or authenticated session. JSON strict top-level schema accepts guest/request UUIDs, bounded lines, delivery/pickup, store UUID, address, promo, reward redemption, email/name/phone, exact USD amount. | Reads menu/store/settings/promotions/rewards, transaction inserts pending order/counter/admin log, calls fixed Flutterwave `/v3/payments`, stores a hosted link. Returns checkout URL, order ID/number/reference, reused status, with 201 or 200. | 128,000 Content-Length and post-buffer text-character check; 40 lines, 1–20 quantities; no application rate limiter. 400 validation, 403 origin, 413 size, 415 MIME, 409 business rule, 503 config, 502 provider, generic 500. JSON `no-store`. |
| `GET /api/payments/verify` | Public redirect callback. Numeric `transaction_id`; optional `tx_ref`, `order_id`, `status`; no guest-session or checkout-continuation proof. | Without transaction ID, caller-controlled status can change matching pending order. With ID, fixed provider verification followed by transaction settlement; returns 303 to checkout or token-bearing order URL. | Numeric ID regex but no length/attempt bound; no application rate limiter. Error response is generic redirect; internal errors logged. Redirect responses lack explicit no-store. |
| `POST /api/webhooks/flutterwave` | Provider static `verif-hash` checked using timing-safe equal-length comparison before reading body/DB. JSON event, ID, status, optional ref; passthrough provider payload fields. | Ignores unrelated events; claims payment event by event+transaction+status; re-fetches actual provider transaction; verifies and settles matching order; records completed/failed event state. | 128,000 header/post-buffer character limit; no request throttle. Invalid auth 401, missing config 503, malformed payload 400, provider failure 502, generic 500. JSON `no-store`. |
| `GET /api/media/:id` | Public. 24-hex ObjectId, bucket `admin_media`, metadata kind `admin-image`, allowlisted stored image MIME. No publication or ownership check. | Streams GridFS bytes. | Content-Length, allowlisted JPEG/PNG/WebP, `nosniff`, public one-year immutable cache; invalid/missing/wrong type/kind returns 404. No range handling/rate limiter in handler. |

TanStack server functions are separately inventoried by the backend reviewer. `uploadAdminImage` is a POST server function that enforces `requireAdmin` before decoding/storage; bounds data URL at 3 million characters and decoded bytes at 2 million; checks claimed MIME against JPEG/PNG/WebP signatures; uses server-generated GridFS ObjectId/filename; logs only image ID/size.

## Validated finding PM-001: Payment transaction ID exchanges into a private order token

**Severity:** High. **Classification:** Confirmed vulnerability in source and synthetic request handler. **Confidence:** High.

**Components / lines:** `src/routes/api.payments.verify.ts:29` (handler), `:31`–`:54` (optional binding fields), `:57`–`:60` (private capability redirect); `src/lib/payments.server.ts:1106`–`:1129` (provider transaction resolves order), `:1155`–`:1161` (capability minted); `src/lib/orders.functions.ts:449`–`:497` (full order returned to capability holder).

**Root cause:** A provider transaction identifies payment, but is treated as proof that the caller owns the order. `tx_ref` and `order_id` are optional, and the callback does not check a signed/unguessable checkout continuation or device session before issuing read access.

**Preconditions:** Attacker knows or discovers a numeric transaction ID belonging to this merchant and a stored order. The test does not establish provider IDs are sequential or practical guessing rates; numeric-only validation and no route throttle increase concern but do not independently prove enumeration feasibility. No payment provider credential is needed by the attacker; the server performs the verification with its own secret.

**Impact:** Private order/customer email, phone and address disclosure. Returned order includes guest ID and internal payment fields; the backend reviewer confirmed that a guest ID also unlocks other order/cart endpoints, amplifying disclosure. Payment settlement remains provider verified; this is not evidence of forged payment acceptance.

**Safe reproduction:** Seed one synthetic paid order and mock GET `/v3/transactions/90001/verify` with its valid synthetic transaction. Invoke callback with only `?transaction_id=90001`. Assert 303 order URL contains a valid token and `getOrder` returns synthetic email/phone without a session call. Test `issues a private order capability from a numeric transaction ID alone` demonstrates this. Negative controls confirm supplied wrong ref/order are rejected, showing omission is the weakness.

**Remediation:** Require a server-generated high-entropy, expiring checkout continuation bound to the order, attempt and initiating guest proof before issuing the browser token. Provider verification/webhook settlement can proceed without granting caller access. Enforce `tx_ref` and order binding alongside the continuation, rate-limit verification, and retain guest checkout. Do not rely solely on a browser-supplied guest UUID or on requiring a UUID order ID.

**Regression:** Missing/wrong/expired continuation returns no private capability even for a verified merchant transaction; an unrelated guest cannot exchange a known transaction ID; legitimate provider redirect and webhook settlement still work. Review link-sharing scope separately.

## Validated finding PM-002: Unsigned GET callbacks change pending payment/order state

**Severity:** Medium. **Classification:** Confirmed vulnerability. **Confidence:** High.

**Components / lines:** `src/routes/api.payments.verify.ts:19`–`:23`, `:36`–`:46`; `src/lib/payments.server.ts:952`–`:972`, `:921`–`:931`.

**Root cause:** When transaction ID is absent, status and transaction reference supplied by any caller are persisted without provider verification or a signed continuation. GET is state changing.

**Preconditions:** Knowledge of the random transaction reference for an unpaid order (optional order ID is not required). References are returned by initialization and appear in order data; this test does not show random-reference guessing.

**Impact:** Target pending payment and fulfillment can be marked cancelled/failed or moved pending without authentic provider evidence, disrupting tracking or causing retry state changes. Paid orders are explicitly protected; actual payment is not refunded by this operation, and later valid settlement can restore the order if its attempt ref still exists.

**Safe reproduction:** Seed synthetic pending order, invoke `GET ?tx_ref=<synthetic-ref>&status=cancelled`, and assert payment/order status becomes cancelled with zero provider or session calls. Repeat on a paid order and assert it stays paid. Test `allows unsigned GET callback state changes but protects already paid orders` covers both.

**Remediation:** Treat callback status as display-only until an authenticated provider response is available. If a user intentionally abandons checkout, use an authorized POST bound to the guest/attempt and distinguish abandonment from provider failure. Keep late-settlement handling and audited transitions.

**Regression:** An unsigned GET with a known ref cannot persist status; valid verified failed/cancelled provider transactions still persist expected state; paid state never downgrades.

## Validated finding PM-003: Pending provider verification permanently completes the success webhook

**Severity:** Medium. **Classification:** Confirmed data-integrity/security reliability defect under a controlled provider-consistency condition. **Confidence:** High for implementation, unknown frequency at provider.

**Components / lines:** `src/routes/api.webhooks.flutterwave.ts:87`–`:98`; `src/lib/payments.server.ts:1145`–`:1147`, `:1194`, `:1225`–`:1233`.

**Root cause:** Every non-throwing verification outcome marks the incoming webhook event processed. When incoming `charge.completed` status is successful but verification API still says pending, the handler acknowledges 200 and permanently suppresses identical future events.

**Preconditions:** Provider event and verification API disagree transiently, and successful settlement is later retried with the same event/transaction/status. No attacker control of provider signatures is assumed.

**Impact:** Customer may pay while the order stays pending and unfulfilled; event retries do not reconcile it. A later successful browser callback or distinct event can recover, but no scheduled reconciliation job is present.

**Safe reproduction:** Mock signed successful event with first verification pending. Assert event status processed and HTTP 200/verified false. Change mock provider to success, replay exact event, assert duplicate 200 with no second provider request and order remains pending. Test `permanently acknowledges a successful event while the verification API still reports pending`.

**Remediation:** Model pending/retryable verification separately from completed business effects. Acknowledge only durable retry/reconciliation work, retain delayed retry scheduling, and complete the event only when its intended terminal state is verified. Reconciliation should also cover callbacks lost in transit.

**Regression:** A successful event with temporarily pending verification eventually settles exactly once; repeated delivery cannot block eventual settlement or duplicate rewards.

## Validated finding PM-004: Payment retries discard previous attempt identifiers and settlement lacks attempt recheck

**Severity:** Medium. **Classification:** Confirmed integrity defect in source / mocks; no live financial impact measured. **Confidence:** High.

**Components / lines:** `src/lib/payments.server.ts:519`–`:537`, `:584`–`:606`, `:898`–`:907`, `:991`–`:1023`.

**Root cause:** Checkout expiration/retry overwrites the only `payment_reference`. Late payment on a previous ref cannot resolve its order. A reference that changes after initial verification but before transactional settlement is not checked again; current order is read by ID and updated by non-paid state only.

**Evidence:** Existing reviewed test `demonstrates checkout retry loses the reference needed for a delayed successful payment` in `security-audit/tests/backend-boundaries.test.ts` demonstrates late-ref loss (root is rerunning that suite). Own `does not recheck an attempt reference that changes between verification and settlement` provides controlled interleaving and confirms a new ref is marked paid using the old ref transaction. The test simulates a retry, not arbitrary attacker database writes. MongoDB isolation concurrency was not measured.

**Impact / preconditions:** Expired or retried checkout paid late can charge without fulfillment; in-flight verification/retry can record inconsistent attempt/transaction ownership. Existing exactly-once paid transition mitigates duplicate reward effects but does not preserve provider attempt reconciliation. Cannot conclude that a single payment can buy a differently priced order: retry retains the original order amounts.

**Remediation:** Maintain append-only payment-attempt records, each with unique reference, original order/amount/currency and terminal state; resolve every verified attempt to its order. Transactionally recheck attempt identity/state before settlement, with explicit policies for duplicate successful attempts and merchant reconciliation/refunds. Schema changes must go through Lovable per project instructions.

**Regression:** Late success on old attempt is reconciled; concurrent retry and verification preserve valid attempt ownership; two actual paid attempts do not double fulfill or silently lose a charge.

## Validated observation PM-005: Stale webhook claims are not atomic

**Severity:** Low. **Classification:** Confirmed concurrency weakness; duplicate financial effects were not demonstrated. **Confidence:** High for claim behavior.

**Components / lines:** `src/lib/payments.server.ts:1190`–`:1209`.

**Root cause:** Stale/failed event reclamation uses a read followed by an unconditional update matching only provider/event ID. Two contenders can both observe old state and return claimed.

**Safe reproduction:** Seed a ten-minute-old processing event, call `claimFlutterwaveWebhookEvent` concurrently twice, and assert both return claimed and attempts grows from 1 to 3. Test `permits two concurrent stale processing event claimants`.

**Impact:** Duplicate provider requests and racing event status/log updates. Atomic paid settlement and unique transaction protections are separate defenses, so this is not evidence of double financial credit.

**Remediation / regression:** Claim using conditional `findOneAndUpdate`/compare-and-set on status and last lease timestamp, issue worker lease IDs, and complete/fail only with a current lease. A concurrency regression should produce exactly one claimant for a stale event while settlement remains idempotent.

## Confirmed positive controls and separated observations

- All six mismatch cases tested (provider transaction ID, transaction ref, exact amount, currency, normalized email, metadata order ID when present) reject paid settlement. Metadata presence is optional; this is not a proven bypass because exact unique ref remains required. Failed verification never simply accepts webhook-supplied payment amount.
- Outbound payment URLs are fixed to `https://api.flutterwave.com/v3`; transaction IDs are numeric then encoded. Tests reject path injection. Checkout destination is exact HTTPS `checkout.flutterwave.com`, default port, no userinfo, known path prefix, parsed normalized URL. Eight malicious URL variants rejected. No attacker-controlled server URL fetch was found in active code.
- Provider requests have a 25-second timeout. Error bodies shown to clients are generic; provider messages/full errors are logged. Response body buffering and a lack of global log redaction are hardening observations, not demonstrated live credential leakage.
- Unsigned/malformed webhooks fail before database access; wrong-length/wrong-content hashes fail; unrelated event types are ignored before DB. Fresh event insert uniqueness deduplicates processing; already-paid order guards prevent unsigned cancellation downgrade.
- Uploads enforce admin authorization, bounded size, supported MIME/signature, generated names and no filesystem path use. SVG/HTML, malformed base64, MIME mismatches, arbitrary text, oversized decoded images, invalid media IDs, wrong GridFS kind and disallowed MIME rejected in 14 synthetic tests. Browser image decoder/malformed-image security was not fuzzed. Signature checks do not prove complete image decoding.
- All uploaded `admin-image` files are public immediately, even without an active gallery/menu record, and cached publicly for a year. This is an **informational design/retention observation** unless unpublished media is intended to be confidential. Deleting gallery items does not delete GridFS content (`admin.functions.ts:1250`–`:1263`); deletion/retention semantics should be explicitly designed and tested. No private documents/user uploads were found.
- React text renders gallery captions/comments, order notes and contact text as escaped JSX. The sole application `dangerouslySetInnerHTML` is the reusable chart style helper, and repository search found no consumers feeding user data into it. Report this as an unused sink/false-positive XSS candidate, not confirmed stored XSS. Dynamic XSS browser execution was not performed.
- The generated Supabase JWT middleware calls Supabase `getClaims` (rather than trusting a three-part token string), its service-role client stays server only, and preview auth messaging restricts target/reply origins. These modules have no import path from active storefront/server middleware beyond generated mutual references. Missing generated auth-attacher registration is therefore not an active auth bypass. No Supabase provider account/claims test was executed.
- Global CSRF middleware explicitly applies to TanStack server functions (`src/start.ts:23`–`:29`); explicit payment initialize separately checks Origin. Initialization accepts no Origin for non-browser clients, which does not itself show CSRF because browsers cannot send simple `application/json` cross-origin without preflight. Native HTTP framework behavior should be checked by root's local request harness.
- Router creates QueryClient per request (`src/router.tsx:11`–`:23`), mitigating cross-request SSR cache disclosure. Error pages are static and avoid error details (`src/server.ts:23`–`:35`, `:56`–`:61`, `src/routes/__root.tsx:44`–`:55`).
- Frontend stores guest UUID, contact and delivery address in localStorage; tracking tokens are URL query parameters and sent within same-origin links. No strong session tokens are manually stored by active storefront code. Long-lived URL capability/referrer/cache protections and persistent device PII are defense-in-depth concerns; no token was sent to an external service by this test.
- No active OAuth, external AI request, queue/cron worker, mail/notification sender, real Stripe payment path or generalized remote file import exists in inspected source. Unused generated connector helpers and the separately deployed Next/Mongo example were reviewed, not invoked. The example's public DB ping action performs no user-controlled query but lacks throttle and uses its own outdated stack to be assessed by SCA.

## Coverage and execution record

Read all of `src/lib/payments.server.ts` (1266 lines), four explicit API route files, `src/server.ts`, `src/start.ts`, `src/router.tsx`, all generated integrations including preview storage and cron helpers, error utilities, admin upload/schema/media-delete portions, order read/query portions, checkout request/contact-storage portions, gallery output and food image helper, reusable chart sink, guest/cart hooks and the separate Next/Mongo example actions/database entry points. Searched all `src`, `scripts` and demo source for fetch/HTTP calls, raw HTML/JS sinks, browser storage, environment reads, scheduled jobs, credential transport and integration imports.

Commands used: `cat`, `wc -l`, `nl -ba ... | sed -n ...` for bounded source reads; `rg -n` across code for attack sinks/integration reachability; `git status --short`; local binary existence check; the Vitest command above; Python JSON result summaries. Tool versions/environment are recorded in root's inventory. No untrusted executable, provider action, seed script, production build/startup or cloud mutation was used here. Files written only under `security-audit/agent-payments/`.

Gaps: no hosted-instance/header/TLS scan; no provider credential or sandbox transaction validation; no real MongoDB replica set/GridFS concurrency test; no external resource reachability tests; no browser active XSS test; no full image decoder fuzzing; no webhook delivery reliability measurement; no cloud edge rate/header/IAM inspection. These require controlled deployments/provider sandboxes or read-only cloud configuration access and are not inferred as passing.
