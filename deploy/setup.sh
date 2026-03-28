#!/bin/bash
set -e

echo "=== Layrr Server Setup ==="

# Install Node.js 22
if ! command -v node &> /dev/null; then
  echo "Installing Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

# Install pnpm
if ! command -v pnpm &> /dev/null; then
  echo "Installing pnpm..."
  npm install -g pnpm@10
fi

# Install Incus
if ! command -v incus &> /dev/null; then
  echo "Installing Incus..."
  apt-get install -y incus incus-tools
  incus admin init --auto
fi

# Install Caddy
if ! command -v caddy &> /dev/null; then
  echo "Installing Caddy..."
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
fi

# Create layrr user
if ! id "layrr" &>/dev/null; then
  echo "Creating layrr user..."
  useradd -m -s /bin/bash layrr
  usermod -aG incus-admin layrr
fi

# Create directories
mkdir -p /opt/layrr /var/lib/layrr
chown -R layrr:layrr /opt/layrr /var/lib/layrr

# Build Incus workspace image
echo "Building Incus workspace image..."
if ! incus image list --format=json | grep -q '"layrr-workspace"'; then
  incus launch images:ubuntu/24.04 builder
  sleep 5  # Wait for container to be ready
  incus exec builder -- bash -c "curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs git curl && npm install -g pnpm@10"
  incus stop builder
  incus publish builder --alias layrr-workspace
  incus delete builder
  echo "Workspace image created"
else
  echo "Workspace image already exists"
fi

echo ""
echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "  1. Clone repo:  git clone <repo-url> /opt/layrr"
echo "  2. Create /opt/layrr/.env with production values"
echo "  3. Run:  bash /opt/layrr/deploy/deploy.sh"
