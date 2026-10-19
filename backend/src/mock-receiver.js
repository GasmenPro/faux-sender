/** A minimal LOCAL smoke-test receiver. This is NOT Bean or a real database. */
import { createServer } from "node:http";

const port = Number(process.env.MOCK_PORT || 3001);
createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/webhook") {
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "Use POST /webhook" }));
    return;
  }
  let raw = "";
  for await (const chunk of request) raw += chunk;
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    response.writeHead(400, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "Invalid JSON" }));
    return;
  }
  console.log("Received:", event);
  if (
    !event ||
    typeof event !== "object" ||
    !Number.isInteger(event.quantity) ||
    event.quantity <= 0
  ) {
    response.writeHead(400, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "Invalid quantity" }));
    return;
  }
  response.writeHead(202, { "Content-Type": "application/json" });
  response.end(
    JSON.stringify({ received: true, transaction_id: event.transaction_id }),
  );
}).listen(port, "127.0.0.1", () => {
  console.log(`Mock receiver listening at http://localhost:${port}/webhook`);
  console.log("Smoke test only — it does not modify Bean inventory or sales.");
});
