# Supply, secrets and configuration assessment

Read-only review on 2026-11-25; application files, schemas, infrastructure and package versions were not changed. No credential was authenticated, revoked or rotated. No seed script was executed.

## Confirmed High: historical credential exposure with current local reuse

Git history includes credential-bearing `.env.example` at commit `24ced0ae762131b4ed77470e745929fd6ad1319a` (2026-11-15), blob `5116f9aa6a8a4bb3afe7bc29700493db48806858`: `MONGODB_URI` line 1, `SESSION_SECRET` line 3, `ADMIN_PASSCODE` line 5. In-memory comparison confirms each value exactly equals the current ignored `.env.local` value. Earlier `e04754c41518bc5ed29a984fd718a8abcc0e7e3a` contains the same DB/session values; earlier `.env` blobs contain other shared staff/session credentials. Values were never emitted or used. Current `.env.example` is placeholder-only, but history preserves old data.

Impact: repository readers can obtain configured DB credentials and shared administrator/session secrets. Production reuse and credential validity were deliberately not tested. An exposed session seal secret could undermine privileged-cookie and order-capability trust even where authorization code is otherwise correct. Recommend immediate owner-managed DB/admin/session rotation wherever reused, invalidation of affected sessions/links and review of DB/admin access logs. Existing staff/provider secrets should be rotated if historical exposure or reuse is established. Do not rewrite Lovable-connected published history; rotation is necessary regardless of current-file cleanup. Regression: new secrets differ from exposed values, old synthetic credentials cannot authenticate, secrets stay out of client/public bundles and CI rejects new secret material.

Evidence: [secret-review.json](secret-review.json), [secret-validation.json](secret-validation.json). Supplemental inspection covered 103 commits, 1,323 object entries, 862 unique blobs, no read errors. Existing public build files (88) contained no exact configured-secret matches; stale artifacts do not prove deployed bundle state. Current root `.env.local` is ignored and untracked, mode `0644`; reduce local permissions as a minor host hardening measure. It contains live-mode payment configuration, which was stripped from every audit subprocess and never used.

## Scanner classification

Gitleaks was executed by the root agent; 6 current and 27 history detections are observations requiring classification, not 33 vulnerabilities. Evidence: `../evidence/session-gitleaks-{current,history}-sanitized.json` and [gitleaks-validation.json](gitleaks-validation.json).

| Detection | Classification | Evidence and action |
| --- | --- | --- |
| `.env.local:3` session secret | True secret in intended ignored local config; historical reuse makes this part of confirmed exposure | Exact historical comparison above; rotate where reused. |
| `.env.local:12,13,14` provider configuration | True secrets in intended ignored local config; no provider key exposure in inspected Git history established | No credentials used, public-bundle exact matching negative; preserve server-only secret handling. |
| `.impeccable/questions/seeds/57615ddd5e1c05b6.json:1` | False positive | Ignored/untracked question-selection seed with `key`, `handId`, `pingId` random identifiers; no configured secret/provider-format match or application authentication consumer. |
| `.vercel/output/functions/__server.func/_libs/bson.mjs:2867` | False positive | BSON `utf8ValidatedKeys` derives from `validation.utf8`; ordinary validation code, not a credential. No configured-secret match. |
| Historical `.env/.env.example` | True credential literals; consolidate as one exposure finding | Exact current local DB/session/admin reuse validated independently; older literals may be retired. Deleted-line detections remain historical exposure evidence. |
| Historical `src/test/mongodb-config.test.ts:36` and Flutterwave format candidates | False positives | Explicit synthetic fixtures with mocked modules/providers, do not equal configured real values; never tested against services. |

Supplemental scanner is regex/exact matching and cannot prove absence. It supplements Gitleaks, which missed the MongoDB/admin assignment exposures detected by exact comparison. Matched values, tokens and response-cookie headers are excluded from shareable evidence.

## Database, deployment and seed configuration

Main server uses MongoDB native driver; current local URI is `mongodb+srv`, contains credential userinfo, and has no explicit insecure TLS flag. This is configuration evidence, not live TLS or Atlas IAM/network verification. Mongo network allowlists, database user privileges, backup/PITR, monitoring, retention and recovery capabilities are **unable to verify** without owner-supplied read-only infrastructure configuration. No cloud connector is exposed and repository files contain no IAM/firewall/container/Kubernetes/Terraform policies to validate. Vite/Nitro explicitly selects Node server/Vercel rather than a Worker; the required `punycode/` alias remains intact.

Seed scripts `scripts/seed-mongodb.mjs:5,650` and `scripts/seed-combo-meals.mjs:5,312` load private environment and connect to MongoDB. Starter inserts into empty collections; combo uses `$setOnInsert` with deterministic IDs/slug selectors. They contain fixed seed values, not user-controlled query/command interpolation. They are operator-run tools, not exposed request endpoints. Concurrent starter executions could both observe emptiness; uniqueness/index safeguards should be checked before parallel execution. Seeds inherit URI/default MongoDB database if `MONGODB_DATABASE` is absent. No production seed, database write or live connection occurred.

Legacy `drizzle/schema.ts` is generated and intentionally empty; migrations document retired Supabase tables. `drizzle/migrations/0000_grill_swill_core.sql:39-51` grants an authenticated `claim_first_admin()` bootstrap function, while `0001_guest_checkout_no_accounts.sql` removes old application privileges but does not remove that function. Current application has no discovered consumer of the old account/role path. Treat retained bootstrap privilege as a **potential legacy risk**, not confirmed current MongoDB privilege escalation. Have Lovable/owner verify actual retained SQL services, disable unnecessary bootstrap capability, and inspect roles/grants through authorized read-only configuration. Generated/schema files were not edited.

Nested `my-mongodb-app` is a separate Next.js template. Its `/` SSR and `/app-demo` page/server action connect/ping MongoDB without user accounts and display connectivity state; they do not query customer records or accept arbitrary queries. The server action logs caught raw driver errors (`app/actions.ts:16`, `pages/index.tsx:22`) and has no application request throttle. If separately deployed, restrict diagnostics, use generic/redacted logs and impose resource budgets. Main storefront exposure of these routes was not found. Nested connection options contain no explicit pool/timeouts/least-privilege enforcement; actual network/user policy is unavailable.

## Dependency results

Fresh official SCA fallback succeeded; see [DEPENDENCY_RISK_INVENTORY.md](../DEPENDENCY_RISK_INVENTORY.md). npm CLI failures are retained separately. Root: 8 advisories / 4 actual affected packages. Nested: 1 minimatch advisory. Bounded Zod parser mechanism proof passed with network disabled; no denial-of-service input was attempted. All lockfile sources use HTTPS official npm registry with integrity entries. No installs/updates/install scripts were executed.

## Reproduction and executed commands

Own audited commands/evidence are the `*.json` records beside this report: initial and escalated npm CLI attempts, npm registry connectivity, official combined bulk query, `npm ls --depth=0 --json`, and bounded Zod proof. [run.py](run.py) strips sensitive environment, redacts outputs and uses an audit-only npm cache; [scan_secrets.py](scan_secrets.py) performs local/Git reads and emits metadata only. Historical secret comparison was performed inside Python without outputting values. Public bulk query sends only package names/versions; it does not write provider/customer data. No relevant specialist supply-chain skill is installed; root records the applicable skills activated for the overall assessment.
