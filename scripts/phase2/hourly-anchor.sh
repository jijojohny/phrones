#!/usr/bin/env bash
# Hourly audit anchor loop for Phase 2 exit criteria
set -euo pipefail

INTERVAL="${PHASE2_ANCHOR_INTERVAL_SEC:-3600}"

echo "Phase 2 hourly audit anchor (interval=${INTERVAL}s)"
while true; do
  echo "[$(date -Is)] running cognitive + anchor..."
  pnpm --filter @phronesis/tee-core start -- --fixture --anchor || echo "anchor cycle failed"
  sleep "$INTERVAL"
done
