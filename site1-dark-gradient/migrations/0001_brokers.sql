CREATE TABLE IF NOT EXISTS brokers (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL CHECK(json_valid(data)),
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS broker_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  broker_id TEXT NOT NULL,
  payload TEXT NOT NULL CHECK(json_valid(payload)),
  previous TEXT,
  actor TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_broker_events_date ON broker_events(created_at);
