#!/bin/bash
set -e

cd /opt/layrr

echo "=== Deploying Layrr ==="

# Pull latest
echo "Pulling latest code..."
git pull

# Install dependencies
echo "Installing dependencies..."
pnpm install

# Build all packages
echo "Building..."
pnpm build

# Build Docker image
echo "Building Docker container image..."
docker build -t layrr-container -f packages/container/Dockerfile .

# Push DB schema
echo "Pushing database schema..."
cd packages/app && npx drizzle-kit push && cd ../..

# Install systemd services
echo "Installing services..."
cp deploy/layrr-server.service /etc/systemd/system/
cp deploy/layrr-app.service /etc/systemd/system/
systemctl daemon-reload

# Restart services
echo "Restarting services..."
systemctl restart layrr-server
systemctl restart layrr-app
systemctl enable layrr-server layrr-app

echo ""
echo "=== Deploy complete ==="
echo "  Dashboard: https://app.layrr.dev"
echo "  Server:    systemctl status layrr-server"
echo "  App:       systemctl status layrr-app"
