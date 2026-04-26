#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_DIR="${HOME}/.local/bin"
TARGET="${BIN_DIR}/laycode-beta"

mkdir -p "${BIN_DIR}"

cat > "${TARGET}" <<EOF
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR}"

if [[ ! -d "\${ROOT_DIR}" ]]; then
  echo "LayCode repo not found: \${ROOT_DIR}" >&2
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm not found. Please install pnpm first." >&2
  exit 1
fi

cmd="\${1:-start}"
case "\${cmd}" in
  start)
    cd "\${ROOT_DIR}"
    pnpm desktop:dev
    ;;
  stop)
    pkill -f 'packages/desktop/scripts/dev.mjs|electron main.js|./dev.sh|packages/server/node_modules/.bin/.*/tsx|packages/app/node_modules/.bin/.*/next dist/bin/next dev' || true
    pkill -f 'packages/desktop/scripts/dev.mjs|electron main.js|./dev.sh|packages/server/node_modules/.bin/../tsx/dist/cli.mjs watch src/index.ts|packages/app/node_modules/.bin/../next/dist/bin/next dev' || true
    echo "LayCode beta processes stopped."
    ;;
  check)
    ss -ltnp | grep -E ':(3000|8787|6100|6101)\\b' || true
    ;;
  *)
    echo "Usage: laycode-beta [start|stop|check]" >&2
    exit 1
    ;;
 esac
EOF

chmod +x "${TARGET}"

echo "Installed test launcher: ${TARGET}"
echo "Try: laycode-beta start"
