#!/usr/bin/env bash
# Start Redis + TimescaleDB for Phase 1 local dev
set -euo pipefail

echo "Starting Phase 1 infra (Redis + TimescaleDB)..."
docker run -d --name phronesis-redis -p 6379:6379 redis:7-alpine 2>/dev/null || docker start phronesis-redis
docker run -d --name phronesis-timescale \
  -e POSTGRES_PASSWORD=phronesis \
  -p 5432:5432 \
  timescale/timescaledb:latest-pg16 2>/dev/null || docker start phronesis-timescale

sleep 3
echo ""
echo "Add to .env:"
echo "  REDIS_URL=redis://localhost:6379"
echo "  DATABASE_URL=postgres://postgres:phronesis@localhost:5432/postgres"
echo ""
echo "Initialize schema:"
echo "  psql \"\$DATABASE_URL\" -f infra/timescaledb/schema.sql"
echo ""
echo "Import Grafana dashboard: infra/grafana/dashboards/phronesis-feed-health.json"
