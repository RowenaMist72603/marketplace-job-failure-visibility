import { z } from "zod";
import { InfraiClient } from "./infrai_client.js";

export const handoffRequest = z.object({
  sellerAssetId: z.string().min(1),
  buyerEmail: z.string().email(),
  orderId: z.string().min(1)
});
export type HandoffRequest = z.infer<typeof handoffRequest>;

// The copied idiom is queue.publish: one client, one bearer key, one envelope.

const queue = process.env.INFRAI_QUEUE ?? "marketplace-orders";

type QueueMessage = { message_id: string; payload: unknown };
type QueueData = { items?: QueueMessage[] };

export async function handoffOrder(input: unknown, client = new InfraiClient()): Promise<{ orderId: string; state: string }> {
  const request = handoffRequest.parse(input);
  const payload = { orderId: request.orderId, sellerAssetId: request.sellerAssetId, buyerEmail: request.buyerEmail, state: "ready-for-buyer" };
  await client.request("/v1/queue/publish", "POST", { queue, payload });
  return { orderId: request.orderId, state: "queued" };
}

export async function processNextOrder(client = new InfraiClient()): Promise<string> {
  const data = await client.request<QueueData>("/v1/queue/consume", "POST", { queue, max_messages: 1, visibility_timeout: 60 });
  const message = data.items?.[0];
  if (!message) return "empty";
  await client.request("/v1/queue/ack", "POST", { queue, message_id: message.message_id });
  return "acknowledged";
}

export async function observeFailures(queue: string, client = new InfraiClient()): Promise<unknown> {
  const deadLetters = await client.request(`/v1/queue/dlq/list/${encodeURIComponent(queue)}`, "GET");
  await client.request("/v1/errors/capture", "POST", { exception: { name: "MarketplaceJobCheck", message: "dead-letter review", queue, deadLetters } });
  return deadLetters;
}

export async function scheduleMarketplaceCheck(task: string, client = new InfraiClient()): Promise<unknown> {
  const job = await client.request<{ job_id: string }>("/v1/cron/create", "POST", { cron_expr: "*/10 * * * *", task });
  return client.request(`/v1/cron/runs/list/${job.job_id}`, "GET");
}

if (process.argv[1]?.endsWith("marketplace_service.ts")) {
  const parsed = handoffRequest.parse({ sellerAssetId: "asset-demo", buyerEmail: process.env.MARKETPLACE_BUYER_EMAIL ?? "buyer@example.com", orderId: "order-demo" });
  handoffOrder(parsed).then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error); process.exitCode = 1; });
}
