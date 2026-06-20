import WebSocket from "ws";
import type { MarketTick } from "@phronesis/shared";
import { PolymarketClobWs, type ClobWsOptions } from "./clob-ws.js";

export interface FailoverWsOptions extends ClobWsOptions {
  primaryUrl?: string;
  secondaryUrl?: string;
  failoverAfterDisconnects?: number;
}

export interface FailoverStats {
  activeFeed: "primary" | "secondary";
  primaryTicks: number;
  secondaryTicks: number;
  failovers: number;
  lastTickTs: number;
}

const DEFAULT_PRIMARY = "wss://ws-subscriptions-clob.polymarket.com/ws/market";
const DEFAULT_SECONDARY = "wss://ws-subscriptions-clob.polymarket.com/ws/market";

/** HA wrapper: fails over to secondary feed after repeated primary disconnects. */
export class PolymarketClobWsFailover {
  private primary: ManagedFeed;
  private secondary: ManagedFeed;
  private active: "primary" | "secondary" = "primary";
  private primaryDisconnects = 0;
  private failovers = 0;
  private readonly threshold: number;
  private closed = false;

  constructor(private readonly options: FailoverWsOptions) {
    this.threshold = options.failoverAfterDisconnects ?? 2;

    const onTick = (tick: MarketTick, source: "primary" | "secondary") => {
      if (source === this.active) options.onTick(tick);
    };

    this.primary = new ManagedFeed(
      options.primaryUrl ?? DEFAULT_PRIMARY,
      options,
      (t) => onTick(t, "primary"),
      () => this.onPrimaryDisconnect(),
    );
    this.secondary = new ManagedFeed(
      options.secondaryUrl ?? DEFAULT_SECONDARY,
      options,
      (t) => onTick(t, "secondary"),
      () => {},
    );
  }

  connect(): void {
    this.closed = false;
    this.primary.connect();
    this.secondary.connect();
    console.log("[clob-failover] primary + secondary feeds connected");
  }

  close(): void {
    this.closed = true;
    this.primary.close();
    this.secondary.close();
  }

  stats(): FailoverStats {
    return {
      activeFeed: this.active,
      primaryTicks: this.primary.ticks,
      secondaryTicks: this.secondary.ticks,
      failovers: this.failovers,
      lastTickTs: Math.max(this.primary.lastTickTs, this.secondary.lastTickTs),
    };
  }

  private onPrimaryDisconnect(): void {
    if (this.closed) return;
    this.primaryDisconnects += 1;
    if (this.primaryDisconnects >= this.threshold && this.active === "primary") {
      this.active = "secondary";
      this.failovers += 1;
      console.warn(`[clob-failover] switched to SECONDARY (failover #${this.failovers})`);
    }
  }
}

class ManagedFeed {
  private ws: WebSocket | null = null;
  private closed = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  ticks = 0;
  lastTickTs = 0;

  constructor(
    private readonly url: string,
    private readonly options: FailoverWsOptions,
    private readonly onTick: (tick: MarketTick) => void,
    private readonly onDisconnect: () => void,
  ) {}

  connect(): void {
    this.closed = false;
    this.ws = new WebSocket(this.url);

    this.ws.on("open", () => {
      this.ws?.send(
        JSON.stringify({
          assets_ids: this.options.assetIds,
          type: "market",
          custom_feature_enabled: true,
        }),
      );
    });

    this.ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as Record<string, unknown>;
        const tick = normalizeTick(msg);
        if (tick) {
          this.ticks += 1;
          this.lastTickTs = tick.ts;
          this.onTick(tick);
        }
      } catch (err) {
        this.options.onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    });

    this.ws.on("error", (err) => {
      this.options.onError?.(err instanceof Error ? err : new Error(String(err)));
    });

    this.ws.on("close", () => {
      this.onDisconnect();
      if (this.closed) return;
      const delay = this.options.reconnectMs ?? 3000;
      this.reconnectTimer = setTimeout(() => this.connect(), delay);
    });
  }

  close(): void {
    this.closed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }
}

function normalizeTick(msg: Record<string, unknown>): MarketTick | null {
  const eventType = String(msg.event_type ?? msg.type ?? "unknown");
  const assetId = String(msg.asset_id ?? "");
  const ts = Number(msg.timestamp ?? Date.now());
  const conditionId = String(msg.market ?? msg.condition_id ?? "");

  if (eventType === "best_bid_ask" || eventType === "last_trade_price") {
    const price = parsePrice(
      (msg.best_bid as string) ?? (msg.price as string) ?? msg.last_trade_price,
    );
    if (price === undefined) return null;
    return { assetId, conditionId, question: "", pImplied: price, eventType, ts };
  }
  return null;
}

function parsePrice(value: string | number | undefined): number | undefined {
  if (value === undefined || value === "") return undefined;
  const n = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : undefined;
}
