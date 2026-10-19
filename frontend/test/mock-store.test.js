import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDemoEvents, buildInvalidEvent, buildFailedEvent } from '../src/events.js';
import { createMockStore } from '../src/mock-store.js';

test('mock store handles 3 T-shirt sales, preserves referral, and deducts 5', () => {
  const store = createMockStore();
  for (const event of buildDemoEvents()) assert.equal(store.ingest(event).status, 202);
  const snapshot = store.snapshot();
  assert.equal(snapshot.remaining_stock, 15);
  assert.equal(snapshot.sales_count, 3);
  assert.equal(snapshot.units_sold, 5);
  assert.equal(snapshot.referrals_count, 1);
});

test('repeated delivery is idempotent, even when event timestamp changes', () => {
  const store = createMockStore();
  const [event] = buildDemoEvents();
  assert.equal(store.ingest(event).status, 202);
  assert.deepEqual(store.ingest({ ...event, timestamp: new Date(Date.now() + 1000).toISOString() }).body.duplicate, true);
  assert.equal(store.snapshot().sales_count, 1);
  assert.equal(store.snapshot().remaining_stock, 18);
});

test('mock rejects invalid, failed, unknown product and conflicting transaction events', () => {
  const store = createMockStore();
  assert.equal(store.ingest(buildInvalidEvent({ runId: 'sprint1' })).status, 422);
  assert.equal(store.ingest(buildFailedEvent({ runId: 'sprint1' })).status, 422);
  const [event] = buildDemoEvents();
  assert.equal(store.ingest({ ...event, product_id: 'wrong' }).status, 404);
  assert.equal(store.ingest(event).status, 202);
  assert.equal(store.ingest({ ...event, quantity: 999 }).status, 409);
  assert.equal(store.snapshot().sales_count, 1);
  assert.equal(store.snapshot().remaining_stock, 18);
  store.reset();
  assert.equal(store.snapshot().remaining_stock, 20);
  assert.equal(store.snapshot().sales_count, 0);
});
