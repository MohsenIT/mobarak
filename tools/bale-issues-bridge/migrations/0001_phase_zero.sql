CREATE TABLE IF NOT EXISTS probe_events (
  update_id INTEGER PRIMARY KEY,
  received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  routing_json TEXT NOT NULL CHECK(json_valid(routing_json))
);
CREATE INDEX IF NOT EXISTS probe_events_received ON probe_events(received_at);
