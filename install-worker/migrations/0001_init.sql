CREATE TABLE IF NOT EXISTS installs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  source TEXT NOT NULL,
  agent_id TEXT,
  version TEXT,
  cluster TEXT,
  ip_hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS installs_source_idx ON installs (source);
CREATE INDEX IF NOT EXISTS installs_ts_idx ON installs (ts);
CREATE INDEX IF NOT EXISTS installs_ip_ts_idx ON installs (ip_hash, ts);
