#!/usr/bin/env python3
"""Read published standards and verify an official Gitleaks archive before use."""
import hashlib, html, importlib.util, json, pathlib, re, subprocess, tarfile, tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("support", ROOT / "security-audit/scripts/audit_support.py")
support = importlib.util.module_from_spec(spec)
spec.loader.exec_module(support)
references = {
    "owasp-top10-2025": "https://owasp.org/Top10/2025/",
    "owasp-asvs": "https://owasp.org/www-project-application-security-verification-standard/",
    "owasp-wstg": "https://owasp.org/www-project-web-security-testing-guide/",
    "owasp-api-2023": "https://owasp.org/API-Security/editions/2023/en/0x11-t10/",
    "gitleaks-release": "https://api.github.com/repos/gitleaks/gitleaks/releases/tags/v8.30.1",
}
failed = False
for name, url in references.items():
    process = subprocess.run(["curl", "-sS", "-L", "--max-time", "25", "--fail", url], capture_output=True, timeout=30)
    record = {"url": url, "time": support.utc(), "exit": process.returncode}
    if process.returncode:
        record["error"] = process.stderr.decode(errors="replace")[:500]
        failed = True
    else:
        body = process.stdout.decode(errors="replace")
        record["sha256"] = hashlib.sha256(process.stdout).hexdigest()
        if name == "gitleaks-release":
            data = json.loads(body)
            record.update({"tag": data["tag_name"], "release_url": data["html_url"], "assets": [
                {"name": asset["name"], "url": asset["browser_download_url"], "digest": asset.get("digest")}
                for asset in data["assets"] if asset["name"] == "gitleaks_8.30.1_darwin_x64.tar.gz"]})
        else:
            title = re.search(r"<title[^>]*>(.*?)</title>", body, re.S | re.I)
            record["title"] = html.unescape(title[1]).strip() if title else None
            text = html.unescape(re.sub(r"<[^>]*>", " ", body))
            text = re.sub(r"\s+", " ", text)
            record["version_excerpts"] = [text[max(0, m.start()-110): m.end()+170] for m in re.finditer(r"5\.0\.0|5\.0|4\.2|stable|2025|2023", text, re.I)][:18]
    support.write_json(support.EVIDENCE / ("session-reference-" + name + ".json"), record)
    print(name, "OK" if process.returncode == 0 else "FAILED")

release_path = support.EVIDENCE / "session-reference-gitleaks-release.json"
release = json.loads(release_path.read_text())
if not release.get("exit") and release.get("assets"):
    asset = release["assets"][0]
    destination = pathlib.Path(tempfile.mkdtemp(prefix="grill-swill-audit-verified-"))
    archive = destination / asset["name"]
    process = subprocess.run(["curl", "-sS", "-L", "--max-time", "45", "--fail", "--output", str(archive), asset["url"]], capture_output=True, timeout=50)
    digest = hashlib.sha256(archive.read_bytes()).hexdigest() if process.returncode == 0 else None
    expected = (asset.get("digest") or "").removeprefix("sha256:")
    record = {"source": asset["url"], "time": support.utc(), "version": "8.30.1", "exit": process.returncode,
              "sha256": digest, "expected_sha256": expected, "official_digest_verified": bool(digest and expected and digest == expected)}
    if record["official_digest_verified"]:
        with tarfile.open(archive) as tar:
            member = next(m for m in tar.getmembers() if m.name == "gitleaks" and m.isfile())
            binary = destination / "gitleaks"
            binary.write_bytes(tar.extractfile(member).read())
            binary.chmod(0o755)
        record["binary"] = str(binary)
        record["binary_sha256"] = hashlib.sha256(binary.read_bytes()).hexdigest()
    else:
        failed = True
        record["error"] = process.stderr.decode(errors="replace")[:500] or "Archive digest missing or mismatched; executable not used"
    support.write_json(support.EVIDENCE / "session-gitleaks-verification.json", record)
    print("Gitleaks archive", "VERIFIED" if record["official_digest_verified"] else "FAILED")
raise SystemExit(1 if failed else 0)

