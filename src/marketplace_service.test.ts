import assert from "node:assert/strict";
import { handoffOrder, processNextOrder } from "./marketplace_service.js";

const calls: Array<{ path: string; method: string; body: unknown }> = [];
const fakeClient = { request: async (path: string, method: string, body: unknown) => { calls.push({ path, method, body }); return {}; } } as never;
const result = await handoffOrder({ sellerAssetId: "asset-7", buyerEmail: "buyer@example.com", orderId: "order-7" }, fakeClient);
assert.deepEqual(result, { orderId: "order-7", state: "queued" });
assert.equal(calls[0].path, "/v1/queue/publish");
assert.deepEqual(calls[0].body, { queue: process.env.INFRAI_QUEUE ?? "marketplace-orders", payload: { orderId: "order-7", sellerAssetId: "asset-7", buyerEmail: "buyer@example.com", state: "ready-for-buyer" } });
console.log("handoff decision verified");

const workerCalls: Array<{ path: string; method: string; body: unknown }> = [];
const workerClient = { request: async (path: string, method: string, body: unknown) => {
  workerCalls.push({ path, method, body });
  return { items: [{ message_id: "message-7", payload: {} }] };
} } as never;
assert.equal(await processNextOrder(workerClient), "acknowledged");
assert.deepEqual(workerCalls, [
  { path: "/v1/queue/consume", method: "POST", body: { queue: process.env.INFRAI_QUEUE ?? "marketplace-orders", max_messages: 1, visibility_timeout: 60 } },
  { path: "/v1/queue/ack", method: "POST", body: { queue: process.env.INFRAI_QUEUE ?? "marketplace-orders", message_id: "message-7" } }
]);
console.log("queue consume and ack requests verified");
