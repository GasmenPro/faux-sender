# Bean Faux Webhook Sender

A **small, development-only webhook test tool** with a browser dashboard and a CLI. It pretends an e-commerce store is sending transactions to Bean. No third-party packages required.

It sends **three individual JSON POST requests** for T-shirt transactions of **2, 1, and 2 shirts** (five in total). The second transaction has an employee referral.

> **Important:** The event JSON in `src/events.js` is an illustrative example. Update field names, statuses, paths, and authentication to match **Bean's actual webhook contract** before using it against the Bean ingestion endpoint. This tool does not itself update inventory or sales tables.

## Requirements

- Node.js 18 or newer (has built-in `fetch`)

## Quick start: Dashboard (recommended)

```bash
npm run dashboard
```

Open **http://localhost:4173**. Click **Send all 3 transactions** to see a working demo against the built-in mock receiver. The mock starts automatically with the dashboard and runs entirely in memory. You do not need to install dependencies or start another terminal.

## Alternative: Command-line sender

**Terminal 1:** run a local dummy receiver:

```bash
npm run mock
```

**Terminal 2:** send the three transactions:

```bash
npm run send -- --url http://localhost:3001/webhook
```

The sender prints each JSON payload and the HTTP status/response. The mock receiver confirms requests arrive; **it does not store sales or change inventory**.

## Send to the real Bean webhook endpoint

When your colleague gives you the Bean development URL and payload contract:

```bash
npm run send -- --url http://localhost:3000/api/webhooks/transactions
```

Replace the example path with the actual Bean endpoint. For an approved remote **development/staging** URL, also add `--allow-remote`. Never send synthetic transactions to production.

If Bean uses a Bearer token, set `WEBHOOK_TOKEN` in your terminal (or pass `--token`). For a different authentication scheme, supply an HTTP header, e.g. `--header 'X-Test-Secret: dev-secret'`. Do **not** commit real secrets or print them in screenshots.

If Bean verifies HMAC signatures, you'll need to adapt the sender to generate a real signature over the **exact request body** using the contract's algorithm and secret. An arbitrary header won't pass signature verification.

## Common scenarios

```bash
# Three successful transactions: 2 + 1 + 2 shirts; second has a referral
npm run send -- --url http://localhost:3001/webhook

# Only transaction #2 (the one with the referral)
npm run send -- --url http://localhost:3001/webhook --scenario one --event 2

# Send the EXACT same transaction twice to test idempotency
npm run send -- --url http://localhost:3001/webhook --scenario duplicate

# Invalid negative quantity
npm run send -- --url http://localhost:3001/webhook --scenario invalid

# Failed transaction (should not change Bean inventory)
npm run send -- --url http://localhost:3001/webhook --scenario failed

# Invalid JSON
npm run send -- --url http://localhost:3001/webhook --scenario malformed

# See outgoing payloads without sending requests
npm run send -- --dry-run

# New distinct transaction IDs for another test run
npm run send -- --url http://localhost:3001/webhook --run-id second-test

# Custom JSON payload from file
npm run send -- --url http://localhost:3001/webhook --scenario custom --file my-event.json
```

All commands also support `--tenant-id` and `--product-id`. Run `npm run send -- --help` for full options. `WEBHOOK_URL` can replace `--url`.

### A note on transaction IDs

By default, IDs use the stable prefix `sprint1`. Running the default demo **again** sends the same transaction IDs, on purpose: Bean should detect duplicates. Use a different `--run-id` to simulate fresh transactions. Event timestamps change, but IDs remain the same for duplicate-handling tests.

### Sprint 1 success conditions to check in Bean

1. Starting from an inventory of, say, 20 shirts, the three valid demo transactions leave **15**.
2. Bean creates **three** sales records, including one with employee referral attribution if the schema supports it.
3. Sending the same transaction again does **not** change inventory or create another sale.
4. Invalid, malformed, or failed transactions produce no unauthorized inventory or sales changes.
5. Bean's actual ingestion code (not this repo) should validate, normalize, authorize, deduplicate, and update inventory/sales atomically.

An `HTTP 200` or `202` response alone **does not guarantee** database updates. Check Bean's logs and database or use its integration tests.

## Tests

```bash
npm test
```

These tests check the **sender's generated sample payloads**. Bean's own repo needs separate ingestion/database tests.

## Create a new GitHub repository

1. On GitHub, create a **new, empty** repository named `bean-webhook-faux-sender` (don't add a GitHub-generated README).
2. From inside this folder, run:

```bash
git init
git add .
git commit -m "Add Bean faux webhook sender"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/bean-webhook-faux-sender.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your GitHub username (or organization). Your GitHub account must be authenticated before pushing.

## Dashboard UI (new)

The repo also includes a **working, dependency-free web dashboard** in `public/`.

```bash
npm run dashboard
```

Open **http://localhost:4173** in your browser. The dashboard automatically points at its built-in mock webhook endpoint, so **you only need one terminal**.

From the dashboard you can:

- Click **Send all 3 transactions** to simulate sales of 2, 1, and 2 T-shirts; the second has an employee referral.
- Click a transaction card to preview or send just that event.
- Try **Duplicate event**, **Invalid quantity**, **Failed payment**, **Malformed JSON**, or an editable **Custom** payload.
- Use **Replay last** to send the exact same body to the same endpoint again.
- Inspect outbound payloads, HTTP response bodies, status codes, and duration in the activity table.
- See a **local in-memory mock inventory** go from 20 to 15 after the successful three-sale scenario; reset it with **Reset**. This mock is for demonstration only — it is **not** Bean's actual database or ingestion logic.

**Connecting to Bean:** update **Webhook endpoint**, **Tenant ID**, and **Product ID** to match Bean's development environment and ensure the payload matches Bean's actual schema. If Bean requires a bearer token, enter it in the **Bearer token** field. If it requires custom headers or HMAC signatures, adapt `src/dashboard-server.js` to Bean's actual contract before sending. An HTTP success response alone does not prove real database changes.

**Safety:** the dashboard binds only to `127.0.0.1`; by default it only sends to localhost targets. For a **trusted staging HTTPS endpoint**, opt in when starting it:

```bash
ALLOW_REMOTE_TARGETS=1 npm run dashboard
```

Never point this development simulator at production. The built-in mock state is ephemeral; restarting the dashboard restores 20 T-shirts. Activity logs are only held in the browser session and disappear on refresh. This tool is not multi-user or production hardened.

### Dashboard files

- `src/dashboard-server.js` — local dashboard HTTP server and JSON POST proxy
- `src/mock-store.js` — deliberately simplified, in-memory sample receiver
- `public/index.html` — dashboard HTML
- `public/styles.css` — responsive dashboard styling
- `public/app.js` — interactive event selection, sending, history, and mock stats

The existing CLI (`npm run send`) and standalone mock (`npm run mock`) continue to work as before.
