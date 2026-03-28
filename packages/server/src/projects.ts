import { spawn, type ChildProcess, execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { createServer } from 'net';
import { randomUUID } from 'crypto';

const DOCKER_MODE = process.env.LAYRR_MODE === 'docker';
const DOCKER_IMAGE = process.env.LAYRR_DOCKER_IMAGE || 'layrr-container';
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
  accessToken: string;
  slug?: string;
}

const projects = new Map<string, ProjectProcess>();
const usedDevPorts = new Set<number>();
const usedProxyPorts = new Set<number>();

// ── Shared utilities ──

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
    process.kill(-proc.pid!, 'SIGTERM');
  } catch {
    try { proc.kill('SIGTERM'); } catch {}
  }
  setTimeout(() => {
    try { proc.kill('SIGKILL'); } catch {}
  }, 5000);
}

// ── Docker helpers ──

function dockerContainerName(id: string): string {
  return `layrr-${id}`;
}

function dockerExec(id: string, cmd: string): string {
  return execSync(`docker exec ${dockerContainerName(id)} sh -c "${cmd.replace(/"/g, '\\"')}"`, {
    encoding: 'utf-8',
    timeout: 30000,
  }).trim();
}

function dockerIsRunning(id: string): boolean {
  try {
    const status = execSync(`docker inspect --format='{{.State.Status}}' ${dockerContainerName(id)} 2>/dev/null`, {
      encoding: 'utf-8',
    }).trim();
    return status === 'running';
  } catch {
    return false;
  }
}

function dockerStop(id: string) {
  const name = dockerContainerName(id);
  try { execSync(`docker stop ${name} 2>/dev/null`, { stdio: 'pipe', timeout: 15000 }); } catch {}
  try { execSync(`docker rm ${name} 2>/dev/null`, { stdio: 'pipe' }); } catch {}
}

// ── startProject ──

export async function startProject(id: string, githubRepo: string, branch: string, githubToken: string, gitUsername?: string, gitEmail?: string, sharePassword?: string, slug?: string): Promise<ProjectProcess> {
  const existing = projects.get(id);
  if (existing && existing.status === 'running') return existing;

  if (existing) {
    releasePort(existing.devPort, usedDevPorts);
    releasePort(existing.proxyPort, usedProxyPorts);
  }

  if (DOCKER_MODE) {
    return startProjectDocker(id, githubRepo, branch, githubToken, gitUsername, gitEmail, sharePassword, slug);
  }
  return startProjectLocal(id, githubRepo, branch, githubToken, gitUsername, gitEmail, sharePassword, slug);
}

async function startProjectDocker(id: string, githubRepo: string, branch: string, githubToken: string, gitUsername?: string, gitEmail?: string, sharePassword?: string, slug?: string): Promise<ProjectProcess> {
  const proxyPort = await allocatePort(PROXY_PORT_START, PROXY_PORT_END, usedProxyPorts);
  const accessToken = randomUUID();
  const workDir = join(WORKSPACE_DIR, id);

  const project: ProjectProcess = {
    id, githubRepo, branch,
    framework: null,
    devProcess: null, proxyProcess: null,
    devPort: 0, proxyPort,
    status: 'starting',
    logs: [],
    workDir,
    accessToken,
    slug,
  };
  projects.set(id, project);

  try {
    // Stop existing container if any
    dockerStop(id);

    const containerName = dockerContainerName(id);
    const envArgs: string[] = [];

    const addEnv = (key: string, value: string | undefined) => {
      if (value) envArgs.push('-e', `${key}=${value}`);
    };

    addEnv('GITHUB_REPO', githubRepo);
    addEnv('GITHUB_BRANCH', branch);
    addEnv('GITHUB_TOKEN', githubToken);
    addEnv('GIT_USERNAME', gitUsername);
    addEnv('GIT_EMAIL', gitEmail);
    addEnv('LAYRR_ACCESS_TOKEN', accessToken);
    addEnv('LAYRR_SHARE_PASSWORD', sharePassword);
    addEnv('LAYRR_AGENT', process.env.LAYRR_AGENT || 'pi-mono');
    addEnv('OPENROUTER_API_KEY', process.env.OPENROUTER_API_KEY);

    // Mount workspace for persistence across restarts
    mkdirSync(workDir, { recursive: true });

    const args = [
      'run', '-d',
      '--name', containerName,
      '--cpus=1', '--memory=1g',
      '-p', `${proxyPort}:4567`,
      '-v', `${workDir}:/workspace/repo`,
      ...envArgs,
      DOCKER_IMAGE,
    ];

    addLog(project, `Starting Docker container on port ${proxyPort}...`);
    execSync(`docker ${args.join(' ')}`, { stdio: 'pipe' });

    // Wait for container to be healthy
    addLog(project, 'Waiting for container...');
    await waitForPort(proxyPort, 180000);

    // Detect framework from workspace
    try {
      project.framework = detectFramework(workDir);
    } catch {}

    project.status = 'running';
    addLog(project, `Ready! Proxy: ${proxyPort}`);
    return project;
  } catch (err: any) {
    addLog(project, `Error: ${err.message}`);
    project.status = 'error';
    dockerStop(id);
    releasePort(proxyPort, usedProxyPorts);
    throw err;
  }
}

async function startProjectLocal(id: string, githubRepo: string, branch: string, githubToken: string, gitUsername?: string, gitEmail?: string, sharePassword?: string, slug?: string): Promise<ProjectProcess> {
  const devPort = await allocatePort(DEV_PORT_START, DEV_PORT_END, usedDevPorts);
  const proxyPort = await allocatePort(PROXY_PORT_START, PROXY_PORT_END, usedProxyPorts);
  const workDir = join(WORKSPACE_DIR, id);

  const accessToken = randomUUID();
  const project: ProjectProcess = {
    id, githubRepo, branch,
    framework: null,
    devProcess: null, proxyProcess: null,
    devPort, proxyPort,
    status: 'starting',
    logs: [],
    workDir,
    accessToken,
    slug,
  };
  projects.set(id, project);

  try {
    mkdirSync(WORKSPACE_DIR, { recursive: true });

    if (existsSync(join(workDir, '.git'))) {
      addLog(project, 'Workspace exists, reusing...');
    } else if (githubRepo && githubToken) {
      addLog(project, `Cloning ${githubRepo}...`);
      execSync(
        `git clone --depth 1 --branch ${branch} https://x-access-token:${githubToken}@github.com/${githubRepo}.git ${workDir}`,
        { stdio: 'pipe' }
      );
    } else {
      throw new Error('No workspace found and no GitHub repo to clone. Try "Fresh Clone" or create a new project.');
    }

    const email = gitEmail || 'layrr@layrr.dev';
    const name = gitUsername || 'Layrr';
    execSync(`git config user.email "${email}" && git config user.name "${name}"`, { cwd: workDir, stdio: 'pipe' });
    addLog(project, `Git identity: ${name} <${email}>`);

    const pm = detectPackageManager(workDir);
    project.framework = detectFramework(workDir);
    addLog(project, `Framework: ${project.framework}, PM: ${pm}`);

    addLog(project, 'Installing dependencies...');
    execSync(`${pm} install`, { cwd: workDir, stdio: 'pipe', timeout: 120000 });
    addLog(project, 'Dependencies installed');

    const devCmd = getDevCommand(project.framework, pm, devPort);
    addLog(project, `Starting dev server: ${devCmd.cmd} ${devCmd.args.join(' ')}`);
    project.devProcess = spawn(devCmd.cmd, devCmd.args, {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: String(devPort), HOST: '0.0.0.0' },
      detached: true,
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

    const layrCli = join(process.cwd(), '..', 'cli', 'dist', 'cli.js');
    addLog(project, `Starting layrr proxy on port ${proxyPort}...`);
    const agent = process.env.LAYRR_AGENT || 'pi-mono';
    const proxyEnv: Record<string, string> = {
      ...process.env as Record<string, string>,
      LAYRR_ACCESS_TOKEN: accessToken,
    };
    if (sharePassword) proxyEnv.LAYRR_SHARE_PASSWORD = sharePassword;

    project.proxyProcess = spawn('node', [layrCli, '--port', String(devPort), '--proxy-port', String(proxyPort), '--no-open', '--agent', agent], {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: proxyEnv,
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

// ── createFromTemplate ──

export async function createFromTemplate(id: string, name: string, prompt: string, gitUsername?: string, gitEmail?: string, sharePassword?: string, slug?: string): Promise<ProjectProcess> {
  const existing = projects.get(id);
  if (existing && existing.status === 'running') return existing;
  if (existing) {
    releasePort(existing.devPort, usedDevPorts);
    releasePort(existing.proxyPort, usedProxyPorts);
  }

  if (DOCKER_MODE) {
    return createFromTemplateDocker(id, name, prompt, gitUsername, gitEmail, sharePassword, slug);
  }
  return createFromTemplateLocal(id, name, prompt, gitUsername, gitEmail, sharePassword, slug);
}

async function createFromTemplateDocker(id: string, name: string, prompt: string, gitUsername?: string, gitEmail?: string, sharePassword?: string, slug?: string): Promise<ProjectProcess> {
  const proxyPort = await allocatePort(PROXY_PORT_START, PROXY_PORT_END, usedProxyPorts);
  const workDir = join(WORKSPACE_DIR, id);
  const templateDir = join(process.cwd(), 'templates', 'nextjs-shadcn');

  const accessToken = randomUUID();
  const project: ProjectProcess = {
    id, githubRepo: '', branch: 'main',
    framework: 'nextjs',
    devProcess: null, proxyProcess: null,
    devPort: 0, proxyPort,
    status: 'starting',
    logs: [],
    workDir,
    accessToken,
    slug,
  };
  projects.set(id, project);

  try {
    mkdirSync(WORKSPACE_DIR, { recursive: true });

    // Prepare workspace with template
    addLog(project, `Creating ${name} from template...`);
    execSync(`cp -r "${templateDir}" "${workDir}"`, { stdio: 'pipe' });

    // Init git
    execSync('git init', { cwd: workDir, stdio: 'pipe' });
    const email = gitEmail || 'layrr@layrr.dev';
    const uname = gitUsername || 'Layrr';
    execSync(`git config user.email "${email}" && git config user.name "${uname}"`, { cwd: workDir, stdio: 'pipe' });
    execSync('git add -A && git commit -m "initial template"', { cwd: workDir, stdio: 'pipe' });

    // Stop existing container if any
    dockerStop(id);

    const containerName = dockerContainerName(id);
    const envArgs: string[] = [];
    const addEnv = (key: string, value: string | undefined) => {
      if (value) envArgs.push('-e', `${key}=${value}`);
    };

    addEnv('TEMPLATE_MODE', 'true');
    addEnv('GIT_USERNAME', gitUsername);
    addEnv('GIT_EMAIL', gitEmail);
    addEnv('LAYRR_ACCESS_TOKEN', accessToken);
    addEnv('LAYRR_SHARE_PASSWORD', sharePassword);
    addEnv('LAYRR_AGENT', process.env.LAYRR_AGENT || 'pi-mono');
    addEnv('OPENROUTER_API_KEY', process.env.OPENROUTER_API_KEY);

    const args = [
      'run', '-d',
      '--name', containerName,
      '--cpus=1', '--memory=1g',
      '-p', `${proxyPort}:4567`,
      '-v', `${workDir}:/workspace/repo`,
      ...envArgs,
      DOCKER_IMAGE,
    ];

    addLog(project, `Starting Docker container on port ${proxyPort}...`);
    execSync(`docker ${args.join(' ')}`, { stdio: 'pipe' });

    addLog(project, 'Waiting for container...');
    await waitForPort(proxyPort, 180000);

    // Run initial prompt
    if (prompt) {
      addLog(project, 'Generating initial version...');
      try {
        await sendEditViaProxy(proxyPort, prompt);
        addLog(project, 'Initial version generated');
      } catch (err: any) {
        addLog(project, `Generation warning: ${err.message}`);
      }
    }

    project.status = 'running';
    addLog(project, `Ready! Proxy: ${proxyPort}`);
    return project;
  } catch (err: any) {
    addLog(project, `Error: ${err.message}`);
    project.status = 'error';
    dockerStop(id);
    releasePort(proxyPort, usedProxyPorts);
    throw err;
  }
}

async function createFromTemplateLocal(id: string, name: string, prompt: string, gitUsername?: string, gitEmail?: string, sharePassword?: string, slug?: string): Promise<ProjectProcess> {
  const devPort = await allocatePort(DEV_PORT_START, DEV_PORT_END, usedDevPorts);
  const proxyPort = await allocatePort(PROXY_PORT_START, PROXY_PORT_END, usedProxyPorts);
  const workDir = join(WORKSPACE_DIR, id);
  const templateDir = join(process.cwd(), 'templates', 'nextjs-shadcn');

  const accessToken = randomUUID();
  const project: ProjectProcess = {
    id, githubRepo: '', branch: 'main',
    framework: 'nextjs',
    devProcess: null, proxyProcess: null,
    devPort, proxyPort,
    status: 'starting',
    logs: [],
    workDir,
    accessToken,
    slug,
  };
  projects.set(id, project);

  try {
    mkdirSync(WORKSPACE_DIR, { recursive: true });

    addLog(project, `Creating ${name} from template...`);
    execSync(`cp -r "${templateDir}" "${workDir}"`, { stdio: 'pipe' });

    execSync('git init', { cwd: workDir, stdio: 'pipe' });
    const email = gitEmail || 'layrr@layrr.dev';
    const uname = gitUsername || 'Layrr';
    execSync(`git config user.email "${email}" && git config user.name "${uname}"`, { cwd: workDir, stdio: 'pipe' });
    execSync('git add -A && git commit -m "initial template"', { cwd: workDir, stdio: 'pipe' });

    addLog(project, 'Installing dependencies...');
    execSync('pnpm install', { cwd: workDir, stdio: 'pipe', timeout: 120000 });
    addLog(project, 'Dependencies installed');

    const devCmd = getDevCommand('nextjs', 'pnpm', devPort);
    addLog(project, `Starting dev server on port ${devPort}...`);
    project.devProcess = spawn(devCmd.cmd, devCmd.args, {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: String(devPort), HOST: '0.0.0.0' },
      detached: true,
    });
    project.devProcess.stdout?.on('data', (d: Buffer) => addLog(project, d.toString().trim()));
    project.devProcess.stderr?.on('data', (d: Buffer) => addLog(project, d.toString().trim()));
    project.devProcess.on('exit', (code: number | null) => {
      if (project.status === 'running') { project.status = 'error'; releasePort(devPort, usedDevPorts); }
    });

    addLog(project, 'Waiting for dev server...');
    await waitForPort(devPort, 120000);
    addLog(project, 'Dev server ready');

    const layrCli = join(process.cwd(), '..', 'cli', 'dist', 'cli.js');
    const agent = process.env.LAYRR_AGENT || 'pi-mono';
    addLog(project, `Starting layrr proxy on port ${proxyPort}...`);
    const templateProxyEnv: Record<string, string> = {
      ...process.env as Record<string, string>,
      LAYRR_ACCESS_TOKEN: accessToken,
    };
    if (sharePassword) templateProxyEnv.LAYRR_SHARE_PASSWORD = sharePassword;

    project.proxyProcess = spawn('node', [layrCli, '--port', String(devPort), '--proxy-port', String(proxyPort), '--no-open', '--agent', agent], {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: templateProxyEnv,
      detached: true,
    });
    project.proxyProcess.stdout?.on('data', (d: Buffer) => addLog(project, `[proxy] ${d.toString().trim()}`));
    project.proxyProcess.stderr?.on('data', (d: Buffer) => addLog(project, `[proxy] ${d.toString().trim()}`));
    project.proxyProcess.on('exit', (code: number | null) => {
      if (project.status === 'running') { project.status = 'error'; releasePort(proxyPort, usedProxyPorts); }
    });

    await waitForPort(proxyPort, 30000);

    if (prompt) {
      addLog(project, 'Generating initial version...');
      try {
        await sendEditViaProxy(proxyPort, prompt);
        addLog(project, 'Initial version generated');
      } catch (err: any) {
        addLog(project, `Generation warning: ${err.message}`);
      }
    }

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

// ── stopProject ──

export function stopProject(id: string): boolean {
  if (DOCKER_MODE) {
    dockerStop(id);
    const project = projects.get(id);
    if (project) {
      releasePort(project.proxyPort, usedProxyPorts);
      project.status = 'stopped';
      addLog(project, 'Container stopped and removed');
    }
    return true;
  }

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

// ── freshClone ──

export function freshClone(id: string): boolean {
  if (DOCKER_MODE) {
    dockerStop(id);
    const workDir = join(WORKSPACE_DIR, id);
    try {
      execSync(`rm -rf "${workDir}"`, { stdio: 'pipe' });
      return true;
    } catch { return false; }
  }

  const project = projects.get(id);
  if (!project) return false;
  if (project.status === 'running') return false;

  const workDir = project.workDir;
  try {
    execSync(`rm -rf "${workDir}"`, { stdio: 'pipe' });
    addLog(project, 'Workspace deleted — will fresh clone on next start');
    return true;
  } catch (err: any) {
    addLog(project, `Fresh clone cleanup failed: ${err.message}`);
    return false;
  }
}

// ── linkGithubRepo ──

export function linkGithubRepo(id: string, githubRepo: string, githubToken: string): { success: boolean; message: string } {
  if (DOCKER_MODE && dockerIsRunning(id)) {
    try {
      const remoteUrl = `https://x-access-token:${githubToken}@github.com/${githubRepo}.git`;
      dockerExec(id, `cd /workspace/repo && git remote add origin '${remoteUrl}' 2>/dev/null || git remote set-url origin '${remoteUrl}'`);
      dockerExec(id, 'cd /workspace/repo && git push -u origin HEAD:main');
      dockerExec(id, 'cd /workspace/repo && git fetch origin');
      const project = projects.get(id);
      if (project) { project.githubRepo = githubRepo; project.branch = 'main'; }
      return { success: true, message: `Pushed to ${githubRepo}` };
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to push' };
    }
  }

  // Local mode (or container not running — use workspace directly)
  const workDir = join(WORKSPACE_DIR, id);
  if (!existsSync(join(workDir, '.git'))) {
    return { success: false, message: 'No workspace found' };
  }

  try {
    const remoteUrl = `https://x-access-token:${githubToken}@github.com/${githubRepo}.git`;
    try {
      execSync('git remote get-url origin', { cwd: workDir, stdio: 'pipe' });
      execSync(`git remote set-url origin "${remoteUrl}"`, { cwd: workDir, stdio: 'pipe' });
    } catch {
      execSync(`git remote add origin "${remoteUrl}"`, { cwd: workDir, stdio: 'pipe' });
    }
    execSync('git push -u origin HEAD:main', { cwd: workDir, stdio: 'pipe' });
    execSync('git fetch origin', { cwd: workDir, stdio: 'pipe' });
    const project = projects.get(id);
    if (project) { project.githubRepo = githubRepo; project.branch = 'main'; }
    return { success: true, message: `Pushed to ${githubRepo}` };
  } catch (err: any) {
    return { success: false, message: err.message || 'Failed to push' };
  }
}

// ── pushChanges ──

export function pushChanges(id: string, targetBranch: string, githubToken: string, githubRepo?: string): { success: boolean; message: string } {
  if (DOCKER_MODE && dockerIsRunning(id)) {
    const repo = githubRepo || projects.get(id)?.githubRepo;
    if (!repo) return { success: false, message: 'No GitHub repo linked' };
    try {
      const remoteUrl = `https://x-access-token:${githubToken}@github.com/${repo}.git`;
      dockerExec(id, `cd /workspace/repo && git remote set-url origin '${remoteUrl}' 2>/dev/null || git remote add origin '${remoteUrl}'`);
      const log = dockerExec(id, `cd /workspace/repo && git log --oneline --grep='\\[layrr\\]' origin/${targetBranch}..HEAD 2>/dev/null || echo ""`);
      if (!log) return { success: false, message: 'No layrr edits to push' };
      const commitCount = log.split('\n').filter(Boolean).length;
      dockerExec(id, `cd /workspace/repo && git push origin HEAD:${targetBranch}`);
      return { success: true, message: `Pushed ${commitCount} edit(s) to ${targetBranch}` };
    } catch (err: any) {
      return { success: false, message: err.message || 'Push failed' };
    }
  }

  // Local mode
  const project = projects.get(id);
  const workDir = project?.workDir || join(WORKSPACE_DIR, id);
  const repo = githubRepo || project?.githubRepo;

  if (!existsSync(join(workDir, '.git'))) {
    return { success: false, message: 'No workspace found' };
  }
  if (!repo) {
    return { success: false, message: 'No GitHub repo linked' };
  }

  try {
    const remoteUrl = `https://x-access-token:${githubToken}@github.com/${repo}.git`;
    try {
      execSync(`git remote set-url origin "${remoteUrl}"`, { cwd: workDir, stdio: 'pipe' });
    } catch {
      execSync(`git remote add origin "${remoteUrl}"`, { cwd: workDir, stdio: 'pipe' });
    }
    const trackingBranch = `origin/${targetBranch}`;
    const log = execSync(`git log --oneline --grep="\\[layrr\\]" ${trackingBranch}..HEAD 2>/dev/null || echo ""`, { cwd: workDir, encoding: 'utf-8' }).trim();
    if (!log) {
      return { success: false, message: 'No layrr edits to push' };
    }
    const commitCount = log.split('\n').filter(Boolean).length;
    if (targetBranch === (project?.branch || 'main')) {
      execSync(`git push origin HEAD:${targetBranch}`, { cwd: workDir, stdio: 'pipe' });
    } else {
      execSync(`git push origin HEAD:refs/heads/${targetBranch}`, { cwd: workDir, stdio: 'pipe' });
    }
    if (project) addLog(project, `Pushed ${commitCount} edit(s) to ${targetBranch}`);
    return { success: true, message: `Pushed ${commitCount} edit(s) to ${targetBranch}` };
  } catch (err: any) {
    const msg = err.message || 'Push failed';
    if (project) addLog(project, `Push failed: ${msg}`);
    return { success: false, message: msg };
  }
}

// ── getProject ──

export function getProject(id: string): ProjectProcess & { editCount?: number } | undefined {
  const project = projects.get(id);

  // In Docker mode, check if container is actually running
  if (DOCKER_MODE && project && project.status === 'running' && !dockerIsRunning(id)) {
    project.status = 'error';
  }

  if (!project) return undefined;
  return { ...project, editCount: getEditCount(id) };
}

export function getProjectBySlug(slug: string): ProjectProcess | undefined {
  for (const project of projects.values()) {
    if (project.slug === slug && project.status === 'running') return project;
  }
  return undefined;
}

// ── getEditCount / getEditHistory / getLogs ──

export function getEditCount(id: string): number {
  if (DOCKER_MODE && dockerIsRunning(id)) {
    try {
      const log = dockerExec(id, "cd /workspace/repo && git log --oneline --grep='\\[layrr\\]' 2>/dev/null || echo ''");
      return log ? log.split('\n').filter(Boolean).length : 0;
    } catch { return 0; }
  }

  const workDir = join(WORKSPACE_DIR, id);
  try {
    if (existsSync(join(workDir, '.git'))) {
      const log = execSync('git log --oneline --grep="\\[layrr\\]" 2>/dev/null || echo ""', {
        cwd: workDir, encoding: 'utf-8',
      }).trim();
      return log ? log.split('\n').filter(Boolean).length : 0;
    }
  } catch {}
  return 0;
}

export function getProjectLogs(id: string): string[] {
  return projects.get(id)?.logs || [];
}

export function getEditHistory(id: string): Array<{ message: string; timeAgo: string; hash: string }> {
  if (DOCKER_MODE && dockerIsRunning(id)) {
    try {
      const log = dockerExec(id, "cd /workspace/repo && git log --grep='\\[layrr\\]' --format='%H|%s|%ar' -20 2>/dev/null || echo ''");
      if (!log) return [];
      return log.split('\n').filter(Boolean).map(line => {
        const [hash, ...rest] = line.split('|');
        const timeAgo = rest.pop()!;
        const message = rest.join('|').replace('[layrr] ', '');
        return { hash, message, timeAgo };
      });
    } catch { return []; }
  }

  const workDir = join(WORKSPACE_DIR, id);
  if (!existsSync(join(workDir, '.git'))) return [];
  try {
    const log = execSync(
      'git log --grep="\\[layrr\\]" --format="%H|%s|%ar" -20 2>/dev/null || echo ""',
      { cwd: workDir, encoding: 'utf-8' }
    ).trim();
    if (!log) return [];
    return log.split('\n').filter(Boolean).map(line => {
      const [hash, ...rest] = line.split('|');
      const timeAgo = rest.pop()!;
      const message = rest.join('|').replace('[layrr] ', '');
      return { hash, message, timeAgo };
    });
  } catch {
    return [];
  }
}

// ── cleanup ──

export async function cleanupOrphanProcesses() {
  if (DOCKER_MODE) {
    console.log('[layrr-server] Cleaning up orphan containers...');
    try {
      const containers = execSync('docker ps -a --filter "name=layrr-" --format "{{.Names}}" 2>/dev/null || echo ""', {
        encoding: 'utf-8',
      }).trim();
      if (containers) {
        const names = containers.split('\n').filter(Boolean);
        for (const name of names) {
          try { execSync(`docker rm -f ${name}`, { stdio: 'pipe' }); } catch {}
        }
        console.log(`[layrr-server] Removed ${names.length} orphan container(s)`);
      } else {
        console.log('[layrr-server] No orphan containers found');
      }
    } catch {}
    return;
  }

  console.log('[layrr-server] Checking for orphan processes...');
  let killed = 0;
  for (let port = DEV_PORT_START; port <= PROXY_PORT_END; port++) {
    const inUse = await isPortInUse(port);
    if (inUse) {
      try {
        const pid = execSync(`lsof -ti :${port} 2>/dev/null || echo ""`, { encoding: 'utf-8' }).trim();
        if (pid) {
          pid.split('\n').forEach(p => {
            try { process.kill(Number(p), 'SIGKILL'); killed++; } catch {}
          });
        }
      } catch {}
    }
  }
  if (killed > 0) {
    console.log(`[layrr-server] Killed ${killed} orphan process(es)`);
    await new Promise(r => setTimeout(r, 1000));
  } else {
    console.log('[layrr-server] No orphan processes found');
  }
}

// ── internal helpers ──

async function sendEditViaProxy(proxyPort: number, prompt: string): Promise<void> {
  const WebSocket = (await import('ws')).default;

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${proxyPort}/__layrr__/ws`);
    const timeout = setTimeout(() => { ws.close(); reject(new Error('Edit timed out')); }, 180000);

    ws.on('open', () => {
      const enhancedPrompt = `You are building a Next.js web application with Tailwind CSS and shadcn/ui components.\n\nThe user wants: ${prompt}\n\nEdit the files in this project to build what the user described. Focus on src/app/page.tsx as the main page. Use shadcn components where appropriate. Use lucide-react for icons and framer-motion for animations (both already installed). Make it look professional and modern.`;

      ws.send(JSON.stringify({
        type: 'edit-request',
        selector: 'body',
        tagName: 'body',
        className: '',
        textContent: '',
        instruction: enhancedPrompt,
        sourceInfo: { file: 'src/app/page.tsx', line: 1 },
      }));
    });

    ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'edit-result') {
          clearTimeout(timeout);
          ws.close();
          if (msg.success) resolve();
          else reject(new Error(msg.message || 'Edit failed'));
        }
      } catch {}
    });

    ws.on('error', (err: Error) => { clearTimeout(timeout); reject(err); });
  });
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
