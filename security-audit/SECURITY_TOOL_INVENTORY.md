# Security tools, plugins and skills

Discovery started before assessment. Filesystem skill catalogs, installed plugin metadata, exposed tool metadata, PATH executables, local package installations and existing audit provenance were inspected. No arbitrary marketplace security plugin or unknown penetration-testing executable was installed.

## Activated skills

| Skill | Actual source read | Contribution |
|---|---|---|
| `api-design-principles` | `/Users/john/.agents/skills/api-design-principles/SKILL.md` | HTTP/RPC inventory, safe method semantics, validation, pagination, response/error design and abuse limits; applied by root and backend/payment reviewers |
| `openai-docs` | `/Users/john/.codex/skills/.system/openai-docs/SKILL.md`, its self-knowledge reference and fresh official manual | Verified current Codex Security plugin availability/installation/scan workflows without claiming unavailable capabilities |

Activation means instructions were accessible and used for the stated work, not that a plugin-specific security scan ran. Manual specialist source review and isolated tests supplemented these skills.

## Installed skills read during discovery, not activated as implementation workflows

| Skill / location | Applicability decision |
|---|---|
| `better-auth-security-best-practices`, `/Users/john/.agents/skills/…/SKILL.md` | Rate-limit/session/CSRF/secret guidance inspected; actual application uses TanStack/h3 custom sessions, not Better Auth |
| `better-auth-best-practices` | Version/adapter/session configuration inspected; library not used by application |
| `email-and-password-best-practices` | Password/verification/reset guidance inspected; active customer password flow absent |
| `two-factor-authentication-best-practices` | Enrollment/removal/recovery guidance inspected; no implemented MFA flow |
| `organization-best-practices` | Role/organization isolation guidance inspected; no multi-tenant Better Auth organization model |
| `create-auth` | Setup/workflow inspected; authentication implementation was not authorized during audit |
| `find-skills` | Discovery/install guidance inspected; no community skill search or installation needed to trust the existing capabilities |
| System `review-agent`, `/Users/john/.codex/skills/.system/review-agent/SKILL.md` | Read-only change-review instructions inspected; this task audits pre-existing whole-application defects, not introduced diff regressions, so workflow not invoked |

Other installed/catalogued skills were identified as design/UI, image generation, skill creation/installation or payment automation. Their presence does not supply an OWASP/penetration-testing engine. Stripe exists as an inactive dependency, but active payments use Flutterwave; no Stripe security/automation workflow was falsely credited. The Flutterwave automation skill and Rube tools were not invoked to avoid real external actions. No email/Slack/Lovable message was sent. Local `.agents` design skills were included in repository inventory, not activated merely by security-related keywords.

## Codex Security availability and installation requirement

`codex-cli 0.172.0`; `codex plugin list --json` returned only enabled `taste-skill@taste-skill`, version `2.5.1`, and no available Codex Security entry. No `codex-security` installed skill was found in the actual skill/plugin directories and no corresponding scan tool was exposed. See [session-plugin-discovery.json](evidence/session-plugin-discovery.json).

**Unavailable / unexecuted:** `$codex-security:security-scan` and `$codex-security:deep-security-scan`. No scan manifest, coverage result or report was fabricated. Independent multi-agent review is not labelled as the official deep-scan workflow.

Official setup requires installing/enabling **Codex Security** in desktop **Plugins**, or starting Codex CLI and using `/plugins` → Codex Security → Install, then `/new` to load skills/tools. Managed workspaces may require administrator enablement if installation is disabled. The official plugin quickstart is [here](https://learn.chatgpt.com/docs/security/plugin); [standard scan](https://learn.chatgpt.com/docs/security/plugin/scans) and [deep scan](https://learn.chatgpt.com/docs/security/plugin/deep-scans) document the requested commands. Installing it changes the agent environment and does not itself complete either scan; subsequent runs should record exact plugin/model/revision/coverage and independently validate findings.

The official documentation helper first failed sandbox DNS, was retried with required escalation, and successfully refreshed the manual. Installation was not inferred from a product name or unsupported memory. CLI emitted a nonfatal sandbox warning about PATH alias creation; version/plugin listing exited 0.

## Executed tools and versions

| Tool | Version / provenance | Use and limitation |
|---|---|---|
| Node.js | `v26.13.0`, `/usr/local/bin/node` | Existing JS toolchain, isolated compiled Request handlers, bounded parser proof |
| npm | `11.20.0` | Root/nested dependency consistency and audit/advisory attempts; no audit fix/install |
| Git | `2.50.1 (Apple Git-155)` | Read-only tracked-tree, available history/blobs, hashes/status preservation |
| Python | `3.9.6`, `/usr/bin/python3` | Redacted audit execution/inventory/history/provenance scripts |
| Vitest | `4.1.12`, existing `node_modules` | 64 app + 41 existing audit + 11 independent backend + 46 payment/media tests |
| TypeScript | `5.9.3` | `tsc --noEmit`, harness-only transpilation of synthetic MemoryMongo |
| ESLint | `9.39.5` | Functional lint/check execution; failed existing source/style issues, not a security SAST engine |
| Vite / Nitro | `8.1.5` / `3.0.260603-beta` | Production build from copied credential-free inputs; generated 44-function resolver |
| h3 | `2.0.8` in root resolution; actual installed session implementation referenced in evidence | Session sealing/tampering/expiry/logout replay validation; bundled build may include nested h3 variants |
| Seroval | `1.8.1` | Actual framework request/response serialization in compiled checks |
| Zod | `3.25.76` | Authoritative input schemas and controlled max/key-budget mechanism proof |
| MongoDB driver | `7.9.0` root; `6.22.0` nested lock | Connection/query/index source review; no actual database connected |
| Gitleaks | `8.30.1`, existing trusted temporary official install | Current files and all-history secret scans, `--redact=100`; 6/27 raw detections require contextual validation |
| Custom lexical/history/integrity checks | Audit-owned readable source under `scripts/` and `agent-supply/` | Whole-tree locations and redacted comparisons; not equivalent to Semgrep/CodeQL/SBOM or exhaustive semantic security proof |

The npm CLI audit attempts failed DNS/timeouts and are not labelled successful scans. A fresh official `/-/npm/v1/security/advisories/bulk` request subsequently succeeded via curl, covering 811 package names and root/nested resolved versions. It returned esbuild, minimatch, Vite and Zod advisories. The dependency inventory records advisory IDs, affected installed instances, reachability and patch guidance; a current advisory response does not prove absence of undisclosed/unreported vulnerabilities.

Gitleaks was absent from PATH but recovered from the pre-existing audit's recorded temporary installation. Its prior provenance records official release archive SHA256 `dfe101a4db2255fc85120ac7f3d25e4342c3c20cf749f2c20a18081af1952709`, matching current official release metadata. A fresh download timed out partway; the incomplete archive was not extracted or executed. The trusted pre-existing binary was reused, its current hash recorded, and its actual scan results retained. This does not claim a newly successful download/verification. See [session-gitleaks-reused-provenance.json](evidence/session-gitleaks-reused-provenance.json), [session-gitleaks-verification.json](evidence/session-gitleaks-verification.json), and historical `gitleaks-installation.json`.

Current scanner configuration extends Gitleaks defaults and excludes dependency/build/cache/audit trees. Current private `.env` files and tracked source/history remain in scope. Supplemental secret-history analysis covers missed DB/admin assignments and confirms reuse. Reported match/secret fields were removed from the shareable scanner evidence. Scanner positives are not counted as 33 distinct vulnerabilities.

## Available but not used

`npx` is available; it was not used to download arbitrary executables. `@playwright/test 1.65.1` is installed as a project development dependency; no browser-based security suite or approved browser DAST session was executed. Java's launcher exists, but no functioning ZAP installation was found. Codex TUI worktree tools are exposed, with no specialist security scanner or cloud/provider connector in this session.

## Not installed / not callable

PATH discovery found no Semgrep, CodeQL, OWASP ZAP/zaproxy, Trivy, Grype, OSV Scanner, pip-audit, Bandit, Checkov, Sonar scanner, Syft, Docker, pnpm, yarn or bun. Dependency-Track/SonarQube service connectors and suitable cloud read-only connectors were not exposed. Python analyzers do not fit the application runtime; container/IaC tools have no actual Docker/Kubernetes/terraform target here.

Current Semgrep metadata in the pre-existing official PyPI record is version `1.187.0`, requiring Python ≥3.10. Only Python 3.9 was available; no newer interpreter, uv, pipx, Go or Homebrew was found. An obsolete scanner or untrusted binary was not installed to conceal this gap. CodeQL and SBOM vulnerability feeds were not substituted with invented results. OSV/Gitleaks public release metadata was inspected where available, but OSV itself was not installed or run. No package manifests/lockfiles were changed.

## Assessment standards and source provenance

| Standard | Version / state | Official source |
|---|---|---|
| OWASP Top 10 | 2025 published release | <https://owasp.org/Top10/2025/> |
| OWASP ASVS | 5.0.0 stable, 30 May 2025 | <https://owasp.org/www-project-application-security-verification-standard/> |
| OWASP WSTG | 4.2 stable; 5.0 under development | <https://owasp.org/www-project-web-security-testing-guide/> |
| OWASP API Security | Top 10:2023 | <https://owasp.org/API-Security/editions/2023/en/0x11-t10/> |

Fresh official page titles/version excerpts/response hashes are recorded in `evidence/session-reference-owasp-*.json`. Earlier inherited documentation fetches failed HTTP 308; the current curl-follow-redirect retrieval succeeded. This is a standards-guided assessment with disclosed gaps, not full ASVS certification.

