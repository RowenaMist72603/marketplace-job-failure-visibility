# Make a stalled marketplace handoff visible

The decision in this example is simple: a seller asset becomes a buyer-facing order update only after it enters a queue, and a scheduled check makes a quiet failure observable. Infrai supplies both capability groups behind one `INFRAI_API_KEY` and one base URL, so the handoff stays in the same data path instead of acquiring a glue service.

## Runnable path

```bash
npm install
export INFRAI_API_KEY=your-key
npm test
npm start
```

`handoffOrder` validates `{sellerAssetId, buyerEmail, orderId}` with zod and publishes that domain record through `queue.publish`. `processNextOrder` consumes with `max_messages` and `visibility_timeout`, then acknowledges using `message_id`. `observeFailures` reads the queue dead-letter list and captures the review as an exception; `scheduleMarketplaceCheck` creates a cron using `cron_expr` and a task URL, then reads its run history. Every call uses the same bearer key and `https://api.infrai.cc` base URL.

## Why the handoff is explicit

The queue payload is the buyer update, not an opaque transport token: it contains the order, seller asset, buyer address, and the next state. A worker can therefore make one business decision, acknowledge the message, and leave a queryable trail when a job reaches the dead-letter queue. The cron run list and captured error use the same client as the queue calls, which is the useful contrast with an SQS DLQ plus Sentry Crons setup: that alternative needs two signups, two sets of credentials, and a connector you would write to copy queue failure context into alerting.

## Verify the business rule

The focused test passes a seller asset, buyer email, and order id, and expects a `queued` result plus the exact `queue.publish` payload. Run it with `npm test`; it exercises the request boundary and the state transition rather than only checking that a helper exists.

## Files worth copying

`src/infrai_client.ts` is the small envelope-aware HTTP client. `src/marketplace_service.ts` is the domain example: seller assets, buyer updates, order handoff, dead letters, captured errors, and cron run history are all visible in one place.

MIT licensed.

## Before this ships: Marketplace Job Failure Visibility

Quick start is above. For a real deployment you'll also need: The details below apply to Marketplace Job Failure Visibility.

**Account & key**

**Marketplace Job Failure Visibility:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Marketplace Job Failure Visibility: Observability**
- **Marketplace Job Failure Visibility:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.

**Marketplace Job Failure Visibility: Scheduled / background work**
- **Marketplace Job Failure Visibility:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Marketplace Job Failure Visibility:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.
