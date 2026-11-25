#!/usr/bin/env python3
"""Audit report quality checks, source preservation and execution-log generation."""
import hashlib, importlib.util, json, pathlib, re, subprocess

ROOT = pathlib.Path(__file__).resolve().parents[2]
AUDIT = ROOT / "security-audit"
spec = importlib.util.spec_from_file_location("support", AUDIT / "scripts/audit_support.py")
support = importlib.util.module_from_spec(spec)
spec.loader.exec_module(support)
before = json.loads((AUDIT / "evidence/session-baseline.json").read_text())
after = support.inventory()
changes, missing = [], []
for row in before["files"]:
    p = ROOT / row["path"]
    if not p.is_file():
        missing.append(row["path"])
    elif hashlib.sha256(p.read_bytes()).hexdigest() != row["sha256"]:
        changes.append(row["path"])
old_names = {r["path"] for r in before["files"]}
added = [r["path"] for r in after["files"] if r["path"] not in old_names]
integrity = {"time": support.utc(), "start_head": before["head"], "end_head": after["head"],
             "changed_outside_audit": changes, "missing_outside_audit": missing, "new_outside_audit": added,
             "head_unchanged": before["head"] == after["head"],
             "passed": not changes and not missing and not added and before["head"] == after["head"]}
support.write_json(AUDIT / "evidence/session-final-integrity.json", integrity)

records = []
for p in list((AUDIT / "evidence").glob("session-*.json")) + list((AUDIT / "agent-supply").glob("*.json")):
    try:
        d = json.loads(p.read_text())
    except (ValueError, OSError):
        continue
    if isinstance(d, dict) and "command" in d and "exit_code" in d:
        records.append((d.get("started", ""), str(p.relative_to(AUDIT)), d))
records.sort(key=lambda row: row[0])
lines = ["# Security execution log", "", f"Current revision: `{before['head']}`. Date: 25 November 2026.", "",
         "Commands below actually ran. Exit 1 can mean detected secrets or intentionally demonstrated defects, rather than a scanner failure. Preserved failed attempts are not reported as passes. File/skill/source reads and manual review are listed separately from runnable test/scanner records.", "",
         "## Recorded commands", "", "| UTC start / working directory | Command | Exit / outcome | Evidence |", "|---|---|---|---|"]
for started, name, d in records:
    cmd = support.redact(d["command"]).replace("|", "\\|").replace("\n", " ")
    outcome = str(d["exit_code"])
    if "gitleaks" in d["command"] and d["exit_code"] == 1:
        outcome += " — completed with detections"
    elif "eslint" in d["command"] and d["exit_code"] != 0:
        outcome += " — lint issues, preserved"
    elif "npm" in d["command"] and d["exit_code"] != 0:
        outcome += " — inspect recorded audit/network error"
    elif "built_handler" in d["command"] and d["exit_code"] != 0:
        outcome += " — harness setup/assertion error; final run separately passed"
    elif d["exit_code"] == 0:
        outcome += " — completed"
    else:
        outcome += " — failed/limited; see record"
    lines.append(f"| {started[:19]} / `{d.get('cwd', '.')}` | `{cmd}` | {outcome} | [{name}]({name}) |")
lines += ["", "## Read-only discovery and source review", "",
          "- `pwd`, `git status --short`, `git ls-files`, `git rev-parse HEAD`, `git branch --show-current`, and `rg --files` (including hidden/configuration inventory with dependency/build exclusions). Available skill paths were discovered under the actual skill/plugin directories before use.",
          "- `python3` PATH/version probes for Semgrep, CodeQL, ZAP, Gitleaks, Trivy, Grype, OSV, npm/pnpm/yarn/bun, Python analyzers, Checkov/Sonar/Syft, Docker, Node, Python and Git; follow-up compatible Python/uv/pipx/Go/Homebrew discovery. Exact availability/version results appear in the tool inventory.",
          "- `codex --version` and `codex plugin list --json`: exit 0, only Taste plugin installed; nonfatal sandbox PATH-alias warning. See `evidence/session-plugin-discovery.json`.",
          "- `cat`/numbered redacted reads of skills, package/configuration/docs, all backend modules, every API, framework session/serialization/CSRF implementation, active frontend integrations, test fixtures and previous audit scripts/evidence. `rg` followed dangerous sinks, network calls, browser storage and function references; relevant findings were traced manually rather than accepted as scanner hits.",
          "- `python3 security-audit/scripts/prepare_isolated_build.py`: copied 164 build inputs into ignored audit cache, symlinked existing dependencies, copied no `.env`/Git/production credentials and changed no build config. Production build used a separate preload after sanitized environment setup.",
          "- `node /Users/john/.codex/skills/.system/openai-docs/scripts/fetch-codex-manual.mjs`: first attempt failed sandbox DNS (curl exit 6), mandated escalated retry succeeded and refreshed official manual in writable temporary cache. Relevant plugin/scan sections were actually read. No Codex Security installation or scan was performed.",
          "- Official OWASP/release metadata retrieval used `public_references.py`; sandbox attempts failed DNS, escalated metadata reads succeeded. Gitleaks archive download timed out after receiving a partial file; partial archive was not extracted/run. Prior trusted temporary official binary was reused with provenance and current binary hash recorded.",
          "- Gitleaks result JSON was reduced to RuleID/path/line/commit/fingerprint/date, dropping Secret/Match fields before shareable evidence. Supplemental Git history scans emitted boolean current-secret matches only. No credential was authenticated against any service.",
          "", "The backend review has a detailed per-read/initial-test log at [agent-backend/EXECUTION_LOG.md](agent-backend/EXECUTION_LOG.md); payment/media command runs and coverage are in [agent-payments/ASSESSMENT.md](agent-payments/ASSESSMENT.md). Supply agent records each external query separately. The final log intentionally excludes inherited prior execution files as current runs, except clearly labelled provenance/advisory evidence.",
          "", "## Test environment and isolation", "",
          "Root audit runners strip inherited secret/API/provider/database environment variables. Vitest audit configs disable env-file loading and use `no-network.cjs` to reject sockets, HTTP, DNS SRV, global fetch and process env-file loading. Tests stub synthetic values/providers/sessions/GridFS, or inject process-local MemoryMongo through the existing Mongo cache. Actual h3 cryptography and production-compiled framework middleware are used where stated. No local TCP listener/browser or external application target was scanned.",
          "", "A preliminary build inherited NODE_ENV=test from the clean runner. Its first compiled checks passed 13/15; serialized-false matching and expected cookie flags were also incorrect. That artifact is not used to claim production cookie weakness. A production-only preload corrected build mode, response decoding was changed to the actual Seroval cross-JSON API with a reference map, and the final 15/15 compiled checks passed. Intermediate Seroval API/setup errors remain in their command records; the first 13/15 result is preserved separately. These were audit-harness errors, not application vulnerabilities.",
          "", "The independent backend harness initially passed 6/8 twice while two concurrency tests hit the protective env-loading guard because a dynamic-import mock was unreliable. No connection or env read occurred. The harness was corrected to populate the app's cached DB promise with isolated MemoryMongo, then passed 8/8 and final 11/11. Both initial failures remain archived.",
          "", "## Final functional outcomes", "",
          "- Existing application tests: 64 passed. Current pre-existing audit rerun: 41 passed. Independent backend: 11 passed. Payment/media: 46 passed. Final total: 162 tests, zero final failures/skips in those suites. Many audit assertions demonstrate current defects.",
          "- Compiled request-handler checks: 15 passed; resolver inventory 44 functions. Separate bounded Zod proof completed. TypeScript check and authentic isolated production build passed.",
          "- Lint failed. First run included existing generated Next output: 954 errors/11 warnings. Source-scoped rerun excluding generated `.next`/dependencies: 720 errors/11 warnings. No auto-fix was executed.",
          "- Gitleaks current/history completed with detections (6/27 raw results), not 33 confirmed vulnerabilities. Supplemental exact-value/history analysis validates SEC-001; false positives/local-only values are separated in supply evidence.",
          "- Dependency scanner/query failures and fresh/historical advisory status are detailed in [DEPENDENCY_RISK_INVENTORY.md](DEPENDENCY_RISK_INVENTORY.md); failed npm audit was never reported as a successful clean scan.",
          "", "## Skipped / inapplicable operations", "",
          "Official Codex Security standard/deep scans were unavailable. Semgrep/CodeQL/ZAP/OSV/container/SBOM scanners were absent or incompatible. No live/staging/cloud/DB access was supplied. Native MongoDB replica-set concurrency/index/backup verification, provider sandbox transactions, browser DAST/XSS execution and deployed TLS/CDN/WAF policy tests remain gaps. Customer registration/reset/JWT-refresh/MFA, GraphQL, queues/cron and container/IaC tests are inapplicable where those features do not exist; dormant Supabase infrastructure was source reviewed only.",
          "", "No production data modification, real DB query, seed execution, charge/refund/provider authentication, email/notification, arbitrary IP/metadata/internal service scan, destructive operation, deployment, code/dependency fix, schema/generated-file edit, commit/history rewrite or push occurred.",
          "", "## Final preservation / artifact checks", "",
          f"Current baseline comparison: **{'PASS' if integrity['passed'] else 'FAIL'}**; HEAD unchanged: `{integrity['head_unchanged']}`; modified non-audit files: {len(changes)}; missing: {len(missing)}; added: {len(added)}. See [session-final-integrity.json](evidence/session-final-integrity.json).", "",
          "Report-link/required-document and redacted-evidence quality results are in `evidence/session-report-quality.json`. No substantive fixes were applied; the remediation plan awaits authorization.", ""]
(AUDIT / "SECURITY_EXECUTION_LOG.md").write_text("\n".join(lines))

required = ["SECURITY_AUDIT_REPORT.md", "SECURITY_FINDINGS.md", "SECURITY_REMEDIATION_PLAN.md", "SECURITY_TEST_MATRIX.md", "SECURITY_TOOL_INVENTORY.md", "SECURITY_EXECUTION_LOG.md", "THREAT_MODEL.md", "DEPENDENCY_RISK_INVENTORY.md"]
absent = [name for name in required if not (AUDIT / name).is_file()]
broken = []
for name in required:
    p = AUDIT / name
    if not p.exists():
        continue
    for target in re.findall(r"\]\(([^)]+)\)", p.read_text()):
        if target.startswith(("https:", "http:", "#")):
            continue
        target = target.split("#")[0]
        if not (p.parent / target).exists():
            broken.append({"document": name, "target": target})
secret_matches = []
values = support.secret_values()
for p in AUDIT.rglob("*"):
    if not p.is_file() or any(part in [".cache", "cache", "__pycache__"] for part in p.relative_to(AUDIT).parts):
        continue
    try:
        body = p.read_text()
    except (UnicodeError, OSError):
        continue
    for value in values:
        if value in body and not re.search(r"example|placeholder|your[_-]|<", value, re.I):
            secret_matches.append({"path": str(p.relative_to(AUDIT)), "exact_secret_match": True})
            break
quality = {"time": support.utc(), "required_documents": required, "missing_documents": absent, "broken_relative_links": broken,
           "configured_secret_exact_matches_in_shareable_artifacts": secret_matches, "integrity_passed": integrity["passed"],
           "passed": not absent and not broken and not secret_matches and integrity["passed"]}
support.write_json(AUDIT / "evidence/session-report-quality.json", quality)
print(json.dumps({"integrity": integrity, "quality": quality}, indent=2))
raise SystemExit(0 if quality["passed"] else 1)

