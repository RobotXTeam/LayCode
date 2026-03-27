#!/bin/bash
# Start all Layrr services for local development

trap 'kill 0' EXIT

# Load root .env
set -a
source .env 2>/dev/null
set +a

echo "Starting Layrr dev environment..."

# Server (process manager)
(cd packages/server && pnpm dev) &

# Wait for server to be ready
sleep 2

# Dashboard
(cd packages/app && pnpm dev) &

echo ""
echo "  Dashboard:  http://localhost:3000"
echo "  Server:     http://localhost:8787"
echo "  Agent:      ${LAYRR_AGENT:-pi-mono}"
echo ""
echo "  Press Ctrl+C to stop all services"
echo ""

wait
