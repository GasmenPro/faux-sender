/**
 * In-memory testing receiver — intentionally NOT Bean's database or business logic.
 * Reset on server restart. Useful for watching example events move through a mock.
 */
export function createMockStore(initialStock = 20) {
  const sales = new Map();
  let stock = initialStock;

  function snapshot() {
    const records = [...sales.values()];
    return {
      initial_stock: initialStock,
      remaining_stock: stock,
      units_sold: initialStock - stock,
      sales_count: records.length,
      referrals_count: records.filter((record) => record.referral).length,
      sales: records,
      note: 'In-memory mock only. This does not read or update Bean data.',
    };
  }

  function reset() {
    sales.clear();
    stock = initialStock;
    return snapshot();
  }

  function ingest(event) {
    if (!event || Array.isArray(event) || typeof event !== 'object') {
      return { status: 400, body: { error: 'Event must be a JSON object.' } };
    }
    const mandatory = ['event_id', 'event_type', 'transaction_id', 'tenant_id', 'product_id', 'timestamp'];
    for (const field of mandatory) {
      if (typeof event[field] !== 'string' || !event[field].trim()) {
        return { status: 422, body: { error: `Missing or invalid ${field}` } };
      }
    }
    if (event.event_type !== 'transaction.completed') {
      return { status: 422, body: { error: 'Unsupported event_type' } };
    }
    if (!Number.isInteger(event.quantity) || event.quantity <= 0) {
      return { status: 422, body: { error: 'Quantity must be a positive integer.' } };
    }
    if (Number.isNaN(Date.parse(event.timestamp))) {
      return { status: 422, body: { error: 'Invalid timestamp' } };
    }
    if (event.tenant_id !== 'tenant_demo_001' || event.product_id !== 'tshirt_demo_001') {
      return { status: 404, body: { error: 'Unknown mock tenant or product. The mock only has tenant_demo_001 / tshirt_demo_001.' } };
    }
    if (event.referral !== null && event.referral !== undefined && (
      typeof event.referral !== 'object' || Array.isArray(event.referral) ||
      typeof event.referral.employee_id !== 'string' || !event.referral.employee_id.trim()
    )) {
      return { status: 422, body: { error: 'Referral must be null or an object with employee_id.' } };
    }
    if (event.status !== 'success') {
      return { status: 422, body: { error: 'Transaction is not successful; nothing changed.' } };
    }

    const existing = sales.get(event.transaction_id);
    if (existing) {
      const same = existing.quantity === event.quantity && existing.tenant_id === event.tenant_id &&
        existing.product_id === event.product_id &&
        JSON.stringify(existing.referral) === JSON.stringify(event.referral ?? null);
      return same
        ? { status: 200, body: { accepted: true, duplicate: true, transaction_id: event.transaction_id, remaining_stock: stock } }
        : { status: 409, body: { error: 'Conflicting transaction_id: transaction was already processed with different data.' } };
    }

    if (event.quantity > stock) {
      return { status: 409, body: { error: 'Not enough stock in mock inventory.' } };
    }
    const sale = {
      transaction_id: event.transaction_id,
      tenant_id: event.tenant_id,
      product_id: event.product_id,
      quantity: event.quantity,
      timestamp: event.timestamp,
      referral: event.referral ?? null,
    };
    stock -= event.quantity;
    sales.set(event.transaction_id, sale);
    return { status: 202, body: { accepted: true, duplicate: false, transaction_id: event.transaction_id, remaining_stock: stock } };
  }

  return { snapshot, reset, ingest };
}
