#!/bin/bash
set -e

WORKSPACE="/workspace/repo"

echo "[layrr-container] Starting..."
echo "[layrr-container] Repo: ${GITHUB_REPO:-template}"
echo "[layrr-container] Branch: ${GITHUB_BRANCH:-main}"
echo "[layrr-container] Agent: ${LAYRR_AGENT:-pi-mono}"

# ---- Git safe directory (volume ownership mismatch) ----
git config --global --add safe.directory /workspace/repo

# ---- Clean up stale git locks ----
rm -f "$WORKSPACE/.git/index.lock" 2>/dev/null || true

# ---- Clone, pull, or use template ----
if [ "$TEMPLATE_MODE" = "true" ] && [ -d "$WORKSPACE" ]; then
  echo "[layrr-container] Template mode — using pre-populated workspace"
  cd "$WORKSPACE"
elif [ -d "$WORKSPACE/.git" ]; then
  echo "[layrr-container] Repo exists, pulling latest..."
  cd "$WORKSPACE"
  git fetch origin
  git checkout "${GITHUB_BRANCH:-main}"
  git reset --hard "origin/${GITHUB_BRANCH:-main}"
elif [ -n "$GITHUB_REPO" ] && [ -n "$GITHUB_TOKEN" ]; then
  echo "[layrr-container] Cloning repo..."
  cd "$WORKSPACE"
  git init
  git remote add origin "https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git"
  git fetch --depth 1 origin "${GITHUB_BRANCH:-main}"
  git checkout -f FETCH_HEAD
  git checkout -B "${GITHUB_BRANCH:-main}"
else
  echo "[layrr-container] Error: No workspace, repo, or template found"
  exit 1
fi

# ---- Git config ----
git config user.email "${GIT_EMAIL:-layrr@layrr.dev}"
git config user.name "${GIT_USERNAME:-Layrr}"

# ---- Detect package manager ----
if [ -f "pnpm-lock.yaml" ]; then
  PM="pnpm"
elif [ -f "yarn.lock" ]; then
  PM="yarn"
elif [ -f "bun.lockb" ] || [ -f "bun.lock" ]; then
  PM="bun"
else
  PM="npm"
fi
echo "[layrr-container] Package manager: $PM"

# ---- Install dependencies ----
export CI=true
echo "[layrr-container] Installing dependencies..."
$PM install

# ---- Detect framework and dev command ----
detect_dev_command() {
  local pkg="$WORKSPACE/package.json"
  if [ ! -f "$pkg" ]; then
    echo "$PM start"
    return
  fi

  if grep -q '"next"' "$pkg"; then
    echo "npx next dev -p 3000 -H 0.0.0.0"
    return
  fi
  if grep -q '"nuxt"' "$pkg"; then
    echo "npx nuxt dev --port 3000 --host 0.0.0.0"
    return
  fi
  if grep -q '"astro"' "$pkg"; then
    echo "npx astro dev --port 3000 --host 0.0.0.0"
    return
  fi
  if grep -q '"vite"' "$pkg" || grep -q '"@vitejs/plugin-react"' "$pkg"; then
    echo "npx vite --port 3000 --host 0.0.0.0"
    return
  fi
  if grep -q '"@sveltejs/kit"' "$pkg"; then
    echo "npx vite --port 3000 --host 0.0.0.0"
    return
  fi

  if grep -q '"dev"' "$pkg"; then
    echo "$PM run dev"
    return
  fi

  echo "$PM start"
}

detect_framework() {
  local pkg="$WORKSPACE/package.json"
  if grep -q '"next"' "$pkg" 2>/dev/null; then echo "nextjs"; return; fi
  if grep -q '"astro"' "$pkg" 2>/dev/null; then echo "astro"; return; fi
  if grep -q '"vite"' "$pkg" 2>/dev/null; then echo "vite"; return; fi
  if grep -q '"@sveltejs/kit"' "$pkg" 2>/dev/null; then echo "sveltekit"; return; fi
  if grep -q '"nuxt"' "$pkg" 2>/dev/null; then echo "nuxt"; return; fi
  if grep -q '"vue"' "$pkg" 2>/dev/null; then echo "vue"; return; fi
  if grep -q '"react"' "$pkg" 2>/dev/null; then echo "react"; return; fi
  echo "unknown"
}

DEV_CMD=$(detect_dev_command)
FRAMEWORK=$(detect_framework)
echo "[layrr-container] Framework: $FRAMEWORK"
echo "[layrr-container] Dev command: $DEV_CMD"

# ---- Start dev server in background ----
echo "[layrr-container] Starting dev server..."
$DEV_CMD &
DEV_PID=$!

# Wait for dev server to be ready
echo "[layrr-container] Waiting for dev server on port 3000..."
for i in $(seq 1 120); do
  if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "[layrr-container] Dev server ready!"
    break
  fi
  if [ $i -eq 120 ]; then
    echo "[layrr-container] Warning: dev server took too long, starting proxy anyway..."
  fi
  sleep 2
done

# ---- Start layrr proxy ----
echo "[layrr-container] Starting layrr proxy on port ${LAYRR_PROXY_PORT:-4567}..."
exec node /opt/layrr/dist/cli.js \
  --port 3000 \
  --proxy-port "${LAYRR_PROXY_PORT:-4567}" \
  --no-open \
  --agent "${LAYRR_AGENT:-pi-mono}"
