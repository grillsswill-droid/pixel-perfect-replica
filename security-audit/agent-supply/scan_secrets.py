#!/usr/bin/env python3
"""Supplemental redacted secret and git-history review; never emits matched values."""
import collections, importlib.util, json, math, os, re, subprocess, time
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('audit_support', ROOT / 'security-audit/scripts/audit_support.py')
helper = importlib.util.module_from_spec(spec); spec.loader.exec_module(helper)
tick=time.monotonic()
def git(*args): return subprocess.check_output(['git',*args],cwd=ROOT).decode(errors='replace')
def placeholder(v):
    return not v or bool(re.search(r'<|your[_ -]|example|placeholder|replace|changeme|test[_-]secret|[xX]{8,}|test[_-]only|do[_-]not[_-]use|a{16,}|b{16,}',v,re.I))
def assignments(txt):
    for i,line in enumerate(txt.splitlines(),1):
        m=re.match(r'\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$',line)
        if m and helper.SECRET_NAME.search(m[1]):
            v=m[2].strip().strip('\"\'')
            yield i,m[1],v
local=[]; current_values={}
for p in helper.env_files():
    tracked=git('ls-files','--',str(p.relative_to(ROOT))).strip()!=''
    rows=[]
    for i,k,v in assignments(p.read_text(errors='replace')):
        rows.append({'line':i,'variable':k,'set':bool(v),'length':len(v),'placeholder':placeholder(v)})
        if v and not placeholder(v): current_values[v]=k
    local.append({'path':str(p.relative_to(ROOT)),'tracked':tracked,'mode':oct(p.stat().st_mode&0o777),'variables':rows})
historical=[]; formats=[]; commits=int(git('rev-list','--all','--count').strip())
objects=git('rev-list','--objects','--all').splitlines(); count=0; errors=[]
paths=collections.defaultdict(list)
for line in objects:
    oid,_,name=line.partition(' ')
    if name: paths[oid].append(name)
for oid,names in paths.items():
    try:
        if git('cat-file','-t',oid).strip()!='blob': continue
        b=subprocess.check_output(['git','cat-file','blob',oid],cwd=ROOT); count+=1
        if b'\0' in b[:8192]: continue
        txt=b.decode(errors='replace')
        name=names[0]
        if re.search(r'(^|/)\.env(?:\.|$)|\.dev\.vars$',name):
            for i,k,v in assignments(txt):
                if not v: continue
                historical.append({'object':oid,'path':name,'line':i,'variable':k,'length':len(v),'placeholder':placeholder(v),'equals_configured_local_secret':v in current_values,'classification':'placeholder' if placeholder(v) else 'credential_literal_needs_review'})
        for rule,pat in helper.PATTERNS:
            for match in pat.finditer(txt):
                v=match[0]
                formats.append({'object':oid,'path':name,'line':txt.count('\n',0,match.start())+1,'rule':rule,'length':len(v),'placeholder':placeholder(v),'equals_configured_local_secret':v in current_values,'test_file':bool(re.search(r'test|spec|security-audit',name))})
    except Exception as e: errors.append({'object':oid,'paths':names,'error':type(e).__name__})
worktree=[]
tracked=git('ls-files','-z').split('\0')
for name in tracked:
    p=ROOT/name
    if not p.is_file() or name.startswith('security-audit/'): continue
    b=p.read_bytes()
    if b'\0' in b[:8192]: continue
    txt=b.decode(errors='replace')
    for rule,pat in helper.PATTERNS:
        for match in pat.finditer(txt):
            v=match[0]
            worktree.append({'path':name,'line':txt.count('\n',0,match.start())+1,'rule':rule,'length':len(v),'placeholder':placeholder(v),'equals_configured_local_secret':v in current_values,'test_file':bool(re.search(r'test|spec',name))})
    for v,k in current_values.items():
        if v in txt:
            worktree.append({'path':name,'variable':k,'line':txt.count('\n',0,txt.index(v))+1,'rule':'configured_secret_exact_match'})
public_build=[]; build_count=0
for base in [ROOT/'.output/public',ROOT/'dist/client',ROOT/'dist',ROOT/'my-mongodb-app/.next/static']:
    if not base.is_dir(): continue
    for p in base.rglob('*'):
        if not p.is_file(): continue
        build_count+=1
        b=p.read_bytes()
        if b'\0' in b[:8192]: continue
        txt=b.decode(errors='replace')
        for v,k in current_values.items():
            if v in txt: public_build.append({'path':str(p.relative_to(ROOT)),'variable':k,'rule':'configured_secret_exact_match'})
result={'started':helper.utc(),'seconds':round(time.monotonic()-tick,3),'command':'python3 security-audit/agent-supply/scan_secrets.py','environment':'local filesystem/git read only; no credentials used','history_commits':commits,'history_object_entries':len(objects),'history_unique_blobs':count,'local_environment':local,'historical_environment_literals':historical,'historical_format_candidates':formats,'working_tree_format_candidates':worktree,'public_build_files_scanned':build_count,'public_build_exact_secret_matches':public_build,'errors':errors,'limitations':['Supplemental regex/exact matching is not a proof of secret absence.','Provider secrets are never authenticated or revoked.','History object paths may be first occurrence only; all blob data inspected.','Configured build artifacts may be stale and are not proof of production bundle state.']}
(OUT/'secret-review.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k not in ('historical_format_candidates','working_tree_format_candidates')},indent=2))
print(json.dumps({'history_format_candidates':len(formats),'worktree_format_candidates':len(worktree)},indent=2))
