-- Beta investor access requests (wallet + optional email)
-- Run once: psql "$DATABASE_URL" -f infra/postgres/beta-schema.sql

CREATE TABLE IF NOT EXISTS beta_access_requests (
  id         SERIAL PRIMARY KEY,
  address    TEXT NOT NULL,
  email      TEXT,
  note       TEXT,
  ts         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_beta_access_ts ON beta_access_requests (ts DESC);
CREATE INDEX IF NOT EXISTS idx_beta_access_address ON beta_access_requests (lower(address));
