<p align="center">
  <img src="assets/logo.svg" width="132" alt="LayCode logo" />
</p>

<h1 align="center">LayCode</h1>

<p align="center">
  AI-native visual code editor for frontend teams. Point at any UI element in a live app, describe the change in plain English, and let the AI edit the source code for you.
</p>

<p align="center">
  <a href="README.zh-CN.md">中文</a>
  ·
  <a href="https://github.com/RobotXTeam/LayCode/releases">Releases</a>
  ·
  <a href="https://github.com/RobotXTeam/LayCode">Source Code</a>
</p>

<p align="center">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript&logoColor=white">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white">
  <img alt="License" src="https://img.shields.io/badge/License-MIT-green">
</p>

---

## What Is LayCode?

LayCode is a visual AI code editor built for frontend developers, designers, and product teams who want to iterate fast on UI changes without context-switching between browser and editor.

You run a local dev server as usual. LayCode proxies it, injects a lightweight browser overlay, and surfaces every UI element with its source location. Click any element, type a plain-English instruction, and the AI agent rewrites the underlying source code — React components, Vue files, or plain HTML/CSS.

Two modes:

| Mode | Description |
|------|-------------|
| **CLI** | Open-source, proxies any local dev server (`npx layrr --port 3000`) |
| **Web App** | Dashboard for importing GitHub repos or bootstrapping from templates, with full process management |

## Product Capabilities

- **Visual element selection** — click any element on a live page; overlay shows source file + line number
- **Plain-English edits** — describe the change you want; AI generates and applies a source diff
- **Multi-framework support** — React/Vite, Vue/Vite, Next.js, plain HTML projects
- **Git-aware version history** — preview, restore, or revert any edit session from the overlay panel
- **Change notes export** — bilingual (EN/ZH) modification log + git diff patch, copy or download
- **Project explorer** — three-column file tree, source preview, and style attribute mapper
- **GitHub integration** — import repos directly, push changes back via the dashboard
- **Template bootstrapping** — name a project, write a prompt, AI generates the first version
- **Desktop client** — Electron window mode, no browser tab required
- **Self-hosted agent option** — run your own AI coding agent (Claude Code, OpenAI Codex, or Pi Mono via OpenRouter)

## Architecture

```text
Browser (editing session)                         Dashboard (project management)
       │                                                  │
       │                                                  │ HTTP
       ▼                                                  ▼
┌──────────────────────┐                     ┌──────────────────────┐
│  LayCode Proxy       │                     │  Next.js Dashboard   │
│  :6100+              │◄───────────────────►│  :3000               │
│  injects overlay      │                     │  SQLite + GitHub OAuth│
└──────────┬───────────┘                     └──────────┬───────────┘
           │                                             │
           │ WebSocket                                  │ HTTP
           ▼                                             ▼
┌──────────────────────┐                     ┌──────────────────────┐
│  Hono Server         │                     │  Hono Process Manager │
│  :8787               │                     │  :8787               │
│  edit queue          │                     │  workspace lifecycle  │
└──────────┬───────────┘                     └──────────┬───────────┘
           │                                             │
           │                                             ▼
           │                              ┌──────────────────────┐
           │                              │  Child Processes     │
           │                              │  dev server :5100+   │
           │                              │  layrr proxy  :6100+ │
           ▼                              └──────────────────────┘
┌──────────────────────┐
│  AI Coding Agent     │
│  (Claude / Codex /   │
│   Pi Mono via        │
│   OpenRouter)        │
└──────────────────────┘
```

Core packages:

- `packages/cli/` — Standalone CLI (`layrr`) with proxy, overlay injection, and WebSocket routing
- `packages/app/` — Next.js 16 dashboard with project grid, GitHub OAuth, edit history, and push controls
- `packages/server/` — Hono process manager for workspace lifecycle (clone, start, stop, fresh-clone)
- `packages/cli/src/agents/` — Pluggable AI agents: Claude Code (bundled SDK), OpenAI Codex, Pi Mono (OpenRouter)

## Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start all services

```bash
./dev.sh
```

This starts:
- **Dashboard** at `http://localhost:3000`
- **Process Manager API** at `http://localhost:8787`

### 3. Open the dashboard

```
http://localhost:3000/dashboard
```

### 4. Create a project

- **Import from GitHub** — click **Import**, authenticate with GitHub, search and select a repo
- **Bootstrap from template** — click **New Website**, enter a name and a prompt describing the site you want

### 5. Launch the visual editor

Click **Start Editor** on any project. LayCode detects the framework, installs dependencies, starts the dev server and proxy, and opens the editor URL (typically `http://localhost:6100`).

### 6. Edit visually

1. Navigate to any page in the running app
2. Click the element you want to change
3. Type your instruction in the chat panel (e.g. `"change the hero button color to #1a1a2e and set border-radius to 12px"`)
4. Review the diff, confirm, and the source code is updated

## Desktop Client

For a window-based experience without browser tabs:

```bash
pnpm desktop:dev
```

This starts the server + dashboard automatically and opens an Electron window.

### Beta launcher (works from any directory)

```bash
cd /home/steven/work/cli/LayCode
pnpm beta:install      # install the laycode-beta CLI once
laycode-beta start     # launch desktop app from anywhere
laycode-beta check     # check port status
laycode-beta stop      # stop all LayCode processes
```

## Environment Variables

Create or edit `.env` at the repository root:

```env
GITHUB_CLIENT_ID=        # GitHub OAuth app client ID
GITHUB_CLIENT_SECRET=    # GitHub OAuth app client secret
GITHUB_REDIRECT_URI=http://localhost:3000/api/auth/github/callback
SESSION_SECRET=          # 32+ character random string
SERVER_PORT=8787
SERVER_SECRET=dev-secret
LAYRR_SERVER_URL=http://localhost:8787
LAYRR_SERVER_SECRET=dev-secret
OPENROUTER_API_KEY=      # required for Pi Mono agent
LAYRR_AGENT=pi-mono      # default agent (pi-mono | claude | codex)
```

## Repository Layout

```text
packages/
  cli/                   Standalone CLI (layrr)
    src/
      agents/            AI agent implementations (Claude, Codex, Pi Mono)
      server/            HTTP proxy + WebSocket + edit queue
      overlay/           Browser UI (vanilla TS, IIFE bundle)
  app/                   Next.js 16 dashboard
    src/
      app/               Pages (dashboard, project, sign-in)
      lib/               Auth, DB, schema, server API, GitHub API
  server/                Hono process manager
    templates/           Next.js + shadcn/ui bootstrap template
scripts/
  build.ts               Overlay bundler (esbuild + tsc + fonts)
  install-beta-launcher.sh
  self-test-local-import.sh
assets/                  Logo and branding assets
```

## Framework Detection

The server auto-detects the framework from `package.json` and starts the appropriate dev command:

| Framework | Dev Command |
|-----------|-------------|
| Next.js | `pnpm dev` |
| React/Vite | `pnpm dev` |
| Vue/Vite | `pnpm dev` |
| Plain HTML | Static file server |
| shadcn/ui template | `pnpm dev` |

## Security Model

- **No cloud upload by default** — editing happens locally; code never leaves your machine unless you explicitly push
- **GitHub OAuth** — only read/write permission to repos you authorize; tokens stored in SQLite, never in git
- **Session management** — iron-session cookies with configurable expiry; secrets loaded from environment
- **Workspace isolation** — each project runs in its own workspace directory (`~/.layrr/workspaces/{projectId}/`)
- **Port isolation** — dev servers use port pools 5100–5199, proxies 6100–6199, checked for availability before bind
- **Process cleanup** — orphaned processes are scanned and killed on server startup

## Roadmap

- [ ] Signed macOS DMG and Windows MSI desktop installers
- [ ] Native service mode (run as system daemon)
- [ ] Multi-agent parallel editing (multiple AI agents editing simultaneously)
- [ ] Team collaboration layer (shared edit sessions)
- [ ] VS Code extension (in-editor visual mode without leaving IDE)
- [ ] Plugin API for custom elements / component libraries
- [ ] External PostgreSQL backend for multi-tenant deployment
- [ ] High availability mode for the process manager

## Commercial Positioning

LayCode is designed for teams and solo developers who want to:

- Move from design to production without manual CRUD between Figma, Slack, and the codebase
- Let non-engineers propose UI changes in plain English while engineers stay in control of the diff
- Capture every AI-assisted edit as a versioned, reviewable commit
- Run a fully self-hosted AI editing pipeline without vendor lock-in

LayCode is free for individual use and small teams. Commercial licensing for larger deployments is under evaluation.

## License

MIT License. See [LICENSE](LICENSE) for details.

---

LayCode is a commercial distribution of [Layrr](https://github.com/thetronjohnson/layrr), originally licensed under MIT.
