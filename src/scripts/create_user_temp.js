// src/scripts/create_user_temp.js
const bcrypt = require('bcrypt');
const db = require('../db'); // script 実行はプロジェクトルート/src/scripts から想定
(async () => {
  try {
    const email = 'test@example.com';
    const pwd = 'password123';
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);
    const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (existing) {
      console.error('user exists:', existing.email);
      process.exit(0);
    }
    const hash = await bcrypt.hash(pwd, saltRounds);
    const uuid = require('uuid').v4();
    const info = db.prepare("INSERT INTO users (uuid,email,password_hash,created_at,updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))").run(uuid, email, hash);
    db.prepare("INSERT INTO profiles (user_id, display_name, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))").run(info.lastInsertRowid, 'Test User');
    console.log('created user id=', info.lastInsertRowid);
    process.exit(0);
  } catch (e) {
    console.error(e && e.stack ? e.stack : e);
    process.exit(1);
  }
})();
