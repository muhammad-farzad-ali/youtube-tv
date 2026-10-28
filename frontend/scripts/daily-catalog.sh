#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
LOG="${XDG_STATE_HOME:-$HOME/.local/state}/cable-tv/daily-catalog.log"
LOCK="${TMPDIR:-/tmp}/cable-tv-daily-$(id -u).lock"

mkdir -p "$(dirname "$LOG")"
exec >>"$LOG" 2>&1
echo
echo "=== $(date -Is) daily catalog refresh ==="

# Prevent overlapping runs.
exec 9>"$LOCK"
flock -n 9 || {
	echo "Already running; exiting."
	exit 0
}

# Cron does not load nvm automatically.
if [ -s "$HOME/.nvm/nvm.sh" ]; then
	# shellcheck disable=SC1091
	. "$HOME/.nvm/nvm.sh"
	nvm use 24 >/dev/null
fi

cd "$REPO"

if [ "$(git branch --show-current)" != "main" ]; then
	echo "Not on main; aborting."
	exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
	echo "Working tree is dirty; aborting. Inspect the repo."
	exit 1
fi

git fetch origin main
if ! git merge-base --is-ancestor main origin/main; then
	echo "Local main has unpushed commits; aborting."
	exit 1
fi
git merge --ff-only origin/main

cd "$REPO/frontend"
npm ci --no-audit --no-fund
npm run catalog:sync
npm run catalog:check
npm run catalog:audit
npm run check
npm run test:run
npm run test:e2e
npm run format:check
npm run build

cd "$REPO"
git add -- frontend/static/catalog.json frontend/static/catalog/logos

if git diff --cached --quiet; then
	echo "No catalog changes; nothing to commit."
	exit 0
fi

git commit -m "chore(catalog): daily snapshot $(date +%F)"
git push origin main
echo "Pushed; CI will deploy if all checks pass."
