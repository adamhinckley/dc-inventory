#!/usr/bin/env bash
# Start Compose Mailpit (if needed) and open the inbox UI.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required to start Mailpit" >&2
  exit 1
fi

docker compose up -d --wait mailpit

mapped="$(docker compose port mailpit 8025)"
host_port="${mapped##*:}"
url="http://localhost:${host_port}"

if command -v open >/dev/null 2>&1; then
  open "$url"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$url"
fi

echo "Mailpit UI: $url"
