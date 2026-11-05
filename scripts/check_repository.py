from pathlib import Path
import re, subprocess, sys
root = Path(__file__).resolve().parents[1]
paths = subprocess.check_output(['git', '-C', str(root), 'ls-files', '-z']).decode('utf-8').split('\0')
denied = {'node_modules', '.idea', '.vscode', 'runtime', 'dist', 'coverage', '__pycache__'}
secrets = re.compile(r'(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-proj-[A-Za-z0-9_-]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)')
errors = []
for name in filter(None, paths):
    p = Path(name)
    if denied.intersection(p.parts) or (p.name.startswith('.env') and not p.name.endswith('.example')) or p.suffix in {'.key', '.pem', '.p12', '.pfx', '.db', '.sqlite', '.sqlite3'}:
        errors.append((name, 'forbidden path'))
    raw = (root / name).read_bytes()
    if b'\0' not in raw and secrets.search(raw.decode('utf-8', errors='ignore')):
        errors.append((name, 'possible credential'))
for name, reason in errors:
    print(f'{reason}: {name}')
print(f'Checked {len(list(filter(None, paths)))} tracked files; findings={len(errors)}')
sys.exit(bool(errors))
