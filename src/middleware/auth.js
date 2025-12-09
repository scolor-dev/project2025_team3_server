const db = require('../db');
const bcrypt = require('bcrypt');


function parseBearer(tokenString) {
if (!tokenString) return null;
const m = tokenString.match(/^Bearer\s+(.+)$/i);
if (!m) return null;
return m[1];
}


// token format: <tokenId>.<value>
async function authenticate(req, res, next) {
try {
const raw = req.headers.authorization ? req.headers.authorization : null;
const bearer = parseBearer(raw);
if (!bearer) return res.status(401).json({ error: 'missing token' });


const parts = bearer.split('.');
if (parts.length < 2) return res.status(401).json({ error: 'invalid token format' });


const tokenId = parts[0];
const tokenValue = parts.slice(1).join('.');


const row = db.prepare('SELECT * FROM tokens WHERE id = ? AND revoked = 0').get(tokenId);
if (!row) return res.status(401).json({ error: 'invalid token' });


const ok = await bcrypt.compare(tokenValue, row.token_hash);
if (!ok) return res.status(401).json({ error: 'invalid token' });


// optionally update last_used_at
db.prepare('UPDATE tokens SET last_used_at = datetime(\'now\') WHERE id = ?').run(tokenId);


// attach user
const user = db.prepare('SELECT id, uuid, email, is_active, created_at FROM users WHERE id = ?').get(row.user_id);
if (!user) return res.status(401).json({ error: 'user not found' });


req.user = user;
req.authTokenId = tokenId;
next();
} catch (err) {
console.error(err);
res.status(500).json({ error: 'internal' });
}
}


module.exports = authenticate;