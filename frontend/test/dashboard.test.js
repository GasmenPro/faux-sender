import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createDashboardServer } from '../src/dashboard-server.js';
import { buildDemoEvents } from '../src/events.js';

test('dashboard serves UI and proxy sends all events to in-memory receiver', async () => {
  const server = createDashboardServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    const home = await fetch(base);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /Event simulator/);
    for (const event of buildDemoEvents()) {
      const res = await fetch(`${base}/api/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl: `${base}/mock/webhook`, body: JSON.stringify(event) }),
      });
      assert.equal(res.status, 200);
      assert.equal((await res.json()).status, 202);
    }
    const stats = await (await fetch(`${base}/api/mock/state`)).json();
    assert.equal(stats.remaining_stock, 15);
    assert.equal(stats.sales_count, 3);
    assert.equal(stats.referrals_count, 1);
    const [first] = buildDemoEvents();
    const duplicate = await (await fetch(`${base}/api/send`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUrl: `${base}/mock/webhook`, body: JSON.stringify(first) }),
    })).json();
    assert.equal(duplicate.status, 200);
    assert.equal(JSON.parse(duplicate.responseBody).duplicate, true);
    const malformed = await (await fetch(`${base}/api/send`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUrl: `${base}/mock/webhook`, body: '{"transaction_id":' }),
    })).json();
    assert.equal(malformed.status, 400);
    const after = await (await fetch(`${base}/api/mock/state`)).json();
    assert.equal(after.remaining_stock, 15);
    const unsafe = await fetch(`${base}/api/send`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUrl: 'https://example.com/webhooks', body: '{}' }),
    });
    assert.equal(unsafe.status, 400);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
