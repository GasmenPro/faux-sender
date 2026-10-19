#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { buildDemoEvents, buildInvalidEvent, buildFailedEvent } from './events.js';

function usage() {
  console.log(`
Bean faux webhook sender (Node.js 18+)

Usage:
  npm run send -- --url http://localhost:3001/webhook

Options:
  --url URL                 Target webhook endpoint (or WEBHOOK_URL env var)
  --scenario NAME          demo (default), one, duplicate, invalid, failed, malformed, custom
  --event NUMBER           1, 2, or 3 (only for --scenario one)
  --run-id TEXT            IDs for this test run (default: sprint1)
  --tenant-id TEXT         Tenant identifier (default: tenant_demo_001)
  --product-id TEXT        Product identifier (default: tshirt_demo_001)
  --file PATH              JSON payload file (required for custom scenario)
  --token TEXT             Bearer token (or WEBHOOK_TOKEN env var)
  --header 'Name: value'    Extra HTTP header; repeat as needed
  --allow-remote           Permit non-localhost URLs (disabled by default)
  --dry-run                Show payloads without sending anything
  --help                   Show this help

Examples:
  npm run send -- --url http://localhost:3001/webhook
  npm run send -- --url http://localhost:3001/webhook --scenario one --event 2
  npm run send -- --url http://localhost:3001/webhook --scenario duplicate
  npm run send -- --url http://localhost:3001/webhook --scenario invalid
  npm run send -- --url http://localhost:3001/webhook --run-id new-test-1
`);
}

function parseArguments(argv) {
  const args = {
    url: process.env.WEBHOOK_URL,
    token: process.env.WEBHOOK_TOKEN,
    scenario: 'demo',
    event: 1,
    runId: 'sprint1',
    tenantId: 'tenant_demo_001',
    productId: 'tshirt_demo_001',
    headers: [],
    allowRemote: false,
    dryRun: false,
    help: false,
  };
  const mapping = {
    '--url': 'url', '--scenario': 'scenario', '--event': 'event',
    '--run-id': 'runId', '--tenant-id': 'tenantId', '--product-id': 'productId',
    '--file': 'file', '--token': 'token',
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--help' || flag === '-h') { args.help = true; continue; }
    if (flag === '--allow-remote') { args.allowRemote = true; continue; }
    if (flag === '--dry-run') { args.dryRun = true; continue; }
    if (flag === '--header') {
      if (!argv[i + 1]) throw new Error('--header requires "Name: value"');
      args.headers.push(argv[++i]);
      continue;
    }
    if (!(flag in mapping)) throw new Error(`Unknown option: ${flag}`);
    if (!argv[i + 1] || argv[i + 1].startsWith('--')) {
      throw new Error(`${flag} requires a value`);
    }
    args[mapping[flag]] = argv[++i];
  }
  return args;
}

function parseHeader(header) {
  const colon = header.indexOf(':');
  if (colon < 1) throw new Error(`Invalid header: ${header}. Expected "Name: value"`);
  return [header.slice(0, colon).trim(), header.slice(colon + 1).trim()];
}

function validateEndpoint(endpoint, allowRemote) {
  let url;
  try { url = new URL(endpoint); }
  catch { throw new Error('Pass a valid target URL using --url or WEBHOOK_URL.'); }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only HTTP and HTTPS webhook URLs are supported.');
  }
  const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
  if (!localHosts.has(url.hostname) && !allowRemote) {
    throw new Error('Remote target blocked for safety. Use --allow-remote only for an approved development/staging endpoint.');
  }
  return url.toString();
}

function makeRequests(args) {
  const options = { tenantId: args.tenantId, productId: args.productId, runId: args.runId };
  const events = buildDemoEvents(options);
  switch (args.scenario) {
    case 'demo': return events.map((body) => ({ body }));
    case 'one': {
      const index = Number(args.event) - 1;
      if (!Number.isInteger(index) || index < 0 || index > 2) throw new Error('--event must be 1, 2, or 3.');
      return [{ body: events[index] }];
    }
    case 'duplicate': return [{ body: events[0] }, { body: events[0] }];
    case 'invalid': return [{ body: buildInvalidEvent(options) }];
    case 'failed': return [{ body: buildFailedEvent(options) }];
    case 'malformed': return [{ rawBody: '{"transaction_id":' }];
    case 'custom': return [];
    default: throw new Error(`Unknown scenario: ${args.scenario}`);
  }
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  if (args.help) { usage(); return; }
  if (!args.url && !args.dryRun) { usage(); throw new Error('Missing --url or WEBHOOK_URL.'); }
  const endpoint = args.url ? validateEndpoint(args.url, args.allowRemote) : '(dry run)';
  const headers = { 'Content-Type': 'application/json' };
  if (args.token) headers.Authorization = `Bearer ${args.token}`;
  for (const item of args.headers) {
    const [name, value] = parseHeader(item);
    headers[name] = value;
  }

  let requests = makeRequests(args);
  if (args.scenario === 'custom') {
    if (!args.file) throw new Error('The custom scenario requires --file PATH.');
    requests = [{ body: JSON.parse(await readFile(args.file, 'utf8')) }];
  }

  console.log(`\nScenario: ${args.scenario} | Target: ${endpoint} | Requests: ${requests.length}`);
  for (let index = 0; index < requests.length; index++) {
    const { body, rawBody } = requests[index];
    const payload = rawBody ?? JSON.stringify(body);
    console.log(`\n--- Request ${index + 1}/${requests.length} ---`);
    console.log(`POST ${endpoint}`);
    console.log(payload);
    if (args.dryRun) { console.log('DRY RUN: Nothing sent.'); continue; }
    const startedAt = performance.now();
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers, body: payload, signal: AbortSignal.timeout(10000),
      });
      const responseText = await response.text();
      console.log(`HTTP ${response.status} ${response.statusText} (${Math.round(performance.now() - startedAt)}ms)`);
      console.log(`Response: ${responseText || '(empty response)'}`);
      if (!response.ok && args.scenario === 'demo') process.exitCode = 1;
    } catch (error) {
      console.error(`Request error: ${error.message}`);
      process.exitCode = 1;
    }
  }
  console.log('\nNote: An HTTP success response alone does not prove database records changed.');
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
