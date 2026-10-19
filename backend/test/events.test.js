import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDemoEvents, buildInvalidEvent, buildFailedEvent } from '../src/events.js';

test('three distinct successful T-shirt transactions total five units', () => {
  const events = buildDemoEvents({ timestamp: '2026-10-19T00:00:00.000Z' });
  assert.equal(events.length, 3);
  assert.deepEqual(events.map(e => e.quantity), [2, 1, 2]);
  assert.equal(events.reduce((sum, e) => sum + e.quantity, 0), 5);
  assert.equal(new Set(events.map(e => e.transaction_id)).size, 3);
  assert.equal(new Set(events.map(e => e.event_id)).size, 3);
  assert.ok(events.every(e => e.status === 'success'));
});

test('only second transaction includes an employee referral', () => {
  const events = buildDemoEvents();
  assert.equal(events.filter(e => e.referral !== null).length, 1);
  assert.equal(events[1].referral.employee_id, 'employee_demo_001');
});

test('invalid and unsuccessful scenarios do not masquerade as valid transactions', () => {
  assert.equal(buildInvalidEvent({ runId: 'sprint1' }).quantity, -2);
  assert.equal(buildFailedEvent({ runId: 'sprint1' }).status, 'failed');
});
