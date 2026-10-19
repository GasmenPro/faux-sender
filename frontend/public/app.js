import { buildDemoEvents, buildInvalidEvent, buildFailedEvent } from '/assets/events.js';

const byId = (id) => document.getElementById(id);
const state = { scenario: 'three', selectedEvent: 0, logs: [], lastRequest: null, totals: { sent: 0, accepted: 0, rejected: 0, errors: 0 }, busy: false };
const descriptions = {
  three: 'Sends 3 separate successful purchases for a total of 5 shirts. Transaction 2 includes an employee referral.',
  one: 'Sends just the selected transaction. Pick any card to inspect or test it individually.',
  duplicate: 'Sends the exact same transaction twice. The receiver should only process it once.',
  invalid: 'Sends a negative quantity. The receiver should reject it without changing stock.',
  failed: 'Sends a failed transaction. It should not decrease inventory or create a sale.',
  malformed: 'Sends broken JSON to test your endpoint’s error handling.',
  custom: 'Edit the request body below to test any payload, including invalid JSON.',
};
const labels = { three: '3 successful sales', one: 'One transaction', duplicate: 'Duplicate event', invalid: 'Invalid quantity', failed: 'Failed payment', malformed: 'Malformed JSON', custom: 'Custom payload' };

function demoOptions() {
  return { tenantId: byId('tenantId').value.trim(), productId: byId('productId').value.trim(), runId: byId('runId').value.trim() || 'sprint1' };
}
function getEventSet() { return buildDemoEvents(demoOptions()); }
function pretty(value) { return JSON.stringify(value, null, 2); }
function formatBody(body) {
  try { return pretty(JSON.parse(body)); } catch { return body; }
}
function bytes(text) { return new TextEncoder().encode(text).length; }

function createPreview() {
  const options = demoOptions();
  const events = getEventSet();
  switch (state.scenario) {
    case 'three': return { body: pretty(events[0]), count: 3, caption: 'Preview of transaction 1 of 3 · Each event is sent separately' };
    case 'one': return { body: pretty(events[state.selectedEvent]), count: 1, caption: `Preview of transaction ${state.selectedEvent + 1} · 1 request` };
    case 'duplicate': return { body: pretty(events[0]), count: 2, caption: 'Transaction 1 is sent twice with the same ID' };
    case 'invalid': return { body: pretty(buildInvalidEvent(options)), count: 1, caption: 'Invalid quantity (−2) · 1 request' };
    case 'failed': return { body: pretty(buildFailedEvent(options)), count: 1, caption: 'Failed transaction status · 1 request' };
    case 'malformed': return { body: '{"transaction_id":', count: 1, caption: 'Intentionally invalid JSON · 1 request' };
    default: return { body: byId('payloadEditor').value, count: 1, caption: 'Editable custom JSON · 1 request' };
  }
}
function updateEditorStatus() {
  const body = byId('payloadEditor').value;
  let valid = true;
  try { JSON.parse(body); } catch { valid = false; }
  byId('payloadValidity').textContent = valid ? '● Valid JSON' : '● Invalid JSON';
  byId('payloadValidity').style.color = valid ? '#4a9f73' : '#ca7951';
  byId('payloadSize').textContent = `${bytes(body).toLocaleString()} B`;
}
function renderPreview() {
  const preview = createPreview();
  byId('scenarioDescription').textContent = descriptions[state.scenario];
  if (state.scenario !== 'custom') byId('payloadEditor').value = preview.body;
  byId('previewCaption').textContent = preview.caption;
  const buttonText = {
    three: 'Send all 3 transactions', one: 'Send selected transaction', duplicate: 'Send the duplicate twice',
    invalid: 'Send invalid transaction', failed: 'Send failed transaction', malformed: 'Send malformed JSON', custom: 'Send custom payload',
  };
  byId('sendScenarioLabel').textContent = buttonText[state.scenario];
  document.querySelectorAll('.scenario-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.scenario === state.scenario));
  document.querySelectorAll('.event-card').forEach((card) => card.classList.toggle('selected', state.scenario === 'one' && Number(card.dataset.event) === state.selectedEvent));
  updateEditorStatus();
}
function chooseScenario(next) {
  state.scenario = next;
  renderPreview();
}
function updateTotals() {
  byId('requestsCount').textContent = state.totals.sent;
  byId('acceptedCount').textContent = state.totals.accepted;
  byId('rejectedCount').textContent = state.totals.rejected;
  byId('errorsCount').textContent = state.totals.errors;
}
function truncate(text, count = 55) { return text.length > count ? text.slice(0, count - 1) + '…' : text; }
function detailText(record) {
  const status = record.error ? `Error: ${record.error}` : `HTTP ${record.status} ${record.statusText || ''}`;
  return `${status} · ${record.durationMs ?? '—'} ms\n${record.url}`;
}
function showDetails(record) {
  byId('dialogTitle').textContent = record.name;
  byId('dialogSummary').textContent = detailText(record);
  byId('dialogRequest').textContent = formatBody(record.body);
  byId('dialogResponse').textContent = record.error || formatBody(record.responseBody || '(empty response)');
  byId('requestDialog').showModal();
}
function renderActivity() {
  byId('activitySummary').textContent = state.logs.length ? `${state.logs.length} requests recorded in this browser session` : 'No requests sent yet';
  const tbody = byId('activityBody');
  tbody.replaceChildren();
  if (!state.logs.length) {
    const tr = document.createElement('tr'); const td = document.createElement('td'); td.colSpan = 5;
    const wrapper = document.createElement('div'); wrapper.className = 'empty-state';
    const icon = document.createElement('span'); icon.className = 'empty-illustration'; icon.textContent = '↗';
    const name = document.createElement('strong'); name.textContent = 'No events yet';
    const desc = document.createElement('span'); desc.textContent = 'Hit “Send all 3 transactions” to start testing.';
    wrapper.append(icon, name, desc); td.append(wrapper); tr.append(td); tbody.append(tr); return;
  }
  for (const record of state.logs.slice(0, 40)) {
    const tr = document.createElement('tr');
    const time = document.createElement('td'); time.textContent = record.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const event = document.createElement('td'); event.textContent = truncate(record.name); event.title = record.name;
    const result = document.createElement('td'); const pill = document.createElement('span');
    pill.className = `result-badge ${record.kind}`;
    pill.textContent = record.kind === 'accepted' ? `● ${record.status} Accepted` : record.kind === 'rejected' ? `● ${record.status} Rejected` : '● Error';
    result.append(pill);
    const duration = document.createElement('td'); duration.textContent = record.durationMs == null ? '—' : `${record.durationMs} ms`;
    const action = document.createElement('td'); action.className = 'align-right';
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'inspect-button'; btn.textContent = 'Inspect ↗';
    btn.addEventListener('click', () => showDetails(record)); action.append(btn);
    tr.append(time, event, result, duration, action); tbody.append(tr);
  }
}
async function refreshMock() {
  try {
    const response = await fetch('/api/mock/state');
    if (!response.ok) return;
    const mock = await response.json();
    byId('stockValue').textContent = mock.remaining_stock;
    byId('mockSales').textContent = mock.sales_count;
    byId('mockUnits').textContent = mock.units_sold;
    byId('mockReferrals').textContent = mock.referrals_count;
    const ratio = mock.initial_stock ? 100 * mock.remaining_stock / mock.initial_stock : 0;
    byId('stockBar').style.width = `${Math.max(0, ratio)}%`;
  } catch { /* mock summary is optional */ }
}
let toastTimeout;
function toast(message) {
  const box = byId('toast'); box.textContent = message; box.hidden = false;
  window.clearTimeout(toastTimeout); toastTimeout = window.setTimeout(() => { box.hidden = true; }, 3500);
}
function findTransactionId(raw) {
  try { const event = JSON.parse(raw); return typeof event.transaction_id === 'string' ? event.transaction_id : null; }
  catch { return null; }
}
function busyMode(active) {
  state.busy = active;
  byId('sendScenario').disabled = active;
  byId('sendPreview').disabled = active;
  byId('replayLast').disabled = active || !state.lastRequest;
  byId('sendScenarioLabel').textContent = active ? 'Sending requests…' : ({
    three:'Send all 3 transactions', one:'Send selected transaction', duplicate:'Send the duplicate twice',
    invalid:'Send invalid transaction', failed:'Send failed transaction', malformed:'Send malformed JSON', custom:'Send custom payload',
  })[state.scenario];
}
async function sendOne(body, name, last = false) {
  const url = last ? state.lastRequest.targetUrl : byId('targetUrl').value.trim();
  const token = last ? state.lastRequest.token : byId('token').value;
  if (!url) { toast('Please enter a webhook endpoint.'); return; }
  const request = { targetUrl: url, body, token };
  // The replay preserves the original outgoing payload, endpoint, and token.
  if (!last) state.lastRequest = request;
  const now = new Date();
  const start = performance.now();
  let record;
  try {
    const response = await fetch('/api/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
    const reply = await response.json();
    if (!response.ok) throw new Error(reply.error || `Dashboard error HTTP ${response.status}`);
    const kind = reply.status >= 200 && reply.status < 300 ? 'accepted' : 'rejected';
    record = { time: now, name: findTransactionId(body) || name, kind, ...reply, body, url };
  } catch (error) {
    record = { time: now, name: findTransactionId(body) || name, kind: 'error', error: error.message, durationMs: Math.round(performance.now() - start), body, url, responseBody: '' };
  }
  state.totals.sent += 1;
  if (record.kind === 'accepted') state.totals.accepted += 1;
  if (record.kind === 'rejected') state.totals.rejected += 1;
  if (record.kind === 'error') state.totals.errors += 1;
  state.logs.unshift(record);
  updateTotals(); renderActivity(); await refreshMock();
  return record;
}
function getScenarioRequests() {
  const previewText = byId('payloadEditor').value;
  const events = getEventSet();
  switch (state.scenario) {
    case 'three': return events.map((body, i) => ({ body: JSON.stringify(body), name: `Transaction ${i + 1}` }));
    case 'duplicate': return [0, 1].map((i) => ({ body: JSON.stringify(events[0]), name: `Duplicate attempt ${i + 1}` }));
    default: return [{ body: previewText, name: labels[state.scenario] }];
  }
}
async function sendScenario() {
  if (state.busy) return;
  const requests = getScenarioRequests();
  busyMode(true);
  let accepted = 0;
  try {
    for (const item of requests) {
      const outcome = await sendOne(item.body, item.name);
      if (outcome?.kind === 'accepted') accepted++;
    }
    toast(`${requests.length} request${requests.length !== 1 ? 's' : ''} finished · ${accepted} HTTP 2xx response${accepted === 1 ? '' : 's'}.`);
  } finally { busyMode(false); }
}
async function sendPreview() {
  if (state.busy) return;
  busyMode(true);
  try { const result = await sendOne(byId('payloadEditor').value, 'Preview request'); toast(result?.kind === 'accepted' ? `HTTP ${result.status} — request accepted` : 'Check activity for request details.'); }
  finally { busyMode(false); }
}
async function replayLast() {
  if (state.busy || !state.lastRequest) return;
  busyMode(true);
  try { await sendOne(state.lastRequest.body, 'Replay last request', true); toast('Repeated the previous request. Check activity for duplicate handling.'); }
  finally { busyMode(false); }
}

byId('targetUrl').value = `${window.location.origin}/mock/webhook`;
for (const tab of document.querySelectorAll('.scenario-tab')) tab.addEventListener('click', () => chooseScenario(tab.dataset.scenario));
for (const card of document.querySelectorAll('.event-card')) card.addEventListener('click', () => { state.selectedEvent = Number(card.dataset.event); chooseScenario('one'); });
for (const id of ['tenantId','productId','runId']) byId(id).addEventListener('input', () => { if (state.scenario !== 'custom') renderPreview(); });
byId('freshRun').addEventListener('click', () => { byId('runId').value = `run_${Date.now().toString(36)}`; if (state.scenario !== 'custom') renderPreview(); toast('New transaction IDs generated.'); });
byId('payloadEditor').addEventListener('input', () => { if (state.scenario !== 'custom') chooseScenario('custom'); updateEditorStatus(); });
byId('copyPayload').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(byId('payloadEditor').value); toast('Payload copied.'); }
  catch { byId('payloadEditor').focus(); byId('payloadEditor').select(); toast('Select and copy the highlighted payload.'); }
});
byId('sendScenario').addEventListener('click', sendScenario);
byId('sendPreview').addEventListener('click', sendPreview);
byId('replayLast').addEventListener('click', replayLast);
byId('resetMock').addEventListener('click', async () => {
  try { const response = await fetch('/api/mock/reset', { method: 'POST' }); if (!response.ok) throw new Error('Reset failed'); await refreshMock(); toast('Demo inventory restored to 20 shirts.'); }
  catch { toast('Could not reset the local mock.'); }
});
byId('clearActivity').addEventListener('click', () => { state.logs = []; renderActivity(); toast('Activity list cleared. Session counters remain.'); });
byId('closeDialog').addEventListener('click', () => byId('requestDialog').close());
byId('requestDialog').addEventListener('click', (event) => { if (event.target === byId('requestDialog')) byId('requestDialog').close(); });

renderPreview(); updateTotals(); renderActivity(); refreshMock();
fetch('/api/health').then((response) => response.json()).then((data) => {
  byId('connectionMessage').textContent = data.ok
    ? `Dashboard ready · ${data.remote_targets_enabled ? 'Approved HTTPS staging targets enabled' : 'Only localhost webhook targets enabled by default'}`
    : 'Dashboard service unavailable';
}).catch(() => { byId('connectionMessage').textContent = 'Could not reach the local dashboard service.'; });
