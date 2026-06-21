import WebSocket from "ws";
import { env } from "@phronesis/shared";
import type { FillEvent } from "@phronesis/shared";

const USER_WS = "wss://ws-subscriptions-clob.polymarket.com/ws/user";

export interface UserWsFillOptions {
  apiKey?: string;
  apiSecret?: string;
  passphrase?: string;
  timeoutMs?: number;
}

export interface UserWsSession {
  waitForFills(orderIds: string[], timeoutMs?: number): Promise<FillEvent[]>;
  close(): void;
}

/** Polymarket user-channel WS — tracks order fills by orderId. */
export async function createUserWsSession(
  opts: UserWsFillOptions = {},
): Promise<UserWsSession | null> {
  const apiKey = opts.apiKey ?? env.polymarketApiKey;
  const secret = opts.apiSecret ?? env.polymarketApiSecret;
  const passphrase = opts.passphrase ?? env.polymarketApiPassphrase;

  if (!apiKey || !secret || !passphrase) {
    return null;
  }

  const ws = new WebSocket(USER_WS);
  const pending = new Map<string, FillEvent>();

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("user WS connect timeout")), 10_000);

    ws.on("open", () => {
      clearTimeout(timer);
      ws.send(
        JSON.stringify({
          auth: { apiKey, secret, passphrase },
          type: "user",
        }),
      );
      resolve();
    });

    ws.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString()) as Record<string, unknown>;
      const fill = parseUserFillMessage(msg);
      if (fill) pending.set(fill.orderId, fill);
    } catch {
      // ignore malformed
    }
  });

  return {
    async waitForFills(orderIds: string[], timeoutMs = 30_000): Promise<FillEvent[]> {
      const deadline = Date.now() + timeoutMs;
      const found: FillEvent[] = [];

      while (Date.now() < deadline && found.length < orderIds.length) {
        for (const id of orderIds) {
          if (found.some((f) => f.orderId === id)) continue;
          const hit = pending.get(id);
          if (hit) found.push(hit);
        }
        if (found.length >= orderIds.length) break;
        await sleep(500);
      }

      return found;
    },
    close() {
      ws.close();
    },
  };
}

function parseUserFillMessage(msg: Record<string, unknown>): FillEvent | null {
  const eventType = String(msg.event_type ?? msg.type ?? "");
  if (!eventType.includes("order") && !eventType.includes("trade")) return null;

  const orderId = String(msg.order_id ?? msg.orderID ?? msg.id ?? "");
  if (!orderId) return null;

  const price = Number(msg.price ?? msg.avg_price ?? 0);
  const size = Number(msg.size ?? msg.size_matched ?? msg.filled_size ?? 0);
  const side = String(msg.side ?? "BUY").toUpperCase() === "SELL" ? "SELL" : "BUY";
  const statusRaw = String(msg.status ?? msg.state ?? "matched").toLowerCase();

  let status: FillEvent["status"] = "matched";
  if (statusRaw.includes("cancel")) status = "cancelled";
  else if (statusRaw.includes("partial") || size <= 0) status = "partial";

  return {
    orderId,
    tokenId: String(msg.asset_id ?? msg.token_id ?? ""),
    conditionId: String(msg.market ?? msg.condition_id ?? ""),
    side,
    price,
    sizeShares: size,
    ts: Number(msg.timestamp ?? Date.now()),
    status,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
