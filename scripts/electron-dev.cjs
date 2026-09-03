const { spawn } = require('child_process');
const http = require('http');

let frontendProcess = null;
let electronProcess = null;

function checkUrl(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 400 && (body.includes('vite') || body.includes('root') || body.includes('<html') || body.includes('<body'))) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForActiveViteUrl(maxRetries = 30) {
  const ports = [3000, 3001, 3002, 3003];
  console.log('[DevLauncher] Waiting for Vite Frontend dev server to be ready...');
  for (let i = 0; i < maxRetries; i++) {
    for (const port of ports) {
      const url = `http://127.0.0.1:${port}`;
      if (await checkUrl(url)) {
        console.log(`[DevLauncher] ✅ Vite Frontend dev server is ready at ${url}`);
        return url;
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  console.warn('[DevLauncher] ⚠️ Dev server check timed out, using default http://127.0.0.1:3000');
  return 'http://127.0.0.1:3000';
}

function startFrontend() {
  console.log('[DevLauncher] 🚀 Starting Frontend Vite Dev Server...');
  frontendProcess = spawn('npm', ['--prefix', 'frontend', 'run', 'dev'], {
    shell: true,
    stdio: 'inherit'
  });
}

function cleanup() {
  console.log('[DevLauncher] Terminating child processes...');
  if (electronProcess) try { electronProcess.kill(); } catch (e) {}
  if (frontendProcess) try { frontendProcess.kill(); } catch (e) {}
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

async function main() {
  startFrontend();

  const targetViteUrl = await waitForActiveViteUrl();
  console.log(`[DevLauncher] ⚡ Launching Electron Main Window pointing to ${targetViteUrl}...`);

  electronProcess = spawn('npx', ['electron', '.'], {
    shell: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development',
      ELECTRON_START_URL: targetViteUrl
    }
  });

  electronProcess.on('error', (err) => {
    console.error('[DevLauncher] Error launching Electron:', err.message);
  });

  electronProcess.on('close', (code) => {
    console.log(`[DevLauncher] Electron window exited with code ${code}.`);
    cleanup();
  });
}

main().catch((err) => {
  console.error('[DevLauncher] Fatal error:', err);
  cleanup();
});
