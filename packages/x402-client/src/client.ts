export interface X402PaymentRequired {
  status: 402;
  paymentRequired?: string;
  body?: unknown;
}

export interface X402FetchResult<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  paymentRequired?: X402PaymentRequired;
}

/**
 * Minimal x402-aware fetch POC.
 * Detects HTTP 402 and surfaces PAYMENT-REQUIRED headers for agent settlement.
 */
export async function fetchWithX402<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<X402FetchResult<T>> {
  const res = await fetch(url, init);
  const paymentRequired = res.headers.get("PAYMENT-REQUIRED") ?? undefined;

  if (res.status === 402) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }

    return {
      ok: false,
      status: 402,
      paymentRequired: {
        status: 402,
        paymentRequired,
        body,
      },
    };
  }

  if (!res.ok) {
    return { ok: false, status: res.status, data: await res.text().catch(() => undefined) as T };
  }

  const contentType = res.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json")
    ? ((await res.json()) as T)
    : ((await res.text()) as T);

  return { ok: true, status: res.status, data };
}

/** Demo call — detects 402 vs normal responses on any HTTP endpoint. */
export async function demoX402Call(): Promise<void> {
  const result = await fetchWithX402("https://httpbin.org/status/200");
  if (result.ok) {
    console.log("[x402] demo fetch OK (no payment required on this endpoint)");
    return;
  }

  if (result.status === 402 && result.paymentRequired) {
    console.log("[x402] payment required:", result.paymentRequired.paymentRequired);
    console.log("[x402] settle via facilitator, then retry with PAYMENT-SIGNATURE header");
    return;
  }

  console.warn(`[x402] demo endpoint unavailable (HTTP ${result.status}) — POC client still ready`);
}
