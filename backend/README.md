# Bean Faux Webhook Sender

A **tiny, development-only** Node.js CLI that pretends an e-commerce store is sending transactions to Bean. No dependencies or UI required.

It sends **three individual JSON POST requests** for T-shirt transactions of **2, 1, and 2 shirts** (five in total). The second transaction has an employee referral.

> **Important:** The event JSON in `src/events.js` is an illustrative example. Update field names, statuses, paths, and authentication to match **Bean's actual webhook contract** before using it against the Bean ingestion endpoint. This tool does not itself update inventory or sales tables.

## Requirements

- Node.js 18 or newer (has built-in `fetch`)

## Try it locally (no Bean server needed)

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
