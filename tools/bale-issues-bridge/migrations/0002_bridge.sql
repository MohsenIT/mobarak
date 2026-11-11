CREATE TABLE events (
 id TEXT PRIMARY KEY, source TEXT NOT NULL, kind TEXT NOT NULL, payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
 state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
 available_at INTEGER NOT NULL DEFAULT 0, lease_until INTEGER NOT NULL DEFAULT 0, error_code TEXT,
 created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX events_ready ON events(state,available_at);
CREATE TABLE effects (
 id TEXT PRIMARY KEY, state TEXT NOT NULL, result_json TEXT, updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE issues (
 number INTEGER PRIMARY KEY, github_id INTEGER NOT NULL UNIQUE, title TEXT NOT NULL, body TEXT,
 labels_json TEXT NOT NULL, state TEXT NOT NULL, state_reason TEXT, url TEXT NOT NULL,
 channel_post_id INTEGER UNIQUE, group_root_id INTEGER UNIQUE, canonical_text TEXT,
 reporter_chat_id INTEGER, updated_at TEXT NOT NULL
);
CREATE TABLE post_versions (
 issue_number INTEGER NOT NULL REFERENCES issues(number), body_hash TEXT NOT NULL,
 PRIMARY KEY(issue_number,body_hash)
);
CREATE INDEX post_versions_hash ON post_versions(body_hash);
CREATE TABLE threads (
 root_id INTEGER PRIMARY KEY, issue_number INTEGER NOT NULL REFERENCES issues(number)
);
CREATE TABLE comment_links (
 source TEXT NOT NULL, source_id TEXT NOT NULL, issue_number INTEGER NOT NULL REFERENCES issues(number),
 github_comment_id INTEGER, bale_message_id INTEGER,
 PRIMARY KEY(source,source_id)
);
CREATE TABLE drafts (
 id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, chat_id INTEGER NOT NULL,
 body TEXT NOT NULL, title TEXT NOT NULL, category TEXT NOT NULL, mode TEXT NOT NULL DEFAULT 'report', target_issue INTEGER,
 candidates_json TEXT NOT NULL DEFAULT '[]', state TEXT NOT NULL DEFAULT 'draft', issue_number INTEGER,
 created_at INTEGER NOT NULL DEFAULT (unixepoch()), expires_at INTEGER NOT NULL
);
CREATE INDEX drafts_user ON drafts(user_id,created_at);
CREATE TABLE abuse_reports (
 id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, issue_number INTEGER NOT NULL, reason TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'open', created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE blocked_users (user_id INTEGER PRIMARY KEY, reason TEXT NOT NULL DEFAULT 'moderation');
