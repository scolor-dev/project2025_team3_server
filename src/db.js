const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const dotenv = require('dotenv');


dotenv.config();
const DB_FILE = process.env.DATABASE_FILE || './data/app.db';


// ensure directory
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });


const db = new Database(DB_FILE);


// enable foreign keys
db.pragma('foreign_keys = ON');

// apply simple schema if not present
const initSql = `
PRAGMA foreign_keys = ON;



CREATE TABLE IF NOT EXISTS users (
id INTEGER PRIMARY KEY AUTOINCREMENT,
uuid TEXT UNIQUE,
email TEXT UNIQUE,
password_hash TEXT,
is_active INTEGER NOT NULL DEFAULT 1,
created_at TEXT NOT NULL DEFAULT (datetime('now')),
updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS profiles (
id INTEGER PRIMARY KEY AUTOINCREMENT,
user_id INTEGER NOT NULL UNIQUE,
username TEXT UNIQUE,
display_name TEXT,
bio TEXT,
avatar_url TEXT,
locale TEXT,
birthdate TEXT,
created_at TEXT NOT NULL DEFAULT (datetime('now')),
updated_at TEXT NOT NULL DEFAULT (datetime('now')),
FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS tokens (
id TEXT PRIMARY KEY,
user_id INTEGER NOT NULL,
token_hash TEXT NOT NULL,
type TEXT NOT NULL,
issued_at TEXT NOT NULL DEFAULT (datetime('now')),
expires_at TEXT,
revoked INTEGER NOT NULL DEFAULT 0,
last_used_at TEXT,
FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);


CREATE INDEX IF NOT EXISTS idx_tokens_user ON tokens(user_id);


CREATE TABLE IF NOT EXISTS status (
id INTEGER PRIMARY KEY AUTOINCREMENT,
user_id INTEGER NOT NULL,
kind TEXT NOT NULL,
content TEXT,
is_public INTEGER NOT NULL DEFAULT 0,
created_at TEXT NOT NULL DEFAULT (datetime('now')),
updated_at TEXT NOT NULL DEFAULT (datetime('now')),
FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);


CREATE INDEX IF NOT EXISTS idx_status_user ON status(user_id);


CREATE TABLE IF NOT EXISTS diary (
id INTEGER PRIMARY KEY AUTOINCREMENT,
user_id INTEGER NOT NULL,
title TEXT,
body TEXT NOT NULL,
is_public INTEGER NOT NULL DEFAULT 0,
is_draft INTEGER NOT NULL DEFAULT 0,
created_at TEXT NOT NULL DEFAULT (datetime('now')),
updated_at TEXT NOT NULL DEFAULT (datetime('now')),
FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);


CREATE INDEX IF NOT EXISTS idx_diary_user_created ON diary(user_id, created_at);
`;

db.exec(initSql);

module.exports = db;