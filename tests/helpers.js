// Shared test harness: starts a real NoChat server on a temporary local data folder.
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
export function server(port, extraEnv = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nochat-' + port + '-'));
  const B = `http://localhost:${port}`;
  const env = { ...process.env, PORT: String(port), JWT_SECRET: ('t' + port).padEnd(64, 'x'), DATA_DIR: path.join(tmp, 'db'), UPLOADS_DIR: path.join(tmp, 'up'), NODE_ENV: 'development',
    TURN_SECRET: '', TURN_URLS: '', TURN_URL: '', TURN_USERNAME: '', TURN_PASSWORD: '', CLOUDFLARE_TURN_KEY_ID: '', METERED_TURN_DOMAIN: '', NOCHAT_CLOUD_URL: '', NOCHAT_BRIDGE_SECRET: '', ...extraEnv };
  let proc;
  const s = {
    B, tmp,
    start: () => new Promise((res, rej) => {
      proc = spawn(process.execPath, ['server.js'], { env, stdio: ['ignore', 'ignore', 'pipe'] });
      let err = ''; proc.stderr.on('data', (d) => { err += d; });
      proc.once('exit', (code) => { if (code) rej(new Error('server exited: ' + err)); });
      const t = setInterval(() => fetch(B + '/api/health').then(() => { clearInterval(t); res(); }).catch(() => {}), 150);
    }),
    stop: () => new Promise((r) => { if (!proc || proc.exitCode !== null) return r(); proc.once('exit', r); proc.kill('SIGTERM'); }),
    cleanup: () => fs.rmSync(tmp, { recursive: true, force: true }),
    async call(p, { cookie, method = 'GET', body, form } = {}) {
      const headers = { ...(cookie ? { cookie } : {}) };
      if (body) headers['Content-Type'] = 'application/json';
      const r = await fetch(B + p, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
      return { status: r.status, cookie: r.headers.get('set-cookie')?.split(';')[0], data: await r.json().catch(() => ({})) };
    },
    async register(username) {
      const r = await s.call('/api/auth/register', { method: 'POST', body: { username, password: username + '-pass-1', displayName: username[0].toUpperCase() + username.slice(1) } });
      if (r.status !== 201 && r.status !== 200) throw new Error('register ' + username + ' ' + r.status + ' ' + JSON.stringify(r.data));
      return { cookie: r.cookie, id: r.data.user.id, username };
    },
    async befriend(a, b) {
      await s.call('/api/friends/request', { cookie: a.cookie, method: 'POST', body: { userId: b.id } });
      const r = await s.call('/api/friends/request', { cookie: b.cookie, method: 'POST', body: { userId: a.id } });
      if (r.status >= 400) throw new Error('befriend failed ' + JSON.stringify(r.data));
    }
  };
  return s;
}
