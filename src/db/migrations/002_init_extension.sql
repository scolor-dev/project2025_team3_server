-- users の updated_at 自動更新
CREATE TRIGGER IF NOT EXISTS users_touch_updated_at
AFTER UPDATE OF username, email, password_hash,
                email_verified_at, is_disabled, role,
                deleted_at
ON users
FOR EACH ROW
BEGIN
  UPDATE users SET updated_at = unixepoch() WHERE id = OLD.id;
END;

-- 一覧や管理UIのための実用インデックス
CREATE INDEX IF NOT EXISTS idx_users_created_at_desc
  ON users(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_users_is_disabled_created_at
  ON users(is_disabled, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_users_role_created_at
  ON users(role, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_users_last_login_at_desc
  ON users(last_login_at DESC);

-- email_verifications: 未消費・期限内の探索最適化
CREATE INDEX IF NOT EXISTS idx_emailverif_pending
  ON email_verifications(user_id, expires_at)
  WHERE status='pending' AND consumed_at IS NULL;

-- user_sessions: 期限・ユーザー別
CREATE INDEX IF NOT EXISTS idx_sessions_user_expires
  ON user_sessions(user_id, expires_at);

-- password_resets: 未使用・期限内
CREATE INDEX IF NOT EXISTS idx_pwreset_user_expires
  ON password_resets(user_id, expires_at)
  WHERE status='pending' AND used_at IS NULL;
