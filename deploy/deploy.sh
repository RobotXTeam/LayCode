#!/bin/bash
set -e

# Run as root on the Hetzner server
# Usage: bash /opt/layrr/deploy/deploy.sh

cd /opt/layrr

echo "=== Deploying Layrr ==="

# Pull latest
echo "[1/7] Pulling latest code..."
git pull

# Install dependencies
echo "[2/7] Installing dependencies..."
su - layrr -c "cd /opt/layrr && pnpm install"

# Build all packages
echo "[3/7] Building..."
su - layrr -c "cd /opt/layrr && pnpm build"

# Update Incus workspace CLI (if Incus mode)
if [ -f /opt/layrr/.env ] && grep -q "LAYRR_MODE=incus" /opt/layrr/.env; then
  echo "[4/7] Updating layrr CLI in running containers..."
  for container in $(incus list --format=csv -c n 2>/dev/null | grep "^layrr-"); do
    if incus info "$container" 2>/dev/null | grep -q "Status: RUNNING"; then
      incus file push -r /opt/layrr/packages/cli/dist "$container/opt/layrr/" 2>/dev/null || true
      echo "  Updated CLI in $container"
    fi
  done
fi

# Push DB schema
echo "[5/7] Pushing database schema..."
su - layrr -c "cd /opt/layrr/packages/app && DATABASE_PATH=/var/lib/layrr/layrr.db npx drizzle-kit push"

# Install systemd services
echo "[6/7] Installing services..."
cp deploy/layrr-server.service /etc/systemd/system/
cp deploy/layrr-app.service /etc/systemd/system/
cp deploy/caddy.service /etc/systemd/system/ 2>/dev/null || true
systemctl daemon-reload

# Restart services
echo "[7/7] Restarting services..."
systemctl restart layrr-server
systemctl restart layrr-app
systemctl restart caddy
systemctl enable layrr-server layrr-app caddy

echo ""
echo "=== Deploy complete ==="
echo ""
systemctl is-active --quiet caddy && echo "  ✓ Caddy running" || echo "  ✗ Caddy failed"
systemctl is-active --quiet layrr-server && echo "  ✓ Server running" || echo "  ✗ Server failed"
systemctl is-active --quiet layrr-app && echo "  ✓ App running" || echo "  ✗ App failed"
echo ""
echo "  Dashboard: https://app.layrr.dev"
echo "  Logs:      journalctl -u layrr-server -f"
echo "             journalctl -u layrr-app -f"
