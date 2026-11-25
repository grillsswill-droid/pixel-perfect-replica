#!/usr/bin/env python3
"""Copy only build inputs; never copy .env, Git, caches or production credentials."""
import hashlib, importlib.util, json, os, pathlib, shutil

ROOT = pathlib.Path(__file__).resolve().parents[2]
TARGET = ROOT / "security-audit/.cache/isolated-app"
TARGET.mkdir(parents=True, exist_ok=True)
files = ["package.json", "package-lock.json", "vite.config.ts", "tsconfig.json", "components.json"]
copied = []
for name in files:
    source = ROOT / name
    if source.is_file():
        shutil.copy2(source, TARGET / name)
        copied.append(name)
for name in ["src", "public"]:
    shutil.copytree(ROOT / name, TARGET / name, dirs_exist_ok=True)
    copied.extend(str(p.relative_to(ROOT)) for p in (ROOT / name).rglob("*") if p.is_file())
node_modules = TARGET / "node_modules"
if not node_modules.exists():
    node_modules.symlink_to(ROOT / "node_modules", target_is_directory=True)
spec = importlib.util.spec_from_file_location("support", ROOT / "security-audit/scripts/audit_support.py")
support = importlib.util.module_from_spec(spec)
spec.loader.exec_module(support)
support.write_json(support.EVIDENCE / "session-build-copy.json", {"target": str(TARGET), "time": support.utc(), "copied": copied,
                   "environment_files_copied": False, "node_modules": "existing dependencies symlinked; no installs", "config_modified": False})
print("Isolated build inputs copied:", len(copied))

