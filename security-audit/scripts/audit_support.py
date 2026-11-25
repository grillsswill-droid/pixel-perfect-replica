#!/usr/bin/env python3
"""Audit-only redacted reads, command recording, and integrity snapshots."""
import argparse, datetime, hashlib, json, os, re, shlex, subprocess, sys, time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
AUDIT=ROOT/"security-audit"
EVIDENCE=AUDIT/"evidence"
BACKUP=Path("/private/tmp/grill-swill-security-audit-backup")
SECRET_NAME=re.compile(r"SECRET|TOKEN|PASSWORD|PASSWD|PASSCODE|API_KEY|PRIVATE_KEY|ENCRYPTION_KEY|PUBLIC_KEY|DATABASE_URL|MONGODB_URI|MONGO_URL|ACCESS_KEY|CONNECTION_STRING|CREDENTIAL",re.I)
PATTERNS=[
 ("database_uri",re.compile(r"""(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis)://[^\s"\x27<>\x60]+""",re.I)),
 ("jwt",re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b")),
 ("provider_key",re.compile(r"\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{8,}\b|\bFLW(?:SECK|PUBK|ENCK)[A-Za-z0-9_-]{8,}\b|\bgh[pousr]_[A-Za-z0-9]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b|\bAKIA[0-9A-Z]{16}\b|\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b")),
 ("private_key",re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"))
]
def utc(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def env_files(): return [p for base in (ROOT,ROOT/"my-mongodb-app") for p in sorted(base.glob(".env*")) if p.is_file()]
def secret_values():
 values=[]
 for p in env_files():
  for line in p.read_text(errors="replace").splitlines():
   m=re.match(r"\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$",line)
   if m and SECRET_NAME.search(m[1]):
    value=m[2].strip().strip("\"'")
    if len(value)>=8: values.append(value)
 for key,value in os.environ.items():
  if SECRET_NAME.search(key) and len(value)>=8: values.append(value)
 return sorted(set(values),key=len,reverse=True)
def redact(value):
 value=str(value)
 for secret in secret_values(): value=value.replace(secret,"[REDACTED]")
 for name,pattern in PATTERNS: value=pattern.sub("[REDACTED:"+name+"]",value)
 value=re.sub(r"(?im)^(\s*(?:export\s+)?[A-Z0-9_]*(?:SECRET|PASSWORD|PASSCODE|TOKEN|API_KEY|ENCRYPTION_KEY|DATABASE_URL|MONGODB_URI)[A-Z0-9_]*\s*=).*$",r"\1[REDACTED]",value)
 return value
def write_json(path,value):
 path.parent.mkdir(parents=True,exist_ok=True)
 content=redact(json.dumps(value,indent=2,ensure_ascii=False))+"\n"
 path.write_text(content)
 if path.is_relative_to(AUDIT):
  backup=BACKUP/path.relative_to(AUDIT)
  backup.parent.mkdir(parents=True,exist_ok=True); backup.write_text(content)
def git(*args): return subprocess.check_output(["git",*args],cwd=ROOT).decode(errors="replace")
def inventory():
 tracked=git("ls-files","-z").split("\0")
 names=sorted(set(tracked+git("ls-files","--others","--exclude-standard","-z").split("\0")))
 rows=[]
 for name in names:
  p=ROOT/name
  if not name or name.startswith("security-audit/") or not p.is_file(): continue
  b=p.read_bytes()
  category="vendored_skill" if name.startswith(".agents/") else "browser_profile_artifact" if name.startswith(".taste-skill/chrome-before/") else "asset" if name.startswith(("lovimg/","src/assets/","public/fonts/",".taste-skill/shots/")) else "dependency_lock" if name.endswith(("lock.json","bun.lock")) else "legacy_database" if name.startswith("drizzle/") else "application"
  rows.append({"path":name,"tracked":name in tracked,"category":category,"bytes":len(b),"sha256":hashlib.sha256(b).hexdigest(),"text":b"\0" not in b[:8192]})
 return {"time":utc(),"head":git("rev-parse","HEAD").strip(),"branch":git("branch","--show-current").strip(),"status":git("status","--short"),"files":rows}
def main():
 p=argparse.ArgumentParser(); sub=p.add_subparsers(dest="action",required=True)
 for n in ("baseline","verify","env"): sub.add_parser(n)
 s=sub.add_parser("show"); s.add_argument("files",nargs="+"); s.add_argument("--start",type=int,default=1); s.add_argument("--end",type=int)
 r=sub.add_parser("run"); r.add_argument("--id",required=True); r.add_argument("--cwd",default="."); r.add_argument("--timeout",type=int,default=90); r.add_argument("--clean-env",action="store_true"); r.add_argument("--print-limit",type=int,default=10000); r.add_argument("command",nargs=argparse.REMAINDER)
 args=p.parse_args()
 if args.action=="show":
  for name in args.files:
   path=Path(name); path=path if path.is_absolute() else ROOT/path
   lines=redact(path.read_text(errors="replace")).splitlines()
   print("\nFILE "+str(path)+" ("+str(len(lines))+" lines)")
   for i in range(args.start-1,min(args.end or len(lines),len(lines))): print(str(i+1)+": "+lines[i])
 elif args.action=="baseline":
  result=inventory(); write_json(EVIDENCE/"baseline.json",result)
  print(json.dumps({k:v for k,v in result.items() if k!="files"},indent=2)); print("Files:",len(result["files"]))
 elif args.action=="verify":
  before=json.loads((EVIDENCE/"baseline.json").read_text()); after=inventory(); changed=[]; missing=[]
  for row in before["files"]:
   path=ROOT/row["path"]
   if not path.is_file(): missing.append(row["path"])
   elif hashlib.sha256(path.read_bytes()).hexdigest()!=row["sha256"]: changed.append(row["path"])
  old=set(r["path"] for r in before["files"]); added=[r["path"] for r in after["files"] if r["path"] not in old]
  result={"time":utc(),"head_unchanged":before["head"]==after["head"],"changed_outside_audit":changed,"missing_outside_audit":missing,"new_outside_audit":added,"passed":not changed and not missing and not added and before["head"]==after["head"]}
  write_json(EVIDENCE/"integrity-verification.json",result); print(json.dumps(result,indent=2)); return 0 if result["passed"] else 1
 elif args.action=="env":
  result=[]
  for path in env_files():
   entries=[]
   for n,line in enumerate(path.read_text(errors="replace").splitlines(),1):
    m=re.match(r"\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$",line)
    if m:
     v=m[2].strip().strip("\"'"); entries.append({"line":n,"name":m[1],"set":bool(v),"placeholder":not v or bool(re.search(r"<|your[_-]|example|placeholder|REPLACE|changeme",v,re.I)),"sensitive_name":bool(SECRET_NAME.search(m[1]))})
   name=str(path.relative_to(ROOT)); result.append({"path":name,"ignored":subprocess.run(["git","check-ignore","-q",name],cwd=ROOT).returncode==0,"mode":oct(path.stat().st_mode&0o777),"variables":entries})
  write_json(EVIDENCE/"environment-inventory.json",result); print(json.dumps(result,indent=2))
 elif args.action=="run":
  command=args.command[1:] if args.command and args.command[0]=="--" else args.command
  env=dict(os.environ)
  if args.clean_env:
   for key in list(env):
    if SECRET_NAME.search(key) or key.startswith(("VITE_","SUPABASE_","FLUTTERWAVE_","FLW_","AWS_","SMTP_","MONGODB_","CODEX_SECURITY_")): env.pop(key,None)
   env.update({"NODE_ENV":"test","CI":"1","NO_COLOR":"1"})
  started=utc(); tick=time.monotonic()
  try:
   result=subprocess.run(command,cwd=ROOT/args.cwd,env=env,capture_output=True,text=True,timeout=args.timeout); code,stdout,stderr=result.returncode,result.stdout,result.stderr
  except subprocess.TimeoutExpired as e:
   code=124; stdout=(e.stdout or b"").decode(errors="replace") if isinstance(e.stdout,bytes) else e.stdout or ""; stderr="Audit timeout reached; process stopped."
  except OSError as e: code,stdout,stderr=127,"",type(e).__name__+": "+str(e)
  record={"id":args.id,"started":started,"finished":utc(),"seconds":round(time.monotonic()-tick,3),"cwd":args.cwd,"command":shlex.join(command),"clean_env":args.clean_env,"exit_code":code,"stdout":redact(stdout),"stderr":redact(stderr)}
  write_json(EVIDENCE/(args.id+".json"),record)
  print("Command: "+record["command"]+"\nExit: "+str(code)+"; seconds: "+str(record["seconds"])); print(record["stdout"][:args.print_limit]); print(record["stderr"][:args.print_limit]); return code
 return 0
if __name__=="__main__": sys.exit(main())

