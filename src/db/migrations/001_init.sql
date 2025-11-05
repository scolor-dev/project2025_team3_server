PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  username        TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  email           TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash   TEXT    NOT NULL,
  email_verified_at INTEGER,
  is_disabled     INTEGER NOT NULL DEFAULT 0 CHECK (is_disabled IN (0,1)),
  role            TEXT    NOT NULL DEFAULT 'user' CHECK (role IN ('user','mod','admin')),
  last_login_at   INTEGER,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  deleted_at      INTEGER,
  CHECK (length(username) BETWEEN 3 AND 32),
  CHECK (instr(username, ' ') = 0)
);

CREATE TABLE IF NOT EXISTS email_verifications (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL,
  email        TEXT    NOT NULL,
  token_hash   TEXT    NOT NULL UNIQUE,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at   INTEGER NOT NULL,
  consumed_at  INTEGER,
  status       TEXT    NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','consumed','expired','revoked')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL,
  refresh_hash  TEXT    NOT NULL UNIQUE,
  device_label  TEXT,
  user_agent    TEXT,
  ip            TEXT,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at    INTEGER NOT NULL,
  revoked_at    INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS password_resets (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL,
  token_hash   TEXT    NOT NULL UNIQUE,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at   INTEGER NOT NULL,
  used_at      INTEGER,
  status       TEXT    NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','used','expired','revoked')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);