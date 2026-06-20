/** Fractional Kelly for binary YES at `price`. Returns fraction of NAV [0, 1]. */
export function fractionalKelly(p: number, price: number, theta: number): number {
  if (price <= 0 || price >= 1 || p <= 0 || p >= 1) return 0;

  const b = (1 - price) / price;
  const q = 1 - p;
  const edge = b * p - q;
  if (edge <= 0) return 0;

  return theta * edge / b;
}

/** Kelly for buying NO (equivalent to selling YES at price). */
export function fractionalKellyNo(pYes: number, price: number, theta: number): number {
  const pNo = 1 - pYes;
  const noPrice = 1 - price;
  return fractionalKelly(pNo, noPrice, theta);
}

export function applyKellyConstraints(
  fraction: number,
  nav: number,
  maxPositionPct: number,
  minBetUsd: number,
): number {
  const capped = Math.min(Math.max(fraction, 0), maxPositionPct);
  const wager = capped * nav;
  return wager >= minBetUsd ? capped : 0;
}

export function kellyWagerUsd(
  p: number,
  price: number,
  theta: number,
  nav: number,
  maxPositionPct: number,
  minBetUsd: number,
): { fraction: number; wagerUsd: number; edge: number } {
  const b = price > 0 && price < 1 ? (1 - price) / price : 0;
  const edge = b > 0 ? b * p - (1 - p) : 0;
  const raw = fractionalKelly(p, price, theta);
  const fraction = applyKellyConstraints(raw, nav, maxPositionPct, minBetUsd);
  return { fraction, wagerUsd: fraction * nav, edge };
}
