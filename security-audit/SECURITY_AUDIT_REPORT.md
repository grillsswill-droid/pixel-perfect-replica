# Application security audit and backend assessment

**Application:** Grill & Swill, including the nested MongoDB/Next.js demo and repository-managed tooling/configuration.  
**Date:** 25 November 2026.  
**Revision:** `cd56b33ef334d98f81e9d9bde23727ace5d71265`, branch `main`.  
**Overall assessment:** **High risk; significant access-control and commerce-integrity defects require remediation before trusting this revision with production customer data and payments.** No clean bill of health or standards certification is given.

## Executive summary

The application register contains five High findings: exposed historical credentials still reused locally, guest-wide access expansion from a single order link, a production-published unpaid demo checkout, private order access exchanged for a payment transaction ID, and repeated use of one rewards balance across pending checkouts. Eight Medium findings cover promotion capacity, privileged login/session security, unsigned callbacks, payment reconciliation, abuse quotas and validation budgets. Three Low findings concern perpetual share capabilities, webhook leases and incident visibility. Informational and conditional issues are separated from demonstrated vulnerabilities. Separately, fresh SCA matched eight root dependency advisories across four packages and one nested minimatch advisory; published ratings and contextual reachability are recorded in the dependency inventory. Zod exposure overlaps the application parser finding and is not counted twice as an independent attack path.

The most urgent action is owner-managed rotation of exposed credentials wherever reused, followed by fixing guest ownership and the unpaid checkout path. Current local values match the historical MongoDB URI, session secret and administrator passcode; whether deployed environments reuse them and whether the credentials remain valid were not tested. The credentials were neither displayed nor used. A compromised signing secret would undermine otherwise sound cookie/token cryptography.

Several useful controls work: authoritative server-side price recomputation; per-function administrator/staff guards; cryptographic session sealing and HMAC comparison; production secure cookie flags; real cross-site server-function blocking; transaction/reference/amount/currency/customer checks against a mocked provider; guarded paid transitions; fresh webhook deduplication; and role/size/MIME/signature restrictions on uploads. These controls do not resolve the ownership and business-state defects.

There were **162 passing automated tests** in the final four suites and **15 passing production-compiled request-handler checks**, plus a separate bounded parser proof. Some passing tests intentionally demonstrate vulnerabilities. Initial test-harness/setup failures, a failing lint check, unavailable tools and failed network scans are retained in the execution log. No production system or customer data was modified, no live payment/email/notification was initiated, and no application code or dependency versions were changed.

## Report set and primary evidence

| Document | Purpose |
|---|---|
| [SECURITY_FINDINGS.md](SECURITY_FINDINGS.md) | Unique finding IDs, source locations, preconditions, evidence, safe reproduction, remediation and regression recommendations |
| [SECURITY_REMEDIATION_PLAN.md](SECURITY_REMEDIATION_PLAN.md) | Prioritised actions, affected boundaries, migration risks and verification gates |
| [SECURITY_TEST_MATRIX.md](SECURITY_TEST_MATRIX.md) | Coverage, actual results and skipped/inapplicable categories |
| [SECURITY_TOOL_INVENTORY.md](SECURITY_TOOL_INVENTORY.md) | Installed/read/activated capabilities, scanner versions, unavailable tools and Codex Security setup |
| [SECURITY_EXECUTION_LOG.md](SECURITY_EXECUTION_LOG.md) | Commands, outcomes, errors, environment and non-executed operations |
| [THREAT_MODEL.md](THREAT_MODEL.md) | Assets, actors, flows, trust boundaries and threat scenarios |
| [DEPENDENCY_RISK_INVENTORY.md](DEPENDENCY_RISK_INVENTORY.md) | Package versions, advisory IDs/ranges, reachability, patches and scan-freshness limits |
| [API function inventory](agent-backend/API_FUNCTION_INVENTORY.md) | All 44 server functions with input/access/DB/response/error/limit details, plus four explicit APIs and page routes |

Detailed independent source reviews are preserved in [BACKEND_REVIEW.md](agent-backend/BACKEND_REVIEW.md) and [payment/storage assessment](agent-payments/ASSESSMENT.md). Machine-readable evidence contains redacted locations and synthetic results. Ignored build/cache artefacts are supplementary and are not required to understand findings.

## Scope, authorization and repository coverage

The authorized target was the supplied repository, not all domains referenced by it. All available tracked application, schema, configuration, lockfile, test, vendored skill and asset files were inventoried. The baseline contains **462 non-audit files**: 168 application/configuration files, 248 vendored skill/support files, four lock-related files, six legacy database files and 36 asset-category files. Lexical triage read 425 text files and hashed 37 binary files. These categories differ from text/binary counts; not every asset is binary and not every application-category file is source code.

Manual data-flow review concentrated on every backend function module, every explicit API, server/router/middleware helpers, active client integration, storage, scripts, nested demo and deployment configuration. Text triage is not a semantic proof that every vendored design resource is safe. Images/fonts were inventoried and hashed, not reverse-engineered or malware-scanned. Installed dependency source was inspected where needed to validate session/parser/framework behaviour, rather than claiming exhaustive transitive-code review.

Current/private environment assignments were inspected through name/boolean summaries and exact comparisons without printing values. Git-history analysis covered 103 available commits and 862 unique blobs, with no recorded blob read failures. Gitleaks ran against current files and all available Git history. Network access was limited to official documentation, release provenance and package-advisory reads; no referenced provider was treated as an authorized penetration-test target.

The audit began with a clean Git working tree. Existing `security-audit/` tests and evidence were tracked before this assessment. They were read before reuse; their old outputs were not presented as new test runs. New isolated artifacts and reports remain under this directory. A separate current baseline, rather than the stale historical baseline, is used for integrity verification.

## Architecture and attack surface

### Active application

The storefront uses React 19, TypeScript, TanStack Start/Router/Query, Vite/Nitro and Tailwind. It is a Node-compatible server, with Vercel's Node preset selected when `VERCEL=1` and `node-server` otherwise. MongoDB native-driver networking is incompatible with a pure Worker deployment; the documented `punycode/` Nitro alias was preserved.

`src/server.ts` wraps SSR/error handling. `src/start.ts` registers error middleware and CSRF middleware for server functions. `src/router.tsx` creates a QueryClient per request, avoiding shared SSR-cache state. `src/routeTree.gen.ts` is generated and was only read. Prices, availability and option/bundle snapshots are recomputed server-side; browser totals are display values.

Guests have browser-generated UUIDs in localStorage, carts, customer profiles and rewards. There is no active customer password registration/reset/JWT refresh/MFA flow. Staff and administrators use separate shared passcodes with h3 sealed role cookies, eight-hour administrator and twelve-hour staff lifetime. Anonymous order sharing uses a deterministic HMAC token. These are the actual security models; unused auth packages/templates were not assumed to protect application routes.

### Entry points

| Surface | Count / examples | Security boundary |
|---|---|---|
| Page routes | 13: `/`, `/menu`, `/deals`, `/catering`, `/gallery`, `/locations`, `/rewards`, `/account/orders`, `/checkout`, `/orders/:id`, `/receipts/:id`, `/kitchen`, `/admin`; plus root layout | Public rendering; private data should be checked in backend functions |
| TanStack RPC | 44 functions, 15 GET / 29 POST under `/_serverFn/<generated-id>` | Global CSRF plus each handler's validation/authorization; generated IDs are inventory identifiers, not authorization secrets |
| Payment initialization | `POST /api/payments/initialize` | Public strict JSON checkout, optional Origin check, authoritative pricing, fixed provider request |
| Payment callback | `GET /api/payments/verify` | Anonymous callback/provider verification; ownership and unsigned-status defects |
| Payment webhook | `POST /api/webhooks/flutterwave` | Static secret hash then provider verification and durable event handling |
| Image delivery | `GET /api/media/:id` | Public GridFS image allowlist and immutable cache |
| Administrative upload | `uploadAdminImage` POST RPC | Server administrator guard, bounded data URL and image signature checks |
| Seed scripts | Two explicit CLI scripts | Environment-credentialed database writes; reviewed, never executed |
| Nested demo | Next.js Pages/App routes and server action | Separate MongoDB connection; no mounted route in the main app discovered |

The production build's resolver independently confirms all 44 RPCs, including the obsolete `placeOrder`. All important inputs, guards, data operations and response/error shapes are in the detailed API inventory. No OpenAPI/Swagger/GraphQL API or production job queue/cron runner is present in the active application. Dormant generated Supabase helpers and legacy Drizzle migrations remain a lifecycle review target.

### Data and external services

MongoDB collections include menu items/categories/stores, guests/users/carts/orders/counters, settings/promotions, catering packages/proteins/inquiries, gallery items/likes/comments, payment events and admin logs. GridFS `admin_media.files/chunks` holds public administrator-uploaded images. Connection pooling, timeouts and unique ID/order/request/event indexes are implemented. No Mongoose schema or user-controlled aggregation pipeline is used.

The active server integration uses fixed Flutterwave v3 payment/verification URLs and a strict HTTPS checkout-host allowlist. Hosted payment collection keeps complete payment-card credentials out of this application. Provider calls, live key mode and merchant/environment ownership were not exercised. Browser telemetry/error helpers exist for Lovable preview; no security-monitoring service is established by the repository.

## Methodology and standards

The framework was **OWASP Top 10:2025** (published release), **ASVS 5.0.0** (stable, published 30 May 2025), **WSTG 4.2** (stable; 5.0 remains in development), and **OWASP API Security Top 10:2023**, supported by secure TypeScript/React/TanStack/h3/MongoDB practices and repository deployment instructions. Official version pages were retrieved and their provenance recorded. The assessment does not claim complete ASVS verification or any certification level.

Work combined whole-tree inventory, lexical sink/source triage, independent manual data-flow review, Git/current secret detection, dependency/advisory review, bounded synthetic validation/fuzz cases, actual h3 cryptographic testing, and credential-free production-compiled API/CSRF/cookie/error checks. Request-handler execution used Web Requests through the real compiled middleware with a process-local Mongo substitute and outbound networking blocked. It was not browser/TCP DAST, ZAP, a real Mongo integration test, or a live TLS/cloud test.

| Standard area | Evidence and assessment |
|---|---|
| Top 10 A01 / API1, API3 | Guest BOLA, overbroad runtime order projection and token scope expansion reproduced |
| Top 10 A02 / API8, API9 | Config/secrets, generated/dormant endpoint inventory, response policy and deployment gaps reviewed |
| Top 10 A03 | Root/nested dependencies and advisory reachability assessed; scanner failures/freshness disclosed |
| Top 10 A04, A07 / API2 | Secret reuse, sessions, HMAC, passcodes, expiry, tampering, throttling and revocation reviewed/tested |
| Top 10 A05 / injection tests | Harmless operator/type/encoding/path inputs rejected where tested; no confirmed reachable injection/XSS sink |
| Top 10 A06 / API4, API6 | Unpaid checkout, rewards/promotion overcommit, creation quotas and parser budgets reproduced |
| Top 10 A08 / API10 | Payment-provider authenticity, attempt/event integrity and unsafe pending-event completion assessed |
| Top 10 A09 | Null operator attribution and missing auth/abuse monitoring recorded |
| Top 10 A10 | Generic client failures, bounded provider timeouts and recovery/reconciliation gaps reviewed |
| API5, API7 | Administrator/staff function guards tested; no active attacker-controlled server fetch found; SSRF tested with allowlist mocks, not infrastructure access |

ASVS coverage spans authentication/session/access control, validation and business logic, files, data protection, communications, configuration, errors/logging and API boundaries. WSTG techniques guided reconnaissance, authorization, input handling, session/cookie and business-flow testing. Exact per-test status and limitations are in the matrix.

## Findings by security boundary

### Authentication and authorization

Operator cookies are cryptographically sealed, role-separated, `HttpOnly` and `Secure` in production; administrator SameSite is Strict, staff Lax. Real h3 tests rejected tampering/expiry and staff-to-admin transplantation. Real compiled middleware blocked unrelated browser origins for private GET and mutation POST RPCs.

Shared operator passcodes have no application throttle, and captured sessions remain valid after logout/passcode rotation. The guest UUID is a data key rather than verified ownership proof. Sharing one order token exposes guest-wide history/cart capabilities. A provider payment transaction is also incorrectly exchanged into browser read authority. These defects are server-side and cannot be repaired by hiding UI controls.

Password hashing/reset/MFA/JWT refresh scenarios are inapplicable to active customer flows. No such flow is reported as passed. Shared operator accounts lack MFA and individual lifecycle controls; a migration is recommended for privileged access while preserving guest checkout.

### Payments and business logic

The legitimate hosted flow verifies transaction ID, reference, exact cents, USD currency, normalized email and order metadata when provided. Tampered amounts fail before pending-order creation. Repeated verified settlement does not award rewards twice in the tested same-order path. No real charges were performed.

The published demo flow bypasses those controls entirely. In the normal Flutterwave flow, distinct pending orders can overcommit rewards/promotion capacity. Unsigned status callbacks mutate pending state. Attempt replacement loses late payment references, settlement lacks an in-transaction attempt recheck, and temporarily pending verification can permanently complete a success event. Stale webhook claims race. Financial invariants and recovery need a coherent order/attempt/reservation model, not isolated UI fixes.

### Database and data integrity

Native Mongo queries use server-created filters and validated scalar IDs. Harmless NoSQL operator objects failed input validation; no confirmed SQL/NoSQL injection was found. Unique request/order/event indexes, transactional paid effects and compare-and-set order transitions are positive controls. Synthetic tests do not prove distributed MongoDB transaction behaviour, real uniqueness/index creation or query performance.

The local configured URI is SRV-based with credentials; no explicit insecure TLS-disable flags were identified. URI presence alone is not a TLS/IAM verification. Atlas network ACLs, roles, encryption, backup/restore and retention were inaccessible. Runtime index creation requires privileges; separating provisioning and runtime identities is a hardening recommendation, not a verified excessive deployed role. Collection validators, deletion referential integrity and legacy sparse-index migration scenarios require isolated real-database follow-up through Lovable-managed schema changes.

### APIs, input handling and external integrations

All 48 main-application backend entry points were inventoried; the nested demo's routes/server action were reviewed separately. Schemas bound many strings, arrays, UUIDs, state enums and amount/currency fields; administrator schemas generally reject unknown fields. Public Mongo filters do not consume arbitrary query structures. The JSON payment route handles malformed/invalid input, wrong origin, declared oversize and unsupported content types explicitly. Numeric transaction IDs cannot inject an outbound URL path; checkout URL host/protocol/userinfo/port/path checks rejected tested malicious variants.

Request buffering and unbounded selection object keys leave resource-consumption gaps. Gallery/catering quotas are bypassable by UUID rotation and small concurrent batches. Callback verification and privileged login lack application rate limits. Frontend React text escapes tested sink paths by construction; no confirmed reachable stored/reflected/DOM XSS, command injection, path traversal, unsafe executable deserialization or SSRF was identified. This is bounded source/testing evidence, not proof all future inputs are safe.

### Uploads, frontend and response policy

Administrative images are restricted to JPEG/PNG/WebP, two million decoded bytes, matching signatures and generated GridFS identifiers. SVG/HTML, unsupported MIME, malformed base64, invalid image IDs and unauthorized upload attempts fail in isolated tests. Images are not fully decoded/re-encoded or pixel-budgeted; no server image-execution sink is present.

Media is deliberately public and immutable, including before gallery publication; gallery deletion does not delete bytes. Draft confidentiality and deletion semantics are product decisions requiring explicit policy. Browser-local contact/address storage has shared-device/XSS exposure implications but no demonstrated XSS or manual privileged-token storage was found. Share tokens in URLs persist indefinitely; private RPC caching/referrer/security-header policy needs review at the deployed edge. Unknown server function failures returned a generic page without internal paths/stacks in compiled checks.

### Infrastructure, secrets and observability

The repository establishes Node/Vercel build choices but no AWS/GCP/Azure IAM, firewall, Docker/Kubernetes or production CI/CD policy. None were invented or attacked. Generated/Vercel/local metadata was inspected safely. Secrets remain server-only in the reviewed source/client build boundary, but historical credentials still match local values. Current private secret values were not emitted or used, and build/test environments omitted production credentials.

Successful actions have admin logs but null individual actors, while failed login/denied access/session changes lack a dedicated security pipeline. Error cause expansion has no global sensitive-field redactor; live log leakage was not demonstrated. Alerting, access/retention/integrity of deployed logs and a functioning incident response path remain unverified.

## Tools and testing results

The API design skill supported endpoint semantics, validation, pagination and rate-limit review. The OpenAI documentation skill supported the Codex Security availability/setup verification. Installed Better Auth authentication/security/password/MFA/organization skills were read during discovery but not claimed as active protection or applied implementation workflows because Better Auth is absent. Payment services did not require Stripe/Flutterwave automation skills, and no messaging plugin was invoked.

`codex plugin list --json` identified only the enabled Taste plugin. **Codex Security is unavailable in this session. Its standard and deep scans were not run.** Official instructions require installation/enabling via desktop Plugins or CLI `/plugins`, then a new chat. The report names these skipped workflows rather than labelling manual multi-agent review a Codex Security scan.

| Execution | Actual final result |
|---|---|
| Existing application Vitest suite | 64/64 passed, env-file loading disabled and network blocked |
| Current rerun of pre-existing audit suite | 41/41 passed, exploit and positive-control assertions |
| Independent operator/guest/concurrency suite | 11/11 passed, actual h3 cryptography, synthetic Mongo |
| Independent payment/upload suite | 46/46 passed, mocked provider/GridFS |
| Production-compiled request-handler checks | 15/15 passed; 44-function resolver; real CSRF/cookie/error handling |
| Separate Zod bounded mechanism proof | Completed; 1,000-child/key fixtures; no resource-exhaustion test |
| TypeScript | `tsc --noEmit` passed |
| Credential-free isolated production build | Passed with production NODE_ENV and outbound guard; original build inputs unchanged |
| ESLint | Failed: source-scoped rerun 720 errors / 11 warnings, all errors reported as fixable; first run also included existing generated `.next` output |
| Gitleaks current/history | Completed, exit 1 for 6 current / 27 history detections; detections classified separately from confirmed exposed credentials |
| Whole-tree lexical triage | Completed: 425 text files read, 37 binaries hashed; not Semgrep or CodeQL |
| Dependency/advisory execution | npm CLI audit attempts failed DNS/timeouts; fresh official bulk-advisory fallback succeeded for 811 package names and all root/nested lock versions; no upgrades/install scripts run |
| ZAP/Semgrep/CodeQL/cloud/live DB tests | Not executed; availability/access/safety gaps disclosed |

## Limitations and residual uncertainty

No production or authorized staging target was provided. There was no real MongoDB replica set, provider sandbox, external auth account, cloud dashboard or WAF/CDN/TLS access. The isolated Mongo substitute cannot validate native transaction isolation, real index constraints, distributed races, GridFS storage ACLs or backup restoration. The configured v3 static `verif-hash` checks and provider verification behaviour were simulated using application paths; payload/timestamp signatures are not implemented or claimed as tested. No live provider transaction ID was probed. DAST was limited to compiled Web Request handlers, not browser execution, a network listener, passive ZAP or active deployed scanning.

Specialist SAST/SBOM/container tools were mostly absent; the installed Python version was incompatible with current Semgrep. Public network scanner/advisory requests encountered DNS/timeouts and are recorded individually. Secret-scanner rules missed some affected credentials, demonstrating why supplemental history/source validation was necessary. Unavailable scans were not passed by assumption. No build or dependency audit success is interpreted as security approval.

Inherited audit data and known vulnerabilities were available to reviewers, so this is not a blind detection benchmark. Independent review validated their attack paths and added new tests/findings. Generated/legacy external integration deployment state, private response caching at the hosting edge and deployed incident controls require follow-up. The end-of-audit integrity check records the exact source/HEAD preservation outcome.

## Recommended decision and next steps

Execute the immediate owner-managed credential response, then authorize implementation of the highest-priority ownership, payment and reservation fixes. Run the specified regressions against the actual compiled application and an isolated MongoDB replica set. Use official provider sandbox records for callback/webhook reconciliation, then perform staging header/TLS/edge-rate-limit validation with synthetic data. Install Codex Security and suitable compatible SAST/SCA tools for independent standard/deep follow-up scans after remediation.

Use [SECURITY_REMEDIATION_PLAN.md](SECURITY_REMEDIATION_PLAN.md) as the reviewable implementation scope. No substantive application, schema, dependency or infrastructure fixes were applied during this audit; they require the user's subsequent authorization.

## Final verification checklist

| Requirement | Verified result |
|---|---|
| Repository inventory and important source review | Completed for tracked tree and all main backend routes/helpers; assets/support and dependency-code limits explicitly described |
| Relevant skill discovery / actual use | Completed; activated API design principles and OpenAI documentation skills recorded; unrelated framework workflows excluded |
| Official Codex Security standard/deep scans | Unexecuted: plugin absent; official installation and scan requirements documented |
| Backend / API / authentication / authorization / database / business logic | Source-reviewed and applicable isolated tests executed; real Mongo/deployed behavior remains unverified |
| Secrets / Git history / redaction | Current/history scanner and supplemental exact reuse validation completed; no credential values displayed or used |
| Dependencies / deployment / external integrations / logging | Assessed; fresh advisory fallback succeeded, CLI failures and cloud/provider/logging gaps disclosed |
| Automated / dynamic tests | Final 162 automated tests +15 compiled-handler checks completed; no browser/live/staging DAST or actual provider transaction claimed |
| Evidence / severity / false positives / unverified risks | Unique register, preconditions, precise source citations, controls and limitations reviewed independently |
| Required reports | Seven requested documents, additional endpoint/dependency inventories and redacted evidence created |
| Production / destructive / application-change boundaries | No production/customer modification, destructive operation, credential use or unapproved application/infrastructure change; current source/HEAD integrity pass recorded |


