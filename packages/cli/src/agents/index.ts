import type { Agent, AgentName, AgentOptions, AgentCheckResult } from './base.js';
import { ClaudeAgent, checkClaude } from './claude.js';
import { CodexAgent, checkCodex } from './codex.js';
import { PiMonoAgent, checkPiMono } from './pi-mono.js';

export type { Agent, AgentName, AgentOptions };

export const AGENT_LIST: { name: AgentName; displayName: string }[] = [
  { name: 'claude', displayName: 'Claude Code' },
  { name: 'codex', displayName: 'Codex CLI' },
  { name: 'pi-mono', displayName: 'Pi Mono' },
];

const AGENTS: Record<AgentName, {
  create: (opts: AgentOptions) => Agent;
  check: () => AgentCheckResult;
  installHint: string;
  authHint: string;
}> = {
  claude: {
    create: (opts) => new ClaudeAgent(opts),
    check: checkClaude,
    installHint: 'layrr bundles it. Try: claude login',
    authHint: `  Authenticate using one of these methods:

    • Bedrock:  claude login --bedrock
    • SSO:      claude login --sso
    • API key:  claude login`,
  },
  codex: {
    create: (opts) => new CodexAgent(opts),
    check: checkCodex,
    installHint: 'npm install -g @openai/codex',
    authHint: `  Set your OpenAI API key:

    export OPENAI_API_KEY=<your-key>`,
  },
  'pi-mono': {
    create: (opts) => new PiMonoAgent(opts),
    check: checkPiMono,
    installHint: 'Bundled — just configure an LLM provider API key',
    authHint: `  Set any supported LLM provider key:

    export ANTHROPIC_API_KEY=<key>    # Anthropic
    export OPENAI_API_KEY=<key>       # OpenAI
    export GOOGLE_API_KEY=<key>       # Google
    export GROQ_API_KEY=<key>         # Groq
    export OPENROUTER_API_KEY=<key>   # OpenRouter

    Or run: pi login`,
  },
};

export function createAgent(name: AgentName, opts: AgentOptions): Agent {
  return AGENTS[name].create(opts);
}

export function checkAgent(name: AgentName): AgentCheckResult {
  return AGENTS[name].check();
}

export function getAgentDisplayName(name: AgentName): string {
  return AGENT_LIST.find(a => a.name === name)?.displayName || name;
}

export function getInstallHint(name: AgentName): string {
  return AGENTS[name].installHint;
}

export function getAuthHint(name: AgentName): string {
  return AGENTS[name].authHint;
}

export function isValidAgent(name: string): name is AgentName {
  return name in AGENTS;
}
