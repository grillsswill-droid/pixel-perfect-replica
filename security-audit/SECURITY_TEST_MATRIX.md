# Security test matrix

Scope: current revision `cd56b33ef334d98f81e9d9bde23727ace5d71265`. “Pass/control” means the tested control behaved as expected. “Confirmed defect” can have a passing reproduction assertion. “Reviewed” is source evidence, not a dynamic test. “Skipped”/“inapplicable” is never a pass. No tests used live credentials or production data.

Evidence abbreviations: **APP** = `evidence/session-existing-results.json` (64 tests); **BASE** = `evidence/session-backend-results.json` (41); **BACK** = `agent-backend/test-results.json` (11); **PAY** = `agent-payments/test-results.json` (46); **BUILD** = `evidence/session-built-handler-results.json` (15 compiled checks); **SAST** = `evidence/session-static-triage.json`; **SECRETS** = `agent-supply/secret-review.json` / `secret-validation.json`; **SCA** = dependency inventory and supply-agent command records.

## Inventory and standards

| Test / category | Target / method | Expected result | Actual result / status | Evidence / limits |
|---|---|---|---|---|
| Installed skills/plugins/tools | Actual filesystem, PATH, plugin/tool metadata | Accurately identify callable capabilities | Completed; Codex Security absent, Gitleaks temporary install recovered | Tool inventory / plugin discovery; no unknown install |
| Official standards | Published OWASP pages; redirect-aware curl reads | Identify stable versions | OWASP Top 10:2025, ASVS 5.0.0, WSTG 4.2 and API Top 10:2023 confirmed | Fresh reference JSON; developing WSTG 5.0 explicitly excluded |
| Complete tracked-tree inventory | Git file list, hashes and text triage | Cover source, configuration, legacy code, support files and assets | 462 non-audit files; 425 text files read and 37 binaries hashed | Current baseline / SAST; not a semantic review of every asset or dependency byte |
| Backend endpoints | Source review and production resolver | Include dormant functions and explicit APIs | 44 RPCs (15 GET / 29 POST) and 4 HTTP routes inventoried | API inventory / built resolver; no undocumented GraphQL found |
| Trust boundaries / threats | Data flow / three independent source reviews | Verify browser/server/DB/provider boundaries | Model and source findings documented | Threat model; deployed infrastructure not accessed |

## Authentication, accounts and authorization

| Test | Target / method | Expected result | Actual result / status | Evidence / limits |
|---|---|---|---|---|
| Registration/email/password/reset | Active app architecture/source | Review actual flows | Inapplicable: no active customer password signup/reset | Backend/API inventory; dormant Supabase not dynamically tested |
| Missing/malformed operator credentials | Admin/staff schemas, controlled calls | Reject wrong types/missing/overlong values | Pass/control; generic incorrect-secret result | BASE/BACK; not live brute force |
| Wrong passcode and role claims | Anonymous/staff caller with body `admin`/`role` | No elevated rights | Pass/control; client claims ignored | BASE/BACK; builder mocked in unit suites |
| Login throttling / weak staff configuration | Twenty wrong attempts per role and a synthetic four-digit staff code | Limit attempts and reject weak configuration | Confirmed defect SEC-007 | BASE; no real lockout or throttle load test; edge controls unknown |
| Admin/staff function guards | Seventeen admin mutations plus the sales read; two kitchen mutations | Reject unauthorized calls before DB access | Pass/control for anonymous callers and the wrong role | BASE / inventory; valid schema cases tested separately |
| Cookie flags | Production-compiled synthetic admin login | HttpOnly/Secure/Strict | Pass/control | BUILD; production env corrected before final run; staff Lax source reviewed |
| Real seal tampering / expiration | Actual installed h3 library | Reject modified or expired seals | Pass/control | BACK; eight-hour expiry tested; no stolen real cookie |
| Staff seal transplanted to admin | Actual h3 role sessions | No administrator privilege | Pass/control | BACK |
| Logout / credential-change replay | Retained synthetic sealed cookie | Revoke copied cookie | Confirmed defect SEC-008 | BACK; requires a valid cookie; twelve-hour staff / eight-hour admin lifetimes |
| Refresh-token/JWT issuer/audience/MFA | Actual active flows/source | Test if present | Inapplicable to active custom sessions; no refresh/MFA pipeline | Dormant generated Supabase claims helper source reviewed only |
| Horizontal guest access / BOLA | One shared synthetic order followed by guest history and a second token | Preserve single-order scope | Confirmed defect SEC-002 | BASE / BACK / BUILD; no UUID guessing required |
| Guest cart ownership | Other guest ID read/write | Verified ownership required | Confirmed defect SEC-002 | BASE/BACK/BUILD |
| Transaction ID to order capability | Mock merchant transaction; callback receives ID alone | Verified payment does not prove caller ownership | Confirmed defect SEC-004 | PAY; practical ID discovery untested |
| Order HMAC malformed/substituted inputs | Regex, wrong order/guest, constant-time source | Reject token changes | Pass/control | BASE/BACK; no token forgery found |
| Order capability age/revocation | Advance synthetic clock one year | Sharing lifecycle explicit | Confirmed persistence weakness SEC-014 | BASE/BACK; owner long-term receipt policy undecided |
| Cross-tenant isolation | Architecture/model review | Scope to actual tenants | Inapplicable: no tenant/org model | Not inferred from absent code |

## API, validation and injection

| Test | Target / method | Expected result | Actual result / status | Evidence / limits |
|---|---|---|---|---|
| Missing/null/array/type/unknown protected fields | Payment/cart/order schemas, bounded cases | Reject invalid/mass-assignment inputs | Pass/control for tested cases | BASE/PAY/APP; not exhaustive endpoint fuzzing |
| Malformed JSON / content type | Explicit payment initialization and webhook handlers | Return 400 for malformed JSON and 415 for unsupported initialization content type before DB access | Pass/control | BASE / PAY / BUILD |
| NoSQL operators in scalar IDs/addresses | Harmless `$ne`, `$where` and `$gt` object cases | Reject before filter construction | Pass/control; no confirmed NoSQL injection | BASE / PAY / SAST; no actual DB query executed |
| SQL/command/template/LDAP injection | Whole-tree sink and data-flow review | No reachable unsafe sink | Reviewed; no confirmed active sink | SAST / source; active LDAP, SSTI, command and SQL runtimes absent; legacy SQL read only |
| Selection object keys / early array maximum | 1,000 and 1,500 keys; 1,000 children with a maximum of two | Bound work before child parsing | Confirmed parser weakness SEC-013 | BASE / supply bounded proof; no exhaustion test |
| Declared oversized payment body | Content-Length of 128,001 | Return 413 before DB access | Pass/control | BASE |
| Chunked/undeclared body budget | 256 KiB synthetic byte stream | Stop reading at 128,000 bytes | Confirmed buffering defect SEC-013; entire stream consumed first | BASE; no production-sized flood |
| Cross-site RPC POST/GET | Real compiled CSRF middleware | Return 403 | Pass/control | BUILD; browser not launched |
| Wrong Origin initialization | JSON request with a foreign Origin | Return 403 | Pass/control | BASE / BUILD; non-browser requests without Origin accepted by design |
| CORS/preflight/server config | Source/request boundary | No broad credentialed wildcard | Reviewed; no app wildcard found | Deployed CDN/proxy/preflight behavior unverified |
| Header/cache/error policy | Compiled JSON, private and error responses | Explicit safe policy; no internal details | Generic 500 response omits paths; missing global headers observed | BUILD / OBS-001; no edge cache or TLS test |
| Path traversal/media ID | Encoded traversal and invalid ObjectId cases | Return 404 without file access | Pass/control | PAY / BUILD |
| React XSS/context output | Comments, captions, notes and client sinks | Context-safe output | Reviewed; escaped JSX; unused chart style sink separated | SAST / payment assessment; browser XSS execution not performed |
| Unsafe deserialization | Framework parser and serialized-input source | No user-driven executable evaluation | Reviewed; no confirmed application sink | Serialization used in BUILD; semantic parser exhaustiveness not claimed |
| Log/header injection | Input, error and logging source | Structured redaction; no forged records | Reviewed; redaction/attribution gaps SEC-016 | No deployed log sink or infrastructure accessed; no live header injection |

## Database, payments and business logic

| Test | Target / method | Expected result | Actual result / status | Evidence / limits |
|---|---|---|---|---|
| Authoritative prices/options/bundles | Current schemas/pricing and a tampered amount | Client cannot lower payable total | Pass/control | APP / BASE / PAY; server recomputation reviewed |
| Demo checkout / fulfillment | Production resolver and valid synthetic POST | No unpaid reward issuance or normal fulfillment | Confirmed defect SEC-003 | BASE / BUILD; RPC published although frontend does not call it |
| Reward conservation | Two pending orders against one 1,000-point balance | Cannot reserve or spend 2,000 points | Confirmed defect SEC-005 | BASE; sequential demonstration, not a native MongoDB race |
| Promotion capacity | One-use coupon and two paid fixtures | At most one discounted paid order | Confirmed defect SEC-006 | BASE; no real coupon consumed |
| Order request idempotency/status machine | Repeated request and status transitions | No duplicate order or stale transition | Controls reviewed/tested | APP / BASE / source; real MongoDB uniqueness/isolation not executed |
| Provider transaction mismatch | Wrong ID, reference, amount, currency, email or metadata | No paid transition | Pass/control | PAY; six mismatch cases; provider mocked |
| Verified replay effects | Same successful transaction repeated | Apply rewards/fulfillment effects once | Pass/control | BASE / PAY; no MongoDB proof across processes |
| Unsigned callback without transaction ID | Known pending reference and cancelled status | No authoritative mutation | Confirmed defect SEC-009 | BASE / PAY; already-paid state protected |
| Old checkout / late successful payment | Expiration followed by retry; controlled interleaving | Resolve old attempts and recheck identity | Confirmed defect SEC-010 | BASE / PAY; no actual charges or refunds |
| Webhook authentication, malformed payload and unrelated event | Hash content/length, payload and event cases | Reject or ignore before DB access | Pass/control | PAY / BUILD; current static `verif-hash` mode only |
| Success event with pending verification | Hash-authenticated success fixture; verification pending, then replay | Eventually settle the verified payment | Confirmed conditional defect SEC-011 | PAY; provider consistency frequency unknown |
| Fresh event claim | Duplicate event insertion | One fresh claim | Pass/control | BASE / PAY; limited mock uniqueness behavior |
| Stale event reclaim | Two simultaneous synthetic claims | One leased worker | Confirmed defect SEC-015 | PAY; no duplicate financial credit shown |
| Gallery/catering quotas | Rotating UUIDs; six comments / four inquiries concurrently | Do not exceed quotas of five / three | Confirmed defect SEC-012 | BASE / BACK; small process-local batch |
| Negative option duplicates | Synthetic multiselect choice with a -500-cent price | Reject duplicate price adjustments | Potential POT-001 | BACK; no corresponding active catalog configuration observed |
| Mongo URI/secrets/TLS flags | Redacted variable names and boolean configuration checks | No exposed secrets or insecure flags | Historical exposure confirmed; local SRV URI has no explicit insecure flag | SECRETS; DB credentials never used; actual TLS not verified |
| Mongo queries/indexes/validators | All backend modules and index source | Validated filters and uniqueness invariants | Positive index controls reviewed; real constraints and gaps documented | API / backend review; no replica set |
| DB ACLs/IAM/backup/restore/encryption | Repository files and access discovery | Verify least privilege and recovery | Unable to verify | No approved cloud/DB read-only access; not passed |
| Deletion/referential integrity/legacy indexes | Source review | Preserve referenced data and recovery | Potential integrity/migration gaps reviewed | No destructive query or live deletion; requires an isolated real DB |

## Uploads, integrations, deployment and supply chain

| Test | Target / method | Expected result | Actual result / status | Evidence / limits |
|---|---|---|---|---|
| Upload role, size, MIME, signature and filename | Admin RPC and in-memory GridFS | Reject anonymous uploads, SVG/HTML, mismatches and oversized files | Pass/control; 14 media/upload tests | PAY; no server image decoder, malware or archive-processing sink; full decoding not tested |
| Public/private draft media | Valid GridFS image without a published gallery record | Explicit publication/access policy | Public access before publication confirmed, OBS-002 | PAY; private-file ownership requirement absent |
| Media deletion/cache lifetime | Source review | Explicit retention and revocation | Gallery deletion retains bytes; one-year public cache | OBS-002; no real record deleted |
| SSRF/checkout redirect/integration URLs | Fixed provider URL and malicious URL variants | Reject unsafe userinfo, port, protocol, host or path | Pass/control; no attacker-controlled server fetch found | PAY; no internal or metadata endpoint request |
| Timeout/external response handling | Source review and provider mock | Bound request time and validate outcome | 25-second provider timeout; exact matching checks pass | PAY; actual TLS and provider response-size behavior not tested |
| OAuth/external auth | Generated dormant helper source | Identify active integrations | Reviewed; not executed | No active OAuth callback/customer flow; external project state covered by POT-002 |
| Jobs/cron/emails/queues | All source and route inventory | Authorize and limit actual workers | Inapplicable except request-driven webhook; no active cron, queue or email sender | No message, payment or background job sent |
| Current/history secrets | Gitleaks, all-blob regex and exact in-memory comparison | No exposed or reused secrets | Confirmed SEC-001; 6 current and 27 historical raw scanner detections classified | SECRETS / sanitized scanner JSON; not every hit is a vulnerability |
| Client bundle secret boundary | Public environment source and exact-value public build checks | No server secrets in browser assets | No exact current-secret match in inspected existing public build; new build uses credential-free inputs | Supply evidence; historical deployments unknown |
| Root/nested dependency consistency | `npm ls` and lockfile/manifest analysis | Valid locks, integrity and trusted registry | Root consistency passes; HTTPS registry and integrity reviewed | SCA; no installers or upgrades |
| Dependency advisories | `npm audit` and official bulk advisory request | Fresh, complete SCA | Failures and freshness reported for each command | DEPENDENCY_RISK_INVENTORY; no blanket clean claim |
| Semgrep/CodeQL/ZAP/OSV/SBOM | Availability and compatibility discovery | Run when available and appropriate | Skipped where unavailable; current Semgrep requires newer Python | Tool inventory; custom triage is not equivalent |
| Node/Vercel/Nitro configuration | Source and read-only local metadata | Correct runtime and secret separation | Node presets/punycode alias reviewed; isolated production build passes | No production deployment or cloud policy change |
| Containers/Kubernetes/IaC | Actual repository inventory | Apply checks only to present configuration | Inapplicable; no actual manifests/runtime found | No arbitrary cloud or IP scan |
| Logging/monitoring/incident response | Null actors, login and error source | Useful redacted security events | SEC-016 gap; infrastructure log controls unknown | No real logs or alerting queried |

## Functional checks, failures and final integrity

| Check | Actual result | Limitations |
|---|---|---|
| App suite | 64/64 pass | Existing coverage focuses on cart, pricing, schemas, routing and payment helpers; not comprehensive infrastructure security integration |
| Audit baseline suite | 41/41 pass | Exploit assertions intentionally pass on current defects; stub sessions and limited MemoryMongo |
| Independent backend suite | 11/11 pass | Actual h3; builder/request adapter mocked; two initial mock failures preserved and corrected |
| Payment/media suite | 46/46 pass | Providers/GridFS mocked; full browser image parsing not tested |
| Compiled handler suite | 15/15 final pass | Earlier environment, serialization and expected-cookie harness errors retained; no TCP or browser |
| TypeScript | Pass | Type correctness alone does not enforce authorization |
| Production build | Pass | Copied inputs, production NODE_ENV and blocked network; no deployment |
| ESLint | Fail; source rerun has 720 errors and 11 warnings | Existing formatting/prefer-const issues; initial run also included generated `.next` output; no `--fix` |
| Source/HEAD integrity | See `evidence/session-final-integrity.json` | Current baseline is authoritative; old baseline predates committed audit files |

## Explicit non-executed operations

No live database query, production/staging scan, real account login, provider transaction/verification/refund, notification/email, metadata/internal network access, destructive query, exploit persistence, cloud policy change, seed script, deployment, force push, manifest/lock upgrade or substantive application patch occurred. Live TLS/WAF/cloud/backup/Supabase validation, native MongoDB integration and official Codex Security standard/deep scanning remain follow-up requirements.

