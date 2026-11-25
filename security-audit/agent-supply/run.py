#!/usr/bin/env python3
"""Run audit-only tools with sanitized environment and redacted evidence."""
import argparse, importlib.util, json, os, re, shlex, subprocess, time
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('audit_support', ROOT / 'security-audit/scripts/audit_support.py')
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
p = argparse.ArgumentParser()
p.add_argument('--id', required=True)
p.add_argument('--cwd', default='.')
p.add_argument('--timeout', type=int, default=60)
p.add_argument('command', nargs=argparse.REMAINDER)
a = p.parse_args()
cmd = a.command[1:] if a.command[:1] == ['--'] else a.command
env = {k:v for k,v in os.environ.items() if not helper.SECRET_NAME.search(k) and not k.startswith(('VITE_', 'SUPABASE_', 'FLUTTERWAVE_', 'FLW_', 'AWS_', 'SMTP_', 'MONGODB_', 'LOVABLE_'))}
env.update({'CI':'1', 'NO_COLOR':'1', 'npm_config_cache':str(OUT/'cache')})
tick = time.monotonic()
started = helper.utc()
try:
    r = subprocess.run(cmd, cwd=ROOT / a.cwd, env=env, capture_output=True, text=True, timeout=a.timeout)
    code, stdout, stderr = r.returncode, r.stdout, r.stderr
except subprocess.TimeoutExpired:
    code, stdout, stderr = 124, '', 'Audit timeout reached; subprocess stopped.'
except OSError as e:
    code, stdout, stderr = 127, '', str(e)
def redact_output(value):
    value = helper.redact(value)
    return re.sub(r'(?im)^(set-cookie|authorization|proxy-authorization|cookie):.*$', r'\1: [REDACTED]', value)
record = {'id':a.id, 'started':started, 'finished':helper.utc(), 'duration_seconds':round(time.monotonic()-tick,3), 'command':shlex.join(cmd), 'cwd':a.cwd, 'environment':'sensitive variables stripped; audit-only npm cache', 'exit_code':code, 'stdout':redact_output(stdout), 'stderr':redact_output(stderr)}
OUT.mkdir(parents=True, exist_ok=True)
(OUT/(a.id+'.json')).write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({k:v for k,v in record.items() if k not in ('stdout','stderr')},indent=2))
try:
    d=json.loads(record['stdout'])
    if 'vulnerabilities' in d:
        print(json.dumps({'metadata':d.get('metadata'), 'error':d.get('error'), 'packages':list(d.get('vulnerabilities',{}))},indent=2))
    else: print(record['stdout'][:2000])
except ValueError: print(record['stdout'][:2000])
print(record['stderr'][:2000])
raise SystemExit(code)
