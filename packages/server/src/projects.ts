import { spawn, type ChildProcess, execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { createServer } from 'net';

const WORKSPACE_DIR = process.env.WORKSPACE_DIR || join(process.env.HOME || '/tmp', '.layrr', 'workspaces');

const DEV_PORT_START = 5100;
const DEV_PORT_END = 5199;
const PROXY_PORT_START = 6100;
const PROXY_PORT_END = 6199;

export interface ProjectProcess {
  id: string;
  githubRepo: string;
  branch: string;
  framework: string | null;
  devProcess: ChildProcess | null;
  proxyProcess: ChildProcess | null;
  devPort: number;
  proxyPort: number;
  status: 'stopped' | 'starting' | 'running' | 'error';
  logs: string[];
  workDir: string;
}

const projects = new Map<string, ProjectProcess>();
const usedDevPorts = new Set<number>();
const usedProxyPorts = new Set<number>();

// Check if a port is actually in use
function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => { server.close(); resolve(false); });
    server.listen(port, '0.0.0.0');
  });
}

async function allocatePort(start: number, end: number, usedSet: Set<number>): Promise<number> {
  for (let port = start; port <= end; port++) {
    if (usedSet.has(port)) continue;
    const inUse = await isPortInUse(port);
    if (!inUse) {
      usedSet.add(port);
      return port;
    }
  }
  throw new Error(`No available ports in range ${start}-${end}`);
}

function releasePort(port: number, usedSet: Set<number>) {
  usedSet.delete(port);
}

function addLog(project: ProjectProcess, msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  project.logs.push(line);
  if (project.logs.length > 200) project.logs.shift();
  console.log(`[${project.id}] ${msg}`);
}

function detectPackageManager(workDir: string): string {
  if (existsSync(join(workDir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(workDir, 'yarn.lock'))) return 'yarn';
  if (existsSync(join(workDir, 'bun.lockb')) || existsSync(join(workDir, 'bun.lock'))) return 'bun';
  return 'npm';
}

function detectFramework(workDir: string): string {
  try {
    const pkg = JSON.parse(readFileSync(join(workDir, 'package.json'), 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps['next']) return 'nextjs';
    if (deps['astro']) return 'astro';
    if (deps['nuxt']) return 'nuxt';
    if (deps['vite'] || deps['@vitejs/plugin-react']) return 'vite';
    if (deps['@sveltejs/kit']) return 'sveltekit';
    if (deps['vue']) return 'vue';
    if (deps['react']) return 'react';
  } catch {}
  return 'unknown';
}

function getDevCommand(framework: string, pm: string, port: number): { cmd: string; args: string[] } {
  switch (framework) {
    case 'nextjs':
      return { cmd: 'npx', args: ['next', 'dev', '-p', String(port), '-H', '0.0.0.0'] };
    case 'nuxt':
      return { cmd: 'npx', args: ['nuxt', 'dev', '--port', String(port), '--host', '0.0.0.0'] };
    case 'astro':
      return { cmd: 'npx', args: ['astro', 'dev', '--port', String(port), '--host', '0.0.0.0'] };
    case 'sveltekit':
    case 'vite':
    case 'vue':
      return { cmd: 'npx', args: ['vite', '--port', String(port), '--host', '0.0.0.0'] };
    default:
      return { cmd: pm, args: ['run', 'dev'] };
  }
}

function killProcess(proc: ChildProcess | null) {
  if (!proc || proc.killed) return;
  try {
    // Kill the process group to catch child processes
    process.kill(-proc.pid!, 'SIGTERM');
  } catch {
    try { proc.kill('SIGTERM'); } catch {}
  }
  // Force kill after 5s
  setTimeout(() => {
    try { proc.kill('SIGKILL'); } catch {}
  }, 5000);
}

export async function startProject(id: string, githubRepo: string, branch: string, githubToken: string): Promise<ProjectProcess> {
  // If already running, return it
  const existing = projects.get(id);
  if (existing && existing.status === 'running') return existing;

  // If exists but stopped/error, clean up old ports
  if (existing) {
    releasePort(existing.devPort, usedDevPorts);
    releasePort(existing.proxyPort, usedProxyPorts);
  }

  const devPort = await allocatePort(DEV_PORT_START, DEV_PORT_END, usedDevPorts);
  const proxyPort = await allocatePort(PROXY_PORT_START, PROXY_PORT_END, usedProxyPorts);
  const workDir = join(WORKSPACE_DIR, id);

  const project: ProjectProcess = {
    id, githubRepo, branch,
    framework: null,
    devProcess: null, proxyProcess: null,
    devPort, proxyPort,
    status: 'starting',
    logs: [],
    workDir,
  };
  projects.set(id, project);

  try {
    mkdirSync(WORKSPACE_DIR, { recursive: true });

    // Clone or pull
    if (existsSync(join(workDir, '.git'))) {
      addLog(project, 'Pulling latest...');
      execSync(`git fetch origin && git checkout ${branch} && git reset --hard origin/${branch}`, { cwd: workDir, stdio: 'pipe' });
    } else {
      addLog(project, `Cloning ${githubRepo}...`);
      execSync(
        `git clone --depth 1 --branch ${branch} https://x-access-token:${githubToken}@github.com/${githubRepo}.git ${workDir}`,
        { stdio: 'pipe' }
      );
    }

    execSync('git config user.email "layrr@layrr.dev" && git config user.name "Layrr"', { cwd: workDir, stdio: 'pipe' });

    const pm = detectPackageManager(workDir);
    project.framework = detectFramework(workDir);
    addLog(project, `Framework: ${project.framework}, PM: ${pm}`);

    addLog(project, 'Installing dependencies...');
    execSync(`${pm} install`, { cwd: workDir, stdio: 'pipe', timeout: 120000 });
    addLog(project, 'Dependencies installed');

    // Start dev server
    const devCmd = getDevCommand(project.framework, pm, devPort);
    addLog(project, `Starting dev server: ${devCmd.cmd} ${devCmd.args.join(' ')}`);
    project.devProcess = spawn(devCmd.cmd, devCmd.args, {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: String(devPort), HOST: '0.0.0.0' },
      detached: true, // create process group for clean kill
    });

    project.devProcess.stdout?.on('data', (d: Buffer) => addLog(project, d.toString().trim()));
    project.devProcess.stderr?.on('data', (d: Buffer) => addLog(project, d.toString().trim()));
    project.devProcess.on('exit', (code) => {
      addLog(project, `Dev server exited with code ${code}`);
      if (project.status === 'running') {
        project.status = 'error';
        releasePort(devPort, usedDevPorts);
      }
    });

    addLog(project, `Waiting for dev server on port ${devPort}...`);
    await waitForPort(devPort, 120000);
    addLog(project, 'Dev server ready');

    // Start layrr proxy
    const layrCli = join(process.cwd(), '..', 'cli', 'dist', 'cli.js');
    addLog(project, `Starting layrr proxy on port ${proxyPort}...`);
    project.proxyProcess = spawn('node', [layrCli, '--port', String(devPort), '--proxy-port', String(proxyPort), '--no-open', '--agent', 'claude'], {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });

    project.proxyProcess.stdout?.on('data', (d: Buffer) => addLog(project, `[proxy] ${d.toString().trim()}`));
    project.proxyProcess.stderr?.on('data', (d: Buffer) => addLog(project, `[proxy] ${d.toString().trim()}`));
    project.proxyProcess.on('exit', (code) => {
      addLog(project, `Proxy exited with code ${code}`);
      if (project.status === 'running') {
        project.status = 'error';
        releasePort(proxyPort, usedProxyPorts);
      }
    });

    await waitForPort(proxyPort, 30000);
    project.status = 'running';
    addLog(project, `Ready! Dev: ${devPort}, Proxy: ${proxyPort}`);

    return project;
  } catch (err: any) {
    addLog(project, `Error: ${err.message}`);
    project.status = 'error';
    killProcess(project.devProcess);
    killProcess(project.proxyProcess);
    project.devProcess = null;
    project.proxyProcess = null;
    releasePort(devPort, usedDevPorts);
    releasePort(proxyPort, usedProxyPorts);
    throw err;
  }
}

export function stopProject(id: string): boolean {
  const project = projects.get(id);
  if (!project) return false;

  addLog(project, 'Stopping...');

  killProcess(project.proxyProcess);
  killProcess(project.devProcess);
  project.proxyProcess = null;
  project.devProcess = null;

  releasePort(project.devPort, usedDevPorts);
  releasePort(project.proxyPort, usedProxyPorts);

  project.status = 'stopped';
  addLog(project, 'Stopped — ports released');
  return true;
}

export function getProject(id: string): ProjectProcess | undefined {
  return projects.get(id);
}

export function getProjectLogs(id: string): string[] {
  return projects.get(id)?.logs || [];
}

async function waitForPort(port: number, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://localhost:${port}`).catch(() => null);
      if (res) return;
    } catch {}
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error(`Timeout waiting for port ${port}`);
}
