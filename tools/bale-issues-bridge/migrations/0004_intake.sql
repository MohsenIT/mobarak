CREATE TABLE intake_users(user_id INTEGER PRIMARY KEY,created_at INTEGER NOT NULL DEFAULT (unixepoch()));
CREATE TABLE conversations (
 id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, chat_id INTEGER NOT NULL,
 state TEXT NOT NULL DEFAULT 'collecting', revision INTEGER NOT NULL DEFAULT 0,
 context TEXT NOT NULL DEFAULT '', report_json TEXT NOT NULL DEFAULT '{}', question TEXT,
 options_json TEXT NOT NULL DEFAULT '[]', questions INTEGER NOT NULL DEFAULT 0, question_limit INTEGER NOT NULL DEFAULT 2,
 ai_calls INTEGER NOT NULL DEFAULT 0, reserved_cost REAL NOT NULL DEFAULT 0,
 draft_id TEXT UNIQUE, issue_number INTEGER, ignore_duplicate INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL DEFAULT (unixepoch()), updated_at INTEGER NOT NULL DEFAULT (unixepoch()), expires_at INTEGER NOT NULL
);
CREATE INDEX conversations_user ON conversations(user_id,updated_at);
CREATE TABLE subscriptions(user_id INTEGER NOT NULL,chat_id INTEGER NOT NULL,issue_number INTEGER NOT NULL,created_at INTEGER NOT NULL DEFAULT (unixepoch()),PRIMARY KEY(user_id,issue_number));
CREATE TABLE intake_attachments(id TEXT PRIMARY KEY,conversation_id TEXT NOT NULL REFERENCES conversations(id),source_key TEXT NOT NULL UNIQUE,mime TEXT NOT NULL,data BLOB NOT NULL,published INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL DEFAULT (unixepoch()));
CREATE INDEX intake_attachments_conversation ON intake_attachments(conversation_id);
CREATE TABLE ai_usage(id TEXT PRIMARY KEY,conversation_id TEXT NOT NULL REFERENCES conversations(id),state TEXT NOT NULL DEFAULT 'reserved',result_json TEXT,input_tokens INTEGER NOT NULL DEFAULT 0,output_tokens INTEGER NOT NULL DEFAULT 0,estimated_cost REAL NOT NULL DEFAULT 0,latency_ms INTEGER NOT NULL DEFAULT 0,model TEXT NOT NULL,created_at INTEGER NOT NULL DEFAULT (unixepoch()));
CREATE TABLE report_feedback(user_id INTEGER NOT NULL,issue_number INTEGER NOT NULL,result TEXT NOT NULL,created_at INTEGER NOT NULL DEFAULT (unixepoch()),PRIMARY KEY(user_id,issue_number));
ALTER TABLE drafts ADD COLUMN report_json TEXT;
ALTER TABLE conversations ADD COLUMN candidates_json TEXT NOT NULL DEFAULT '[]';
CREATE TABLE intake_inputs(event_id TEXT PRIMARY KEY,conversation_id TEXT NOT NULL REFERENCES conversations(id),force_ready INTEGER NOT NULL DEFAULT 0,text TEXT NOT NULL DEFAULT '',kind TEXT NOT NULL DEFAULT 'append');
CREATE TABLE participants(user_id INTEGER NOT NULL,issue_number INTEGER NOT NULL,PRIMARY KEY(user_id,issue_number));
CREATE TABLE conversation_locks(user_id INTEGER PRIMARY KEY,event_id INTEGER NOT NULL,lease_until INTEGER NOT NULL);

CREATE TRIGGER intake_apply_input AFTER INSERT ON intake_inputs BEGIN
 UPDATE conversations SET
 context=CASE WHEN NEW.kind='body' THEN NEW.text WHEN NEW.kind='title' THEN context ELSE CASE WHEN context='' THEN NEW.text ELSE context||char(10)||NEW.text END END,
 report_json=CASE WHEN NEW.kind='title' THEN json_set(report_json,'$.title',NEW.text)
 WHEN NEW.kind='body' THEN json_set(report_json,'$.summary',NEW.text,'$.current_behavior',NEW.text,'$.expected_behavior','','$.reproduction_steps',json('[]')) ELSE report_json END,
 state=CASE WHEN NEW.kind IN ('title','body') THEN 'preview' ELSE 'collecting' END,
 revision=revision+1,updated_at=unixepoch() WHERE id=NEW.conversation_id;
END;
