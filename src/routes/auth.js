const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const authMiddleware = require('../middleware/auth');

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);

// POST /auth/login
// body: { email, password }
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email,password required' });

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(401).json({ error: 'invalid credentials' });

    const ok = await bcrypt.compare(password, user.password_hash || '');
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });

    // create token row: id = uuid, secret = uuid
    const tokenId = uuidv4();
    const tokenSecret = uuidv4();
    const tokenHash = await bcrypt.hash(tokenSecret, SALT_ROUNDS);

    db.prepare('INSERT INTO tokens (id, user_id, token_hash, type, issued_at, revoked) VALUES (?, ?, ?, ?, datetime(\'now\'), 0)')
      .run(tokenId, user.id, tokenHash, 'session');

    // return composite token
    const tokenToReturn = `${tokenId}.${tokenSecret}`;
    res.json({ token: tokenToReturn });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal' });
  }
});

// POST /auth/logout (requires auth)
router.post('/logout', authMiddleware, (req, res) => {
  try {
    const tokenId = req.authTokenId;
    db.prepare('UPDATE tokens SET revoked = 1 WHERE id = ?').run(tokenId);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal' });
  }
});

module.exports = router;