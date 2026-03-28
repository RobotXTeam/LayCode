FROM node:22-slim

# Install system dependencies
RUN apt-get update && apt-get install -y git curl && rm -rf /var/lib/apt/lists/*

# Install package managers globally
RUN npm install -g pnpm@10

# Copy layrr CLI
COPY packages/cli/dist /opt/layrr/dist
COPY packages/cli/package.json /opt/layrr/package.json

# Install layrr CLI dependencies
WORKDIR /opt/layrr
RUN npm install --omit=dev

# Copy entry script
COPY packages/container/entry.sh /opt/layrr/entry.sh
RUN chmod +x /opt/layrr/entry.sh

# Create workspace directory
RUN mkdir -p /workspace/repo

WORKDIR /workspace

EXPOSE 4567

HEALTHCHECK --interval=10s --timeout=3s --start-period=120s --retries=3 \
  CMD curl -sf http://localhost:4567/ || exit 1

ENTRYPOINT ["/opt/layrr/entry.sh"]
