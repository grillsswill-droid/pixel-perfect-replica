#!/usr/bin/env python3
"""Whole tracked-tree triage. Reports locations only; not a substitute for SAST."""
import collections, hashlib, importlib.util, json, pathlib, re, subprocess

ROOT = pathlib.Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("support", ROOT / "security-audit/scripts/audit_support.py")
support = importlib.util.module_from_spec(spec)
spec.loader.exec_module(support)

patterns = {
    "code_execution": r"\beval\s*\(|\bnew\s+Function\s*\(|child_process|\bexecSync\s*\(|\bspawn\s*\(",
    "html_sink": r"dangerouslySetInnerHTML|\.innerHTML\s*=|document\.write\s*\(|insertAdjacentHTML",
    "query_operator": r"\$where|\$function|\$expr|\$regex|\.aggregate\s*\(",
    "file_operation": r"readFile|writeFile|createReadStream|createWriteStream|GridFS|extract|unzip",
    "external_network": r"\bfetch\s*\(|https?\.request|axios|XMLHttpRequest|WebSocket",
    "redirect": r"redirect\s*\(|location\.(?:href|assign|replace)|\"location\"\s*:",
    "crypto_session": r"useSession|createHmac|timingSafeEqual|randomUUID|JWT|jwt|password|passcode",
    "browser_storage": r"localStorage|sessionStorage|persistSession|Authorization",
    "security_config": r"createCsrfMiddleware|sameSite|httpOnly|secure:|access-control|Content-Security-Policy|rate.limit",
    "database_operation": r"\.findOne\s*\(|\.find\s*\(|\.insertOne\s*\(|\.updateOne\s*\(|\.deleteOne\s*\(|\.deleteMany\s*\(|\.withTransaction\s*\(",
}
inventory = support.inventory()
rows, counts, text_count, binary_count = [], collections.Counter(), 0, 0
for row in inventory["files"]:
    path = ROOT / row["path"]
    raw = path.read_bytes()
    if b"\0" in raw[:8192]:
        binary_count += 1
        continue
    text_count += 1
    content = raw.decode(errors="replace")
    for label, pattern in patterns.items():
        for match in re.finditer(pattern, content, re.I):
            line = content.count("\n", 0, match.start()) + 1
            rows.append({"path": row["path"], "line": line, "pattern": label, "category": row["category"]})
            counts[label] += 1
result = {"time": support.utc(), "revision": inventory["head"], "files_inventoried": len(inventory["files"]),
          "text_files_read": text_count, "binary_files_hashed_only": binary_count, "pattern_counts": dict(counts),
          "matches": rows, "limitation": "Lexical triage only. Matches are not vulnerabilities. Generated files, assets, locks and vendored skills included in inventory; application paths receive manual flow review."}
support.write_json(support.EVIDENCE / "session-static-triage.json", result)
print(json.dumps({k: v for k, v in result.items() if k != "matches"}, indent=2))

