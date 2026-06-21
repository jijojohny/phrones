-- Phronesis Phase 1 — TimescaleDB schema
-- Run: psql $DATABASE_URL -f infra/timescaledb/schema.sql

CREATE TABLE IF NOT EXISTS market_snapshots (
  id          BIGSERIAL PRIMARY KEY,
  ts          TIMESTAMPTZ NOT NULL,
  version     INTEGER NOT NULL,
  market_count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS market_ticks (
  ts              TIMESTAMPTZ NOT NULL,
  condition_id    TEXT NOT NULL,
  question        TEXT NOT NULL,
  p_market        DOUBLE PRECISION NOT NULL,
  p_sentiment     DOUBLE PRECISION NOT NULL,
  divergence      DOUBLE PRECISION NOT NULL,
  volume_24hr     DOUBLE PRECISION NOT NULL DEFAULT 0,
  bid_ask_spread  DOUBLE PRECISION NOT NULL DEFAULT 0
);

SELECT create_hypertable('market_ticks', 'ts', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_market_ticks_condition ON market_ticks (condition_id, ts DESC);

CREATE TABLE IF NOT EXISTS feed_health (
  ts            TIMESTAMPTZ NOT NULL,
  market_count  INTEGER NOT NULL,
  tick_count    INTEGER NOT NULL,
  missed_ticks  INTEGER NOT NULL,
  reconnects    INTEGER NOT NULL,
  gap_fills     INTEGER NOT NULL,
  avg_lag_ms    DOUBLE PRECISION NOT NULL,
  max_lag_ms    DOUBLE PRECISION NOT NULL
);

SELECT create_hypertable('feed_health', 'ts', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_feed_health_ts ON feed_health (ts DESC);
