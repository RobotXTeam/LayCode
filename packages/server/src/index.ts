import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { startProject, stopProject, getProject, getProjectLogs } from './projects.js';

const app = new Hono();
const PORT = Number(process.env.SERVER_PORT || 8787);

app.use('*', cors());

// Auth middleware
app.use('*', async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  const expected = process.env.SERVER_SECRET || 'dev-secret';
  if (token !== expected) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
});

// Start a project
app.post('/projects/:id/start', async (c) => {
  const { id } = c.req.param();
  const { githubRepo, branch, githubToken } = await c.req.json();

  if (!githubRepo || !githubToken) {
    return c.json({ error: 'Missing githubRepo or githubToken' }, 400);
  }

  try {
    const project = await startProject(id, githubRepo, branch || 'main', githubToken);
    return c.json({
      status: project.status,
      proxyPort: project.proxyPort,
      devPort: project.devPort,
      framework: project.framework,
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Stop a project
app.post('/projects/:id/stop', (c) => {
  const { id } = c.req.param();
  const stopped = stopProject(id);
  return c.json({ status: stopped ? 'stopped' : 'not_found' });
});

// Get project status
app.get('/projects/:id/status', (c) => {
  const { id } = c.req.param();
  const project = getProject(id);
  if (!project) {
    return c.json({ status: 'stopped' });
  }
  return c.json({
    status: project.status,
    proxyPort: project.proxyPort,
    devPort: project.devPort,
    framework: project.framework,
  });
});

// Get project logs
app.get('/projects/:id/logs', (c) => {
  const { id } = c.req.param();
  const logs = getProjectLogs(id);
  return c.json({ logs });
});

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`[layrr-server] Running on http://localhost:${PORT}`);
});
