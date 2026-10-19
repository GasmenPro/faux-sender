/**
 * Sample payloads for Sprint 1. IMPORTANT: Adjust this shape to match
 * Bean's actual webhook contract before testing the real endpoint.
 *
 * runId is intentionally stable by default: running the same events again
 * lets you test idempotency. Change --run-id for a new set of transactions.
 */
export function buildDemoEvents({
  tenantId = "tenant_demo_001",
  productId = "tshirt_demo_001",
  runId = "sprint1",
  timestamp = new Date().toISOString(),
} = {}) {
  const safeRunId = String(runId).replace(/[^a-zA-Z0-9_-]/g, "_");
  const quantities = [2, 1, 2];

  return quantities.map((quantity, index) => {
    const number = String(index + 1).padStart(3, "0");
    return {
      event_id: `evt_${safeRunId}_${number}`,
      event_type: "transaction.completed",
      transaction_id: `txn_${safeRunId}_${number}`,
      tenant_id: tenantId,
      product_id: productId,
      quantity,
      status: "success",
      timestamp,
      referral:
        index === 1
          ? {
              employee_id: "employee_demo_001",
              source: "employee_referral_link",
            }
          : null,
    };
  });
}

export function buildInvalidEvent(options) {
  const [first] = buildDemoEvents({
    ...options,
    runId: `${options.runId}_invalid`,
  });
  return { ...first, quantity: -2 };
}

export function buildFailedEvent(options) {
  const [first] = buildDemoEvents({
    ...options,
    runId: `${options.runId}_failed`,
  });
  return { ...first, status: "failed" };
}
