import WebSocket from "ws";
import type { MarketTick } from "@phronesis/shared";

const WS_URL = "wss://ws-subscriptions-clob.polymarket.com/ws/market";

export type TickHandler = (tick: MarketTick) => void;

export interface ClobWsOptions {
  assetIds: string[];
  onTick: TickHandler;
  onError?: (err: Error) => void;
  reconnectMs?: number;
}

function parsePrice(value: string | number | undefined): number | undefined {
  if (value === undefined || value === "") return undefined;
  const n = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : undefined;
}

function mid(bid?: number, ask?: number): number | undefined {
  if (bid === undefined || ask === undefined) return undefined;
  return (bid + ask) / 2;
}

export class PolymarketClobWs {
  private ws: WebSocket | null = null;
  private closed = false;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(private readonly options: ClobWsOptions) {}

  connect(): void {
    this.closed = false;
    this.ws = new WebSocket(WS_URL);

    this.ws.on("open", () => {
      const payload = {
        assets_ids: this.options.assetIds,
        type: "market",
        custom_feature_enabled: true,
      };
      this.ws?.send(JSON.stringify(payload));
      console.log(`[clob-ws] subscribed to ${this.options.assetIds.length} assets`);
    });

    this.ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as Record<string, unknown>;
        const tick = this.normalize(msg);
        if (tick) this.options.onTick(tick);
      } catch (err) {
        this.options.onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    });

    this.ws.on("error", (err) => {
      this.options.onError?.(err instanceof Error ? err : new Error(String(err)));
    });

    this.ws.on("close", () => {
      if (this.closed) return;
      const delay = this.options.reconnectMs ?? 3000;
      console.warn(`[clob-ws] disconnected; reconnecting in ${delay}ms`);
      this.reconnectTimer = setTimeout(() => this.connect(), delay);
    });
  }

  close(): void {
    this.closed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  private normalize(msg: Record<string, unknown>): MarketTick | null {
    const eventType = String(msg.event_type ?? msg.type ?? "unknown");
    const assetId = String(msg.asset_id ?? "");
    const ts = Number(msg.timestamp ?? Date.now());
    const conditionId = String(msg.market ?? msg.condition_id ?? "");

    if (eventType === "book") {
      const bids = (msg.bids as Array<{ price: string; size: string }>) ?? [];
      const asks = (msg.asks as Array<{ price: string; size: string }>) ?? [];
      const bid = parsePrice(bids[0]?.price);
      const ask = parsePrice(asks[0]?.price);
      const m = mid(bid, ask);
      return {
        assetId,
        conditionId,
        question: "",
        bid,
        ask,
        mid: m,
        pImplied: m,
        eventType,
        ts,
      };
    }

    if (eventType === "best_bid_ask") {
      const bid = parsePrice(msg.best_bid as string);
      const ask = parsePrice(msg.best_ask as string);
      const m = mid(bid, ask);
      return {
        assetId,
        conditionId,
        question: "",
        bid,
        ask,
        mid: m,
        pImplied: m,
        eventType,
        ts,
      };
    }

    if (eventType === "last_trade_price") {
      const lastTrade = parsePrice(msg.price as string);
      return {
        assetId,
        conditionId,
        question: "",
        lastTrade,
        pImplied: lastTrade,
        eventType,
        ts,
      };
    }

    if (eventType === "price_change") {
      const changes = (msg.price_changes as Array<{ asset_id: string; price: string }>) ?? [];
      const first = changes[0];
      if (!first) return null;
      const price = parsePrice(first.price);
      return {
        assetId: first.asset_id,
        conditionId,
        question: "",
        mid: price,
        pImplied: price,
        eventType,
        ts,
      };
    }

    return null;
  }
}
