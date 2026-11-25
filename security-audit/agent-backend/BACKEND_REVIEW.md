# Backend security review contribution

Assessment date: 2026-11-25. Scope: all lines of `src/lib/mongodb.server.ts`, `order-access.server.ts`, `cart.functions.ts`, `orders.functions.ts`, `staff.functions.ts`, `admin.functions.ts`, `catalog.functions.ts`, `pricing.ts`, and `order-status.ts`; relevant h3/TanStack session implementations; existing isolated harness. This contribution does not attest to production deployment state.

## Skills and tools actually used

- Read and applied `/Users/john/.agents/skills/api-design-principles/SKILL.md`: endpoint methods, server guards, bounded inputs, pagination, resource consumption, and rate limits.
- Read `/Users/john/.agents/skills/better-auth-security-best-practices/SKILL.md` for discovery. Not activated as a Better Auth implementation workflow: the actual backend uses custom TanStack/h3 sessions, not Better Auth. Its framework-specific defaults cannot be attributed to this app.
- Manual source-to-sink review, `rg`, numbered source reads, Python inventory extraction, Node, and installed Vitest.
- Versions observed locally: Node v26.13.0; h3 2.0.8; `@tanstack/react-start` 1.168.60; `@tanstack/start-server-core` 1.169.39; MongoDB driver 7.9.0; Zod 3.25.76; Vitest 4.1.12.

## Executed isolated testing

Final command:

```sh
node node_modules/vitest/vitest.mjs run --config security-audit/agent-backend/vitest.config.ts --reporter=json --outputFile=security-audit/agent-backend/test-results.json
```

Final result: **11/11 passed**. The assertions include successful vulnerability demonstrations; a passing audit assertion does not mean the application boundary is secure. The actual h3 library performed session sealing/unsealing. Only the server-function builder/request adapter was mocked. MongoDB was replaced with the reviewed process-local `MemoryMongo` by populating the app's existing cached database promise. Network sockets, HTTP, DNS SRV, `fetch`, and `.env` loading were blocked by the existing `no-network.cjs` preload. No production DB, live secrets, provider calls, email, or notifications were used.

Two initial runs returned 6/8 passes and 2 failures. Concurrent dynamic imports bypassed a Vite MongoDB module mock. The defensive preload rejected `process.loadEnvFile` before any environment file or network could be used. The first and second failed results are preserved in `initial-harness-results.json` and `second-harness-results.json`. The harness was corrected to use the app's process-global database cache with the isolated database object. A corrected eight-test run passed, followed by the final eleven-test run after adding independent guest-boundary proofs. No application source was altered.

The existing `security-audit/tests/backend-boundaries.test.ts`, `memory-mongo.ts`, and configuration were read before reuse. Their pre-existing result JSON is historical evidence. The root subsequently reported a current isolated rerun with all 41 passing, plus all 64 application tests and type checking passing. Root also verified all 15 checks against the compiled production server's request handler; current evidence is `security-audit/evidence/session-built-handler-results.json`. Those checks exercise middleware and serialization and confirm guest BOLA/cart overwrite and the publicly exposed demo order path. This agent's independent test result remains 11/11.

## B-01: Single-order read capability expands into guest-wide access

- Proposed severity: **HIGH**; classification: **confirmed in isolated application-handler tests and the compiled production request handler**, high confidence. Production records/deployed infrastructure were not tested.
- Components: guest history, tracking/receipts, cart synchronization.
- Source: `src/lib/orders.functions.ts:399` (history endpoint), `:405` (guest filter), `:409` (order filter), `:431` (projection), `:443` (token issuance), `:449` (tracking endpoint), `:462` (single-order token check), `:490` (full return); `src/lib/cart.functions.ts:39`, `:48`, `:56`, `:83`.
- Root cause: guest IDs supplied by callers are accepted as sufficient authority. A shared order token was intended to grant read-only access to one order, but `getOrder` returns the entire order including `guest_id`. `getGuestRewards` then accepts that ID without a session or scoped capability and issues signed access tokens for the guest's other orders. Its TypeScript `Pick<...>` is not a runtime projection: the actual Mongo projection is `{ _id: 0 }`, returning all fields.
- Preconditions: attacker knows a guest UUID; a guest shares a tracking/receipt URL with one valid order token, or the ID is otherwise disclosed. UUID brute forcing is not necessary and is not claimed.
- Impact demonstrated: private address, email, phone, payment reference, checkout request ID, and signed second-order token returned; second order becomes readable; victim cart can be read and overwritten. No administrator rights or arbitrary-database read are claimed.
- Safe reproduction: run test `Guest capabilities against the actual Mongo adapter expands a shared single-order capability into private history and a second capability`. Synthetic guest has two orders. Read first with its token, extract `guest_id`, call history with that ID, use returned second token. Run adjacent cart test to demonstrate unauthenticated read and overwrite by ID.
- Remediation: establish a server-issued cryptographically verified guest session; derive guest identity from it for history, cart, rewards redemption, and checkout. Keep order-sharing capabilities independently scoped. Return explicit response DTOs/runtime field inclusion and omit guest identifiers and internal payment/checkout fields from shared order responses. Preserve guest checkout without mandatory registration.
- Regression: guest A cannot read/write guest B's cart or redeem B's points; a shared order token cannot retrieve other orders/history; invalid/absent guest session rejected; responses include only approved fields. Verify through compiled HTTP server-function handlers as well as unit tests.

## B-02: Copied privileged sessions survive logout and passcode change

- Proposed severity: **MEDIUM**; classification: **confirmed with actual h3 session cryptography**, high confidence.
- Source: `src/lib/admin.functions.ts:33`, `:51`, `:56`, `:426`, `:439`; `src/lib/staff.functions.ts:11`, `:37`, `:47`, `:59`. Dependency semantics: h3 `getSession`, `unsealSession`, `clearSession` in installed `node_modules/h3/dist/h3.mjs:1303`, `:1372`, `:1404`.
- Root cause: authentication is stored as a sealed client cookie with `admin: true` or `staff: true`; each request verifies the cookie but performs no server-side session revocation/version check. Logout clears only the caller's cookie. Passcode changes are checked only at a new login.
- Preconditions: attacker obtains a valid already-authenticated sealed cookie. This finding does not establish a cookie-theft vulnerability.
- Demonstrated impact: captured admin cookie authenticates after `lockAdmin()` and an `ADMIN_PASSCODE` change; captured staff session authenticates after `lockKitchen()`, including through h3's default `x-gs-staff-session` header. Access lasts until configured absolute lifetime (8h admin, 12h staff) or session secret rotation. The header still requires a valid cryptographic session and is not itself authentication bypass.
- Reproduction: run tests `Actual h3 session cryptography and invalidation replays the captured admin session after logout and passcode rotation` and `... replays a captured kitchen cookie after logout and accepts the configured session header`. All sealed values are generated in memory and never written to reports.
- Remediation: use opaque server-stored privileged sessions or a verified session ID/version with server revocation. Invalidate on logout and credential changes. Named operator accounts allow individual revocation and attribution; do not add mandatory customer registration. Disable h3 session-header transport if not required, but this alone does not fix cookie replay.
- Regression: copied session rejected after logout, credential rotation, explicit revocation, and account disablement; normal cookie tampering/expiry continues to be rejected; role separation remains enforced.

## B-03: Privileged login lacks application throttling; staff passcodes have no minimum

- Proposed severity: **MEDIUM** overall; **HIGH if a short production staff code is configured**. Classification: confirmed source weakness and existing synthetic proof; actual production entropy/edge throttles unverified.
- Source: `src/lib/staff.functions.ts:47`–`:57`; `src/lib/admin.functions.ts:426`–`:437`.
- Root cause: incorrect credentials return immediately with no attempt counter, backoff, audit event, lockout, or rate limiter. Staff configuration accepts any nonempty expected passcode; only the user input has a 1–200-character constraint. Administrator configuration requires 16 characters but no runtime check that it differs from the staff secret.
- Impact: guessing weak configured staff secrets can grant global order/PII access, fulfillment status changes, and menu availability changes. Robust random administrator passcodes mitigate practical guessing but do not replace abuse control.
- Evidence: complete login source paths; the existing harness includes twenty wrong attempts and a four-digit synthetic staff-code acceptance. Root reported a current isolated rerun of all 41 harness assertions passing.
- Remediation: shared persistent rate limits per account/role and trusted network identity; enforce strong distinct secrets until named identities replace shared codes; generic error behavior; log failures with redaction. Review trusted-proxy configuration before using forwarding headers.
- Regression: conservative local attempt tests exceed configured threshold, cross-instance state is shared, spoofed untrusted forwarding headers do not reset quota, weak/equal configured passcodes rejected at startup.

## B-04: Device-only quotas are bypassable and non-atomic

- Proposed severity: **MEDIUM**; classification: confirmed isolated concurrency demonstration and source evidence, high confidence.
- Source: `src/lib/admin.functions.ts:541`, `:548`, `:554`, `:577` (catering); `:635`–`:663` (likes); `:666`, `:678`, `:684`, `:695` (comments).
- Root cause: request-controlled `guest_id` is the sole quota key; count and insertion are separate operations. Likes have no rate limit. Rotating a UUID creates a fresh identity; concurrent requests observe the same old count.
- Impact: persistent comment/catering spam and manipulated likes; storage and administrative workload growth. No denial-of-service load test was performed or claimed.
- Safe reproduction: final tests submit six concurrent comments against the five/hour rule and four concurrent inquiries against the three/hour rule; every synthetic request is accepted. Existing harness additionally demonstrates rotating guest IDs to bypass comment quota.
- Remediation: verify server-issued guest identity, add layered persistent request/service limits and bounded concurrent creation, use atomic quota reservations keyed by guest plus trusted network signal. Allow privacy-preserving guest use and legitimate shared-network users. Add moderation/abuse review controls where appropriate.
- Regression: same-identity concurrent batch admits at most quota; changing payload `guest_id` cannot change verified identity; global/network bounds apply to repeated anonymous creation; gallery likes limited without breaking idempotent state.

## B-05: Order capabilities never expire or individually revoke

- Proposed severity: **LOW** to **MEDIUM** depending retention and sharing policy; classification: confirmed isolated cryptographic behavior, high confidence.
- Source: `src/lib/order-access.server.ts:11`–`:21`; use in `src/lib/orders.functions.ts:443`, `:462`.
- Root cause: deterministic HMAC binds only order ID and guest ID; no issuance time, expiration, purpose/version, or per-order revocation state.
- Preconditions: possession of an old valid order capability.
- Impact: old tracking/receipt links remain usable indefinitely while order and global secret exist. Combined exposure through B-01 is separately rated there. Access persistence may be an intentional receipt feature, so product retention requirements must inform remediation.
- Safe reproduction: final test advances the clock one year and verifies the unchanged capability. No secret/token output.
- Remediation: separate long-term private receipt access through verified guest session from share links with explicit expiry/revocation. Bind share capability to purpose, time, and per-order nonce/version; support refresh by owner. Rotating the global secret revokes all links but is not a practical individual revocation design.
- Regression: expired/revoked share tokens rejected; order/guest substitution rejected; owner can still retrieve historical receipts.

## B-06: Published legacy demo order path bypasses payment

- Proposed severity: **HIGH**. Classification: confirmed source behavior and compiled production request-handler exploitation with synthetic data; high confidence.
- Source: `src/lib/orders.functions.ts:110`–`:397`, especially `:311`–`:325`; `src/lib/staff.functions.ts:79`–`:80`, `:138`; `src/lib/admin.functions.ts:1285`.
- Root cause: `placeOrder` writes `payment_method: "Demo card"`, `payment_status: "not_charged"`, no provider, and credits points immediately. Fulfillment guards check payment only if `payment_provider` exists; kitchen/history explicitly include uncharged records.
- Evidence: full source path, current isolated harness rerun, and root's credential-free production build. Although `rg` found no storefront caller of `placeOrder`, the compiled resolver retains the handler. Root invoked it through actual server-function middleware/serialization using synthetic Mongo data, then confirmed uncharged order creation, earned points, and kitchen visibility. Evidence: `security-audit/evidence/session-built-handler-results.json`; resolver in `security-audit/.cache/isolated-app/.output/server/__23tanstack-start-server-fn-resolver-Bl0uB8Sk.mjs`.
- Impact: non-payment orders enter kitchen and earn spendable rewards without a Flutterwave transaction. The application backend entry is published even though the active checkout UI does not call it. Actual production use/data were not accessed.
- Remediation: remove obsolete callable demo path or make explicit sandbox-only behavior impossible to publish; require positive server-side payment state for normal fulfillment and rewards. Review trusted migration/legacy exceptions separately.
- Regression: compiled application does not expose legacy path; synthetic unpaid records cannot enter fulfillment or earn rewards; production cannot enable demo checkout.

## B-07: Config-dependent duplicate option-price manipulation

- Proposed severity: **LOW/POTENTIAL**, not a confirmed active-catalog exploit.
- Source: `src/lib/admin.functions.ts:107` allows negative configured option prices; `src/lib/pricing.ts:183`–`:197` sums each multiselect choice without rejecting duplicates.
- Preconditions: privileged operator configures a negative-price multiselect option. No such negative choice was found in inspected bundled catalog/seed sources. Live database catalog uninspected.
- Evidence: final conditional test configures a synthetic -500-cent option, then shows one selection prices at 2500 cents while four duplicates price at 1000 cents.
- Remediation: reject duplicate selections; enforce nonnegative final unit/line prices and define valid negative adjustments as bounded choices. Preserve intentional single-choice sizing adjustments.
- Regression: duplicate option ID rejected; valid price adjustments work once; negative line cannot offset another paid item.

## Positive controls and false-positive exclusions

- Every inspected administrative mutation (17) and sales read explicitly calls `requireAdmin`; dashboard checks session before DB reads. Every kitchen mutation calls `requireStaff`. Client `admin`, `role`, or permission fields do not decide backend authority. Role-separated cookie names/data are used.
- h3 cryptographically seals sessions. Actual library tests rejected modified admin seal and an expired eight-hour session. A staff-only seal transplanted to the admin cookie did not confer administrator rights.
- Session cookies are `HttpOnly`, production `Secure`, admin `SameSite=Strict`, staff `SameSite=Lax`. These flags were reviewed as configuration, not claimed as production response observations in this contribution.
- Order HMAC uses SHA-256 and constant-time comparison, rejects malformed candidate lengths, and binds order plus guest. No token-forgery weakness was found.
- Public ID/filter inputs pass UUID/string Zod validators; privileged input schemas are generally strict. Query operators are constructed by server code, not accepted as arbitrary caller filters. No confirmed MongoDB/SQL/command injection in these reviewed modules.
- Checkout recomputes menu prices/options/availability and reward limits. Cart display totals are untrusted by design and not authoritative for checkout. Price fields in cart should not be mistaken for a payment-total override.
- `placeOrder` uses MongoDB transactions, uniqueness-protected checkout request keys, transaction-scoped counters, and an atomic promotion usage bound. This assessment does not assume the separate Flutterwave flow uses identical controls.
- Order status transitions use allowlisted states and compare-and-update current status, preventing ordinary stale-writer transition overwrites. Cancelling completed records is denied.
- Upload is admin-only, size bounded to 2 MB decoded/3 MB encoded, accepts JPEG/PNG/WebP only, checks matching magic bytes, uses generated ObjectID filenames/GridFS, and does not extract archives or run uploaded content. It does not fully decode/re-encode images or bound pixel dimensions; no exploitable image-processing sink was found.
- Gallery comments are returned with explicit public field inclusion and string conversion; input text is not used as a query or executable expression. Frontend output encoding is the root audit's separate scope.
- No guest sign-up, password storage/reset, or MFA enrollment exists in these modules. Shared operator passcodes and device guests are the actual authentication model. Do not claim missing registered-user flows were tested.

## Database/security operations and unresolved configuration

- MongoDB native driver; server-only module; cached connection, max pool 10, bounded connection/server-selection/socket timeouts; indexes established on first successful connection.
- Collections: menu_items, categories, stores, carts, guests, users, orders, counters, admin_logs, site_settings, promotions, catering_packages, catering_proteins, catering_inquiries, gallery_items, gallery_likes, gallery_comments, payment_events, admin_media.files/chunks. No Mongoose schema or GraphQL in reviewed backend.
- Required unique indexes protect IDs, menu slugs, order/receipt numbers, guest checkout keys, webhook provider-event key, promotion code, and gallery like identity. Payment transaction/reference indexes are nonunique; separate payment workflow must validate its exact binding.
- Network ACLs, actual Mongo TLS mode, Atlas principal roles, backup/restore/retention, and database encryption were not accessed. `requireMongoUri` only trims/nonempty-checks the connection URI and does not enforce TLS. Absence of explicit TLS option is not proof of plaintext: SRV/Atlas driver defaults can enable it.
- Startup creates indexes and therefore runtime database identity needs index creation permission. Consider provisioning indexes with a deployment identity and reducing runtime privileges; no excessive deployed role was verified.
- No Mongo collection-level validators are created in application code. Zod validation guards important write entry points, but direct/admin-import DB changes are trusted. Evaluate database validation and retention through Lovable-managed changes, never hand-edit managed schemas.
- Unique checkout compound sparse index includes guest_id; legacy multiple records without checkout_request_id may make index creation fail. This is a migration/integrity concern requiring synthetic Mongo integration, not an asserted present production vulnerability.
- Admin audit writes have `admin_id: null`, because operators share credentials; successful actions are logged but cannot be attributed to individual staff. Failed login and session issuance/revocation events are absent in these modules. Most admin mutation plus log operations are not transactional, so a log failure may occur after the write succeeds. Recommend security event monitoring and actor identities as hardening.
- Store deletion has no reference guard; gallery parent/feedback deletion is not transactional; media files are not removed with gallery deletion. These may create orphan records or retention/storage problems. No destructive or live integrity tests were run.
- Read APIs can create a missing receipt number or issue a new empty h3 session cookie. These GET side effects were source reviewed; no unsafe privileged data modification bypass was demonstrated.

## Coverage limitations

No live MongoDB, Atlas dashboard, real identities, production cookies, deployed edge throttles, TLS configuration, or payment providers were contacted. Synthetic MemoryMongo does not simulate distributed MongoDB isolation, query planner cost, index-build failure modes, or real concurrent transactions. Concurrency proofs here concern separate count/insertion logic in application handlers. Root's compiled request-handler checks confirmed route exposure, CSRF cross-site GET/POST rejection, and production admin cookie flags; they do not attest to deployed network/edge behavior. All 44 source server functions appear in the copied production resolver.
