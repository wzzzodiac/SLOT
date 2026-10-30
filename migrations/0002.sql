ALTER TABLE outbox ADD COLUMN sending_at INTEGER;
CREATE INDEX request_created ON requests(created_at);
CREATE TRIGGER guard_request BEFORE INSERT ON requests BEGIN
  SELECT RAISE(ABORT, 'invitation unavailable') WHERE NOT EXISTS (
    SELECT 1 FROM invitations WHERE hash=NEW.code_hash
      AND used_request_id IS NULL AND revoked_at IS NULL AND expires_at>NEW.created_at
  );
END;
