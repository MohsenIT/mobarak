ALTER TABLE drafts ADD COLUMN reply_group_message_id INTEGER;

CREATE TABLE comment_notices (
 chat_id INTEGER NOT NULL,
 message_id INTEGER NOT NULL,
 issue_number INTEGER NOT NULL REFERENCES issues(number),
 group_message_id INTEGER NOT NULL,
 PRIMARY KEY(chat_id, message_id)
);
