import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(__filename);
const desktopDir = path.resolve(scriptsDir, '..');
const rootDir = path.resolve(scriptsDir, '../../..');
const appUrl = process.env.LAYCODE_APP_URL || 'http://localhost:3000/dashboard';

function canConnect(url) {
  return fetch(url, { method: 'GET' })
    .then((res) => res.ok)
    .catch(() => false);
}

async function waitForServer(url, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await canConnect(url);
    if (ok) return true;
    await delay(800);
  }
  return false;
}

const devProc = spawn('bash', ['./dev.sh'], {
  cwd: rootDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    LAYCODE_LOCAL_MODE: process.env.LAYCODE_LOCAL_MODE || '1',
  },
});

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    devProc.kill('SIGTERM');
  } catch {}
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

devProc.on('exit', (code) => {
  if (!shuttingDown) {
    console.error(`LayCode dev services exited unexpectedly with code ${code ?? 1}`);
    process.exit(code ?? 1);
  }
});

console.log('Waiting for LayCode dashboard to be ready...');
const ready = await waitForServer(appUrl);
if (!ready) {
  console.error(`Timed out waiting for ${appUrl}`);
  shutdown(1);
}

const electronCmd = process.platform === 'win32' ? 'electron.cmd' : 'electron';
const electronProc = spawn(electronCmd, ['main.js'], {
  cwd: desktopDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    LAYCODE_APP_URL: appUrl,
  },
});

electronProc.on('exit', (code) => {
  shutdown(code ?? 0);
});
