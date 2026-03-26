import { spawn, type ChildProcess, execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

const WORKSPACE_DIR = process.env.WORKSPACE_DIR || join(process.env.HOME || '/tmp', '.layrr', 'workspaces');
let nextPort = 5100; // dev server ports start here
let nextProxyPort = 6100; // layrr proxy ports start here

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

function allocatePorts() {
  const devPort = nextPort++;
  const proxyPort = nextProxyPort++;
  return { devPort, proxyPort };
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
  // Run framework binaries directly to avoid pnpm arg passing issues
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

export async function startProject(id: string, githubRepo: string, branch: string, githubToken: string): Promise<ProjectProcess> {
  // Check if already running
  const existing = projects.get(id);
  if (existing && existing.status === 'running') return existing;

  const { devPort, proxyPort } = allocatePorts();
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

    // Setup git for layrr
    execSync('git config user.email "layrr@layrr.dev" && git config user.name "Layrr"', { cwd: workDir, stdio: 'pipe' });

    // Detect framework + package manager
    const pm = detectPackageManager(workDir);
    project.framework = detectFramework(workDir);
    addLog(project, `Framework: ${project.framework}, PM: ${pm}`);

    // Install deps
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
    });

    project.devProcess.stdout?.on('data', (d: Buffer) => addLog(project, d.toString().trim()));
    project.devProcess.stderr?.on('data', (d: Buffer) => addLog(project, d.toString().trim()));
    project.devProcess.on('exit', (code) => {
      addLog(project, `Dev server exited with code ${code}`);
      if (project.status === 'running') project.status = 'error';
    });

    // Wait for dev server
    addLog(project, `Waiting for dev server on port ${devPort}...`);
    await waitForPort(devPort, 120000);
    addLog(project, 'Dev server ready');

    // Start layrr proxy
    const layrCli = join(process.cwd(), '..', 'cli', 'dist', 'cli.js');
    addLog(project, `Starting layrr proxy on port ${proxyPort}...`);
    project.proxyProcess = spawn('node', [layrCli, '--port', String(devPort), '--proxy-port', String(proxyPort), '--no-open', '--agent', 'claude'], {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    project.proxyProcess.stdout?.on('data', (d: Buffer) => addLog(project, `[proxy] ${d.toString().trim()}`));
    project.proxyProcess.stderr?.on('data', (d: Buffer) => addLog(project, `[proxy] ${d.toString().trim()}`));
    project.proxyProcess.on('exit', (code) => {
      addLog(project, `Proxy exited with code ${code}`);
      if (project.status === 'running') project.status = 'error';
    });

    // Wait for proxy
    await waitForPort(proxyPort, 30000);
    project.status = 'running';
    addLog(project, `Ready! Proxy at http://localhost:${proxyPort}`);

    return project;
  } catch (err: any) {
    addLog(project, `Error: ${err.message}`);
    project.status = 'error';
    // Clean up processes
    project.devProcess?.kill();
    project.proxyProcess?.kill();
    throw err;
  }
}

export function stopProject(id: string): boolean {
  const project = projects.get(id);
  if (!project) return false;

  project.proxyProcess?.kill();
  project.devProcess?.kill();
  project.proxyProcess = null;
  project.devProcess = null;
  project.status = 'stopped';
  addLog(project, 'Stopped');
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
