import type { Agent, AgentName, AgentOptions, AgentCheckResult } from './base.js';
import { PUBLIC_AGENTS } from './base.js';
import { ClaudeAgent, checkClaude } from './claude.js';
import { CodexAgent, checkCodex } from './codex.js';
import { PiMonoAgent, checkPiMono } from './pi-mono.js';

export type { Agent, AgentName, AgentOptions };

const ALL_AGENTS: { name: AgentName; displayName: string }[] = [
  { name: 'claude', displayName: 'Claude Code' },
  { name: 'codex', displayName: 'Codex CLI' },
  { name: 'pi-mono', displayName: 'Pi Mono' },
];

// Public agents shown in CLI picker and help text
export const AGENT_LIST = ALL_AGENTS.filter(a => PUBLIC_AGENTS.includes(a.name));

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
    authHint: `  Set your OpenRouter API key:

    export OPENROUTER_API_KEY=<key>`,
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
