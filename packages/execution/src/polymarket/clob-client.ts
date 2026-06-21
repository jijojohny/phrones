import { env } from "@phronesis/shared";
import type { PolymarketOrder } from "@phronesis/shared";

export interface ClobPostResult {
  orderId: string;
  status: string;
  raw?: unknown;
}

export interface ClobClientLike {
  postLimitOrder(order: PolymarketOrder): Promise<ClobPostResult>;
  getOrder(orderId: string): Promise<{ status: string; sizeMatched?: number } | null>;
}

/** Build authenticated ClobClient when session key + API creds are configured. */
export async function createPolymarketClient(): Promise<ClobClientLike | null> {
  const key = env.sessionKeyPrivateKey;
  const apiKey = env.polymarketApiKey;
  const secret = env.polymarketApiSecret;
  const passphrase = env.polymarketApiPassphrase;

  if (!key || !apiKey || !secret || !passphrase) {
    return null;
  }

  try {
    const { ClobClient, Side, OrderType } = await import("@polymarket/clob-client-v2");
    const { createWalletClient, http } = await import("viem");
    const { privateKeyToAccount } = await import("viem/accounts");
    const { polygon } = await import("viem/chains");

    const account = privateKeyToAccount(key as `0x${string}`);
    const signer = createWalletClient({
      account,
      chain: polygon,
      transport: http(env.polygonRpcUrl),
    });

    const creds = { key: apiKey, secret, passphrase };
    const funder = env.safeAddressPolygon || account.address;

    const client = new ClobClient({
      host: env.polymarketClobHost,
      chain: polygon.id,
      signer,
      creds,
      signatureType: env.safeAddressPolygon ? 2 : 0,
      funderAddress: funder,
    });

    return {
      async postLimitOrder(order: PolymarketOrder): Promise<ClobPostResult> {
        const side = order.side === "BUY" ? Side.BUY : Side.SELL;
        const resp = await client.createAndPostOrder(
          {
            tokenID: order.tokenId,
            price: order.price,
            size: order.sizeShares,
            side,
          },
          { tickSize: "0.01", negRisk: false },
          OrderType.GTC,
        );

        return {
          orderId: resp.orderID ?? resp.id ?? `clob-${Date.now()}`,
          status: resp.status ?? "submitted",
          raw: resp,
        };
      },

      async getOrder(orderId: string) {
        try {
          const o = await client.getOrder(orderId);
          if (!o) return null;
          const row = o as unknown as Record<string, unknown>;
          return {
            status: String(row.status ?? row.state ?? "unknown"),
            sizeMatched: Number(row.size_matched ?? row.sizeMatched ?? 0),
          };
        } catch {
          return null;
        }
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to init Polymarket CLOB client: ${msg}`);
  }
}
