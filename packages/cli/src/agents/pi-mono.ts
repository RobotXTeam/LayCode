import type { Agent, AgentOptions, AgentCheckResult } from './base.js';
import type { PendingEditRequest } from '../server/edit-queue.js';
import { buildPrompt } from './prompt.js';

export class PiMonoAgent implements Agent {
  readonly name = 'pi-mono' as const;
  readonly displayName = 'Pi Mono';
  private projectRoot: string;

  constructor(opts: AgentOptions) {
    this.projectRoot = opts.projectRoot;
  }

  async applyEdit(request: PendingEditRequest): Promise<{ success: boolean; message: string }> {
    const prompt = buildPrompt(request);

    try {
      // Dynamic import to avoid loading pi-mono at startup
      const { createAgentSession, codingTools } = await import('@mariozechner/pi-coding-agent');
      const { runPrintMode } = await import('@mariozechner/pi-coding-agent');

      const { session } = await createAgentSession({
        cwd: this.projectRoot,
        tools: codingTools,
      });

      const exitCode = await runPrintMode(session, {
        mode: 'text',
        initialMessage: prompt,
      });

      if (exitCode === 0) {
        return { success: true, message: 'Edit applied' };
      } else {
        return { success: false, message: `Agent exited with code ${exitCode}` };
      }
    } catch (err: any) {
      return { success: false, message: err.message || 'Pi Mono agent failed' };
    }
  }
}

const SUPPORTED_PROVIDERS = [
  { env: 'ANTHROPIC_API_KEY', name: 'Anthropic' },
  { env: 'OPENAI_API_KEY', name: 'OpenAI' },
  { env: 'GOOGLE_API_KEY', name: 'Google' },
  { env: 'MISTRAL_API_KEY', name: 'Mistral' },
  { env: 'GROQ_API_KEY', name: 'Groq' },
  { env: 'XAI_API_KEY', name: 'xAI' },
  { env: 'OPENROUTER_API_KEY', name: 'OpenRouter' },
  { env: 'LAYRR_API_KEY', name: 'Layrr (hosted)' },
];

export function checkPiMono(): AgentCheckResult {
  // Check if any LLM provider key is set
  const available = SUPPORTED_PROVIDERS.filter(p => process.env[p.env]);

  // Also check if LAYRR_API_KEY is set (hosted mode)
  if (available.length > 0) {
    return { ok: true };
  }

  // Pi-mono might have credentials stored in its own auth system
  try {
    const { AuthStorage, FileAuthStorageBackend } = require('@mariozechner/pi-coding-agent');
    const home = process.env.HOME || process.env.USERPROFILE || '/tmp';
    const authPath = `${home}/.pi/agent/auth.json`;
    const backend = new FileAuthStorageBackend(authPath);
    const storage = new AuthStorage(backend);
    // If auth file exists with any credentials, consider it ok
    const fs = require('fs');
    if (fs.existsSync(authPath)) {
      return { ok: true };
    }
  } catch {}

  return { ok: false, error: 'not-authenticated' };
}
