#!/usr/bin/env bash

set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo_dir=$(git -C "$script_dir" rev-parse --show-toplevel)
prepare_only=false
if [[ ${1:-} == --help ]]; then
  echo "Usage: $0 [--prepare NEW_DIRECTORY] [SOURCE_REF (default: main)]"
  exit 0
fi
if [[ ${1:-} == --prepare ]]; then
  [[ $# -ge 2 ]] || { echo '--prepare needs a new output directory' >&2; exit 1; }
  prepare_only=true
  publish_dir=$2
  shift 2
fi
[[ $# -le 1 ]] || { echo 'Too many arguments' >&2; exit 1; }
source_ref=${1:-main}
source_commit=$(git -C "$repo_dir" rev-parse --verify "${source_ref}^{commit}")
if $prepare_only; then
  mkdir -- "$publish_dir"
  publish_dir=$(cd -- "$publish_dir" && pwd)
else
  publish_dir=$(mktemp -d "${TMPDIR:-/tmp}/meter-app-public.XXXXXXXX")
fi

# Export committed files only. Never switch branches, stage local files or share
# the private repository's object database with the public repository.
echo "Preparing $source_ref in $publish_dir"
git -C "$repo_dir" archive "$source_commit" | tar -x -C "$publish_dir"
cd -- "$publish_dir"
git apply --check patches/pub.patch
git apply patches/pub.patch
git apply --check patches/del.patch
git apply patches/del.patch

# Include the reviewed publishing tools before auditing, even if not on main yet.
cp -- "$script_dir/publish-branch.sh" bin/publish-branch.sh
cp -- "$repo_dir/docs/publishing.md" docs/publishing.md

# del.patch deletes pub.patch; del.patch itself also contains the private rows.
python3 - <<'PY'
from pathlib import Path
import re
import shutil

root = Path.cwd()
if any(path.is_symlink() for path in root.rglob('*')):
    raise SystemExit('Symlinks need review before publishing')
for name in ('patches', '.claude', '.codex', '.agents', '.vscode'):
    path = root / name
    if path.exists():
        shutil.rmtree(path)

# The existing patch removes readings and notes. Remove the remaining original
# meter/unit configuration and sequence state too, retaining the complete schema.
init = root / 'docker/db/sql/app/01_init.sql'
lines = []
skip = False
for line in init.read_text().splitlines():
    if line.startswith('-- Data for Name:'):
        skip = True
    elif line.startswith('-- Name:'):
        skip = 'Type: SEQUENCE SET;' in line
    if not skip and line.strip() and not line.startswith('--'):
        lines.append(line)
schema = '\n'.join(lines) + '\n'
for statement in schema.split(';'):
    if statement.strip() and not re.match(
        r'\A\s*(?:SET\s|SELECT pg_catalog\.set_config\(|CREATE TABLE public\.'
        r'|CREATE SEQUENCE public\.|ALTER SEQUENCE public\.|ALTER TABLE ONLY public\.)',
        statement,
    ):
        raise SystemExit('Unrecognized SQL in schema export; review the dump format')
if set(re.findall(r'CREATE TABLE public\.(\w+)', schema)) != {
    't_meter', 't_meter_type', 't_note', 't_unit', 't_value',
}:
    raise SystemExit('Unexpected application schema; review before publishing')
init.write_text('-- Public schema only; no application records.\n' + schema)

# Export only fixed, documented development settings, never local env overrides.
for path in root.rglob('*'):
    if path.is_file() and (path.name.startswith('.env') or path.name.endswith('.env')):
        path.unlink()
defaults = {
    'envs/app.local.env': 'VITE_AUTH_DISABLED=false\nVITE_OIDC_ISSUER=http://localhost:8081/realms/dev\nVITE_OIDC_CLIENT_ID=app\nVITE_OIDC_REDIRECT_URI=http://localhost:5173/auth/callback\nVITE_OIDC_POST_LOGOUT_REDIRECT_URI=http://localhost:5173\nVITE_OIDC_SCOPE="openid profile email"\nPORT=3001\n',
    'envs/service.local.env': 'DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres\nCORS_ORIGIN=http://localhost:5173,http://localhost:3001\nMETER_APP_AUTH_DISABLED=false\nMETER_APP_JWT_ISSUER=http://localhost:8081/realms/dev\nMETER_APP_JWT_JWKS_URI=http://localhost:8081/realms/dev/protocol/openid-connect/certs\nMETER_APP_JWT_AUDIENCE=account\nMETER_APP_JWT_RESOURCE=app\nMETER_APP_JWT_WRITE_ROLES=admin\n',
    'envs/linux.env': 'UID=1000\n',
    'packages/service/.env.example': 'NODE_ENV=development\nPORT=3002\nDATABASE_URL=postgres://postgres:postgres@db:5432/postgres\nCORS_ORIGIN=http://localhost:5173\n',
    'packages/web/.env.development': 'VITE_APP_TITLE="Meter App Web (dev)"\n',
    'packages/web/.env.production': 'VITE_APP_TITLE="Meter App Web"\n',
}
for name, content in defaults.items():
    path = root / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)

readme = root / 'README.md'
text = readme.read_text().replace(
    'while still providing a fully seeded local environment.',
    'The public snapshot contains the application schema and report views with no '
    'application records. Create units, meter types and meters in the UI before '
    'entering readings. Keycloak accounts are development examples.',
)
readme.write_text(text)
if 'docs/publishing.md' not in text:
    readme.write_text(text + '\n## Publishing\n\nSee [Publishing a public snapshot](docs/publishing.md).\n')

# Screenshots are intentionally retained with the repository owner's permission.
approved_images = {'docs/assets/input.png', 'docs/assets/reports.png'}
secret = re.compile(
    r'-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----'
    r'|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}'
    r'|AKIA[A-Z0-9]{16}|sk-[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}'
    r'|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}'
)
for path in root.rglob('*'):
    if not path.is_file() or path.relative_to(root).as_posix() in approved_images:
        continue
    if path.suffix.lower() in {'.csv', '.tsv', '.xls', '.xlsx', '.db', '.sqlite', '.sqlite3', '.dump', '.bak', '.backup', '.log', '.zip', '.gz', '.tar', '.pdf'}:
        raise SystemExit(f'Data file needs review: {path.relative_to(root)}')
    try:
        content = path.read_text()
    except UnicodeError:
        raise SystemExit(f'Binary file needs review: {path.relative_to(root)}')
    if '\0' in content or secret.search(content):
        raise SystemExit(f'Credential or binary content found: {path.relative_to(root)}')
    if path.suffix == '.sql' and re.search(
        r'\bINSERT\s+INTO\b|\bCOPY\b[\s\S]*?\bFROM\b|\bsetval\s*\(', content, re.I,
    ):
        raise SystemExit(f'SQL data remains: {path.relative_to(root)}')
print('Audit passed: no application rows, private patches, local env values or common secret patterns.')
PY

git init -q --initial-branch=main-pub
git config user.name 'MeterApp public snapshot'
git config user.email 'public-snapshot@users.noreply.github.com'
git add --all
git -c commit.gpgsign=false commit -q -m 'Public source snapshot (schema only)'
[[ $(git rev-list --count HEAD) == 1 ]]
if $prepare_only; then
  echo "Prepared $publish_dir; nothing was pushed."
  exit 0
fi

remote_url=$(git -C "$repo_dir" remote get-url --push origin-pub)
remote_head=$(git ls-remote --heads "$remote_url" refs/heads/main-pub)
expected_commit=${remote_head%%$'\t'*}
git -c push.followTags=false push \
  --force-with-lease="refs/heads/main-pub:$expected_commit" \
  "$remote_url" HEAD:refs/heads/main-pub
actual_head=$(git ls-remote --heads "$remote_url" refs/heads/main-pub)
[[ ${actual_head%%$'\t'*} == "$(git rev-parse HEAD)" ]]
echo "Published origin-pub/main-pub. Audited repository retained at $publish_dir"
