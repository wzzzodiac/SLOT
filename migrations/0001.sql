PRAGMA foreign_keys = ON;
CREATE TABLE invitations (
  hash TEXT PRIMARY KEY,
  label TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  used_request_id TEXT UNIQUE
);
CREATE TABLE requests (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE REFERENCES invitations(hash),
  digest TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE outbox (
  request_id TEXT PRIMARY KEY REFERENCES requests(id),
  state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','preparing','sending','sent','uncertain','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at INTEGER NOT NULL,
  lease TEXT,
  lease_until INTEGER,
  gmail_id TEXT,
  error TEXT
);
CREATE TRIGGER consume_invitation AFTER INSERT ON requests BEGIN
  UPDATE invitations SET used_request_id = NEW.id WHERE hash = NEW.code_hash;
  INSERT INTO outbox(request_id, available_at) VALUES(NEW.id, NEW.created_at);
END;
CREATE INDEX outbox_pending ON outbox(state, available_at);
CREATE TABLE rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE oauth_states (hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
CREATE TABLE daily_mail (day TEXT PRIMARY KEY, count INTEGER NOT NULL);
