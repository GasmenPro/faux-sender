#!/usr/bin/env node
/** Small dependency-free local dashboard and webhook proxy. Node 18+. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMockStore } from './mock-store.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assets = {
  '/': ['public/index.html', 'text/html; charset=utf-8'],
  '/styles.css': ['public/styles.css', 'text/css; charset=utf-8'],
  '/app.js': ['public/app.js', 'text/javascript; charset=utf-8'],
  '/assets/events.js': ['src/events.js', 'text/javascript; charset=utf-8'],
};
const MAX_BODY = 64 * 1024;
const MAX_RESPONSE = 16 * 1024;

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}

async function readRequestBody(req) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > MAX_BODY) {
      const error = new Error('Request too large (64 KB limit).');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch {
    const error = new Error('Expected valid JSON.');
    error.status = 400;
    throw error;
  }
}

function validateTarget(target) {
  let url;
  try { url = new URL(target); }
  catch { throw new Error('Please enter a valid webhook URL.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Use an HTTP(S) URL without embedded credentials.');
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (!local && process.env.ALLOW_REMOTE_TARGETS !== '1') {
    throw new Error('Remote targets are off. For approved staging endpoints only, start with ALLOW_REMOTE_TARGETS=1.');
  }
  if (!local && url.protocol !== 'https:') {
    throw new Error('Remote webhook targets must use HTTPS.');
  }
  if (url.hash) throw new Error('Webhook URLs cannot include a fragment (#).');
  return url;
}

export function createDashboardServer() {
  const mockStore = createMockStore();
  return createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'self'");
    const path = (req.url || '').split('?')[0];
    // Same-origin check helps prevent other sites from invoking this localhost dev utility.
    if (req.method === 'POST' && req.headers.origin && req.headers.origin !== `http://${req.headers.host}` && req.headers.origin !== `https://${req.headers.host}`) {
      sendJson(res, 403, { error: 'Cross-origin requests are not allowed.' });
      return;
    }
    if (req.method === 'GET' && Object.hasOwn(assets, path)) {
      const [filePath, type] = assets[path];
      try {
        const contents = await readFile(join(root, filePath));
        res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
        res.end(contents);
      } catch {
        sendJson(res, 500, { error: 'Unable to read dashboard file.' });
      }
      return;
    }
    if (req.method === 'GET' && path === '/api/health') {
      sendJson(res, 200, { ok: true, app: 'Bean Webhook Lab', remote_targets_enabled: process.env.ALLOW_REMOTE_TARGETS === '1' });
      return;
    }
    if (req.method === 'GET' && path === '/api/mock/state') {
      sendJson(res, 200, mockStore.snapshot());
      return;
    }
    if (req.method === 'POST' && path === '/api/mock/reset') {
      sendJson(res, 200, mockStore.reset());
      return;
    }
    if (req.method === 'POST' && path === '/mock/webhook') {
      try {
        const raw = await readRequestBody(req);
        const result = mockStore.ingest(raw);
        sendJson(res, result.status, result.body);
      } catch (error) {
        sendJson(res, error.status || 500, { error: error.message });
      }
      return;
    }
    if (req.method === 'POST' && path === '/api/send') {
      try {
        const config = await readRequestBody(req);
        if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Invalid request configuration.');
        const target = validateTarget(config.targetUrl);
        if (typeof config.body !== 'string' || !config.body.length || config.body.length > 32_768) {
          throw new Error('Body must be a non-empty string no longer than 32 KB.');
        }
        if (config.token !== undefined && (typeof config.token !== 'string' || config.token.length > 4096)) {
          throw new Error('Invalid bearer token.');
        }
        // Never reflect the token in errors or responses, or print it to logs.
        const headers = { 'Content-Type': 'application/json', 'User-Agent': 'Bean-Faux-Sender/0.2' };
        if (config.token) headers.Authorization = `Bearer ${config.token}`;
        const start = performance.now();
        const upstream = await fetch(target, {
          method: 'POST', headers, body: config.body,
          redirect: 'manual', signal: AbortSignal.timeout(10000),
        });
        const rawResponse = await upstream.text();
        sendJson(res, 200, {
          status: upstream.status,
          statusText: upstream.statusText,
          durationMs: Math.round(performance.now() - start),
          responseBody: rawResponse.slice(0, MAX_RESPONSE),
          truncated: rawResponse.length > MAX_RESPONSE,
        });
      } catch (error) {
        sendJson(res, error?.name === 'TimeoutError' ? 504 : (error.status || 400), { error: error.message || 'Request failed.' });
      }
      return;
    }
    sendJson(res, 404, { error: 'Not found.' });
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.DASHBOARD_PORT || 4173);
  createDashboardServer().listen(port, '127.0.0.1', () => {
    console.log(`Bean Webhook Lab → http://localhost:${port}`);
    console.log('Mock endpoint → /mock/webhook (in memory, NOT Bean)');
    console.log('Use Ctrl+C to stop the local dashboard.');
  });
}
