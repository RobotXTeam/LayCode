#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_URL="${SERVER_URL:-http://localhost:8787}"
SERVER_SECRET="${SERVER_SECRET:-dev-secret}"

react_path="$ROOT_DIR/samples/react-vite"
html_path="$ROOT_DIR/samples/html-bootstrap"

if [[ ! -d "$react_path" || ! -d "$html_path" ]]; then
  echo "[self-test] missing sample projects under samples/"
  exit 1
fi

echo "[self-test] starting React local project"
react_json=$(curl -sS --fail -X POST "$SERVER_URL/projects/react-local-selftest/start" \
  -H "Authorization: Bearer $SERVER_SECRET" \
  -H 'Content-Type: application/json' \
  -d "{\"githubRepo\":\"\",\"branch\":\"main\",\"githubToken\":\"\",\"sourceType\":\"local\",\"localPath\":\"$react_path\",\"gitUsername\":\"laycode\",\"gitEmail\":\"laycode@example.com\"}")

echo "$react_json" | grep -q '"status":"running"'
react_proxy=$(echo "$react_json" | sed -n 's/.*"proxyPort":\([0-9]*\).*/\1/p')
react_token=$(echo "$react_json" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')

curl -sS -c /tmp/laycode-react-selftest.cookie -o /dev/null "http://localhost:${react_proxy}/?token=${react_token}"
react_html=$(curl -sS -b /tmp/laycode-react-selftest.cookie "http://localhost:${react_proxy}/")

echo "$react_html" | grep -q '/__layrr__/overlay.js'

echo "[self-test] starting HTML local project"
html_json=$(curl -sS --fail -X POST "$SERVER_URL/projects/html-local-selftest/start" \
  -H "Authorization: Bearer $SERVER_SECRET" \
  -H 'Content-Type: application/json' \
  -d "{\"githubRepo\":\"\",\"branch\":\"main\",\"githubToken\":\"\",\"sourceType\":\"local\",\"localPath\":\"$html_path\",\"gitUsername\":\"laycode\",\"gitEmail\":\"laycode@example.com\"}")

echo "$html_json" | grep -q '"status":"running"'
html_proxy=$(echo "$html_json" | sed -n 's/.*"proxyPort":\([0-9]*\).*/\1/p')
html_token=$(echo "$html_json" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')

curl -sS -c /tmp/laycode-html-selftest.cookie -o /dev/null "http://localhost:${html_proxy}/?token=${html_token}"
html_doc=$(curl -sS -b /tmp/laycode-html-selftest.cookie "http://localhost:${html_proxy}/")

echo "$html_doc" | grep -q 'LayCode HTML Sample'
echo "$html_doc" | grep -q '/__layrr__/overlay.js'

echo "[self-test] PASS: local import + proxy injection works for React and HTML"
