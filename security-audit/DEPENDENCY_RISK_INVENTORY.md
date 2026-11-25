# Dependency risk inventory

Assessment date: 2026-11-25. No manifests, lockfiles or installed dependency versions were changed.

## Evidence and scan status

Both npm lockfiles were inspected, including every resolved package/version, integrity entry, install-script flag and registry origin. Root `npm ls --depth=0 --json` passed and root/nested manifest dependency declarations match their lockfile root declarations. Root lock contains 699 package records including the project; nested lock contains 450. The combined query included 811 distinct public package names and every locked version.

Fresh `npm audit --json --ignore-scripts` CLI attempts **failed**: sandbox DNS errors for both applications, then a 30-second official endpoint timeout for root and a 45-second audit-runner timeout for nested. Those are scanner failures, not clean results. A conservative fallback using curl to the **same official npm bulk advisory API succeeded**, exit 0, in 8.849 seconds at `2026-11-25T21:16:03.712764+00:00`. This is a fresh SCA advisory query, not a completed npm CLI audit. Package/version matching used the installed `semver` parser against each returned vulnerable range.

Fresh result: root has **8 distinct advisory matches affecting 4 actual packages**; nested has **1 advisory match affecting minimatch**. Root advisory severities: 2 high, 5 moderate, 1 low. These counts differ from prior committed npm audit counts because npm also counts upstream packages affected by vulnerable transitives. No new production compromise is inferred from a package advisory. Prior `evidence/npm-audit-*-result.json` files remain historical corroboration, not fresh executions.

Evidence: [current-advisory-inventory.json](agent-supply/current-advisory-inventory.json), [fresh official advisory response and executed curl command](agent-supply/npm-bulk-advisories-curl.json), [root CLI network failure](agent-supply/npm-audit-root-network.json), [nested CLI timeout](agent-supply/npm-audit-nested-network.json), [installed dependency consistency](agent-supply/dependency-installed-consistency.json).

A final metadata-only read of the official registry succeeded at `2026-11-25T21:19:39.911274+00:00` (2.29 seconds, exit 0) and verified these currently published releases outside the returned vulnerable ranges. These are candidates for an approved compatibility review, not an instruction to upgrade everything. Evidence: [published-patch-targets.json](agent-supply/published-patch-targets.json) and [executed metadata request](agent-supply/patched-package-metadata.json).

| Package | Verified published patched candidate | Required Node version from package metadata |
| --- | --- | --- |
| Vite | `8.3.8` | `^20.19.0 \|\| >=22.12.0` |
| minimatch | `11.0.9` | `20 \|\| >=22` |
| Zod | `4.6.7` | No engine restriction returned |
| esbuild | `0.28.2` | `>=18` |

## Confirmed vulnerable dependency versions

Severity below is the published advisory severity. Application severity depends on the reachable function, operating system and deployment. GHSA identifiers are authoritative identifiers supplied by this registry response; CVE aliases were not returned and are not invented.

| Finding ID | Package / installed version | Scope and vulnerable range | Advisory and published severity | Reachability and preconditions | Patched target and remediation |
| --- | --- | --- | --- | --- | --- |
| DEP-001 (SEC-013) | `zod 3.25.76` | Root runtime; `<4.6.6` | [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), High, CVSS 3.1 7.5 | Used by anonymous cart/order/payment and privileged validators. Bounded local proof confirms oversized arrays still process all child elements and allocate child issues after a `.max()` failure. Unbounded selection-record keys are accepted. Full memory exhaustion was intentionally not attempted; application finding SEC-013 is Medium. | `4.6.6` is first version outside returned vulnerable range; `4.6.7` is already present in nested lock and was recommended by prior npm report. Review Zod 3→4 compatibility before migration; add request byte/depth/key budgets and early array limits regardless of upgrade. |
| DEP-002 | `vite 8.1.5` | Root development/build dependency; `>=8.0.0 <=8.1.5` | [GHSA-698v-4r3x-3vcv](https://github.com/advisories/GHSA-698v-4r3x-3vcv), Moderate | Windows editor-command `%` escaping issue. Current audit host is macOS; no Windows exploitation performed. Requires development/editor endpoint exposure. | `8.1.6` is first stable version outside returned vulnerable range; currently published candidate `8.3.8` verified above. Select a fixed 8.x release compatible with Lovable's config package and verify a production build. |
| DEP-003 | `vite 8.1.5` | Same root version/range | [GHSA-r825-w8mm-5pxw](https://github.com/advisories/GHSA-r825-w8mm-5pxw), Moderate | Editor CLI flag interpretation; development endpoint/editor dependent. No malicious command executed. | Same Vite remediation. |
| DEP-004 | `vite 8.1.5` | Same root version/range | [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm), High | Windows file-existence/editor bypass; platform and editor dependent. Not confirmed exploitable on this macOS host or production Node output. | Same Vite remediation. |
| DEP-005 | `vite 8.1.5` | Same root version/range | [GHSA-9jrq-w75r-8gcw](https://github.com/advisories/GHSA-9jrq-w75r-8gcw), Low | Vite custom-middleware cross-origin script execution. The project uses a Lovable Vite wrapper; development serving paths exist, but advisory-specific cross-origin exploitation was not tested. | Same Vite remediation; keep development servers restricted to intended local/preview access. |
| DEP-006 | `vite 8.1.5` | Same root version/range | [GHSA-rq7h-c2jc-7f22](https://github.com/advisories/GHSA-rq7h-c2jc-7f22), Moderate | Non-Windows path/`server.fs.allow` collision conditions. Current host platform matches, but filesystem-collision exploit was not executed. Production starts generated Nitro output rather than Vite dev server. | Same Vite remediation; regression-test allowed file serving and retain required `punycode/` alias. |
| DEP-007 | `esbuild 0.18.20` | Root dev transitive under `@esbuild-kit/core-utils`; `<=0.24.2` | [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99), Moderate, CVSS 3.1 5.3 | Development `serve` API cross-origin response reading. Dependency comes through legacy Drizzle tooling. No application call to esbuild `serve` was identified; known affected package installed, production exposure unconfirmed. Other esbuild copies `0.25.12` and `0.28.2` are outside this range. | `0.25.0+`; root already resolves patched copies. Update/remove obsolete loader chain through compatible Drizzle tooling rather than globally overriding without validation. Lovable manages migrations. |
| DEP-008 | `minimatch 10.2.6` | Root and nested dev transitive under `@typescript-eslint/typescript-estree`; `>=7.0.0 <11.0.1` | [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), Moderate | Glob pattern amplification in lint/tooling. No browser-to-minimatch application data flow found. Build/CI risk when untrusted patterns reach tooling; no resource exhaustion performed. `minimatch 3.1.5` copies are outside this returned range and are not counted. | `11.0.1` is first patched target in returned range; `11.0.9` is currently published. Update compatible TypeScript-ESLint/tooling so the transitive resolves a fixed version; verify Node requirements and lint behaviour. |

Exact installed paths and all matching versions are in the JSON inventory. Although the lock marks Vite as non-dev through dependency relationships, its assessed attack surface is the development/build server/editor middleware; that flag alone does not establish reachable production exploitation.

## Parser mechanism test

Executed [zod-bounded-proof.mjs](agent-supply/zod-bounded-proof.mjs) with network disabled and a 15-second timeout. One array of 1,000 short invalid strings against `.max(2)` visited all 1,000 children and allocated 1,001 validation issues. An application-equivalent `z.record(z.array(z.string().max(40)).max(10))` accepted 1,000 distinct keys. Assertions passed; [execution evidence](agent-supply/zod-bounded-proof.json). This bounded test demonstrates control behaviour without attempting denial of service.

## Other supply-chain observations

All resolved dependencies in both lockfiles use HTTPS `registry.npmjs.org` URLs and have integrity fields. No Git/HTTP/off-registry dependency source or missing integrity entry was found. Root install-script flags are limited to known esbuild copies and `fsevents`; nested lock has no install-script flags. Those scripts were inspected as metadata, not executed during this audit. Integrity establishes downloaded-byte identity, not package trustworthiness.

The nested MongoDB demo pins `next`/`eslint-config-next` with `latest` in its manifest, while its committed lock resolves `next 16.4.6`, React `19.3.1` and MongoDB `6.22.0`. Prefer explicit supported version ranges and `npm ci` in repeatable builds. It is a separate application and is not a main storefront route; no current registry advisory for its Next/Mongo/React versions was returned.

Root dependencies include inactive Stripe/Supabase/legacy Drizzle infrastructure. Active payments use Flutterwave; stale packages increase maintenance scope but their presence alone is not a confirmed vulnerability. Nitro is pinned to a beta (`3.0.260603-beta`); review vendor support and patch cadence before production. No package is labelled abandoned without maintainer evidence.

## Remaining limits and verification

The advisory API reflects known published vulnerabilities at query time; it does not detect unknown flaws or prove supply-chain integrity. No external provider credentials, cloud resources or live database were accessed. All direct/transitive code was not manually audited. No SBOM scanner was installed; the complete lock/version inventory and fresh advisory mapping provide auditable composition evidence. Patched releases should be checked against current vendor guidance and compatibility before approval. After an approved upgrade, repeat full SCA, authoritative pricing/validation/payment/access tests, lint/type checking and a Node/Vercel production build. No blind upgrade or `npm audit fix` was run.
