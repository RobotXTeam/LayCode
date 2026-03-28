#!/bin/bash
set -e

# Run as root on the Hetzner server
# Usage: bash /opt/layrr/deploy/deploy.sh

cd /opt/layrr

echo "=== Deploying Layrr ==="

# Pull latest
echo "[1/6] Pulling latest code..."
git pull

# Install dependencies
echo "[2/6] Installing dependencies..."
su - layrr -c "cd /opt/layrr && pnpm install"

# Build all packages
echo "[3/6] Building..."
su - layrr -c "cd /opt/layrr && pnpm build"

# Push DB schema
echo "[4/6] Pushing database schema..."
su - layrr -c "cd /opt/layrr/packages/app && DATABASE_PATH=/var/lib/layrr/layrr.db npx drizzle-kit push"

# Install systemd services
echo "[5/6] Installing services..."
cp deploy/layrr-server.service /etc/systemd/system/
cp deploy/layrr-app.service /etc/systemd/system/
cp deploy/caddy.service /etc/systemd/system/ 2>/dev/null || true
systemctl daemon-reload

# Restart services
echo "[6/6] Restarting services..."
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
