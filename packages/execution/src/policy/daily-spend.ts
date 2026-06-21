import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { env } from "@phronesis/shared";
import type { FillEvent } from "@phronesis/shared";

const LEDGER_DIR = resolve(env.repoRoot, "wallets/session");

export interface DailySpendLedger {
  date: string;
  spentUsdc: number;
  orderIds: string[];
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function ledgerPath(): string {
  return resolve(LEDGER_DIR, "daily-spend.json");
}

export function loadDailySpend(): DailySpendLedger {
  mkdirSync(LEDGER_DIR, { recursive: true });
  const key = todayKey();

  try {
    const raw = JSON.parse(readFileSync(ledgerPath(), "utf8")) as DailySpendLedger;
    if (raw.date === key) return raw;
  } catch {
    // fresh day
  }

  return { date: key, spentUsdc: 0, orderIds: [] };
}

export function recordSpend(amountUsdc: number, orderIds: string[]): DailySpendLedger {
  const ledger = loadDailySpend();
  ledger.spentUsdc += amountUsdc;
  ledger.orderIds.push(...orderIds.filter((id) => !ledger.orderIds.includes(id)));
  writeFileSync(ledgerPath(), JSON.stringify(ledger, null, 2));
  return ledger;
}

export function remainingDailyBudget(dailyLimitUsdc: number): number {
  return Math.max(0, dailyLimitUsdc - loadDailySpend().spentUsdc);
}

export function resetDailySpendIfNeeded(): void {
  loadDailySpend();
}
