const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');


// helper: parse YYYY-MM or YYYY-MM-DD (basic validation)
function validYYYYMM(s) {
return /^\d{4}-\d{2}$/.test(s);
}
function validYYYYMMDD(s) {
return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// GET /diary/month/:ym (e.g. 2025-12)
router.get('/month/:ym', auth, (req, res) => {
const ym = req.params.ym;
if (!validYYYYMM(ym)) return res.status(400).json({ error: 'invalid format' });


const rows = db.prepare(`SELECT * FROM diary WHERE user_id = ? AND strftime('%Y-%m', created_at, 'localtime') = ? ORDER BY created_at DESC`).all(req.user.id, ym);
res.json({ items: rows });
});


// GET /diary/day/:ymd (e.g. 2025-12-09)
router.get('/day/:ymd', auth, (req, res) => {
const ymd = req.params.ymd;
if (!validYYYYMMDD(ymd)) return res.status(400).json({ error: 'invalid format' });


const rows = db.prepare(`SELECT * FROM diary WHERE user_id = ? AND date(created_at, 'localtime') = date(?, 'localtime') ORDER BY created_at DESC`).all(req.user.id, ymd);
res.json({ items: rows });
});


// GET /diary/:id (retrieve single diary; must be owner or public)
router.get('/:id', auth, (req, res) => {
const id = req.params.id;
const row = db.prepare('SELECT * FROM diary WHERE id = ?').get(id);
if (!row) return res.status(404).json({ error: 'not found' });


// owner or public
if (row.user_id !== req.user.id && row.is_public !== 1) return res.status(403).json({ error: 'forbidden' });


res.json(row);
});

// POST /diary (create) body: { title?, body, is_public?, is_draft? }
router.post('/', auth, (req, res) => {
const { title, body, is_public = 0, is_draft = 0 } = req.body;
if (!body) return res.status(400).json({ error: 'body required' });


const info = db.prepare('INSERT INTO diary (user_id, title, body, is_public, is_draft, created_at, updated_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\'), datetime(\'now\'))').run(req.user.id, title || null, body, is_public ? 1 : 0, is_draft ? 1 : 0);
const created = db.prepare('SELECT * FROM diary WHERE id = ?').get(info.lastInsertRowid);
res.status(201).json(created);
});


// PUT /diary/:id (update) owner only
router.put('/:id', auth, (req, res) => {
const id = req.params.id;
const row = db.prepare('SELECT * FROM diary WHERE id = ?').get(id);
if (!row) return res.status(404).json({ error: 'not found' });
if (row.user_id !== req.user.id) return res.status(403).json({ error: 'forbidden' });


const { title, body, is_public, is_draft } = req.body;
db.prepare('UPDATE diary SET title = coalesce(?, title), body = coalesce(?, body), is_public = coalesce(?, is_public), is_draft = coalesce(?, is_draft), updated_at = datetime(\'now\') WHERE id = ?')
.run(title, body, typeof is_public === 'undefined' ? undefined : (is_public ? 1 : 0), typeof is_draft === 'undefined' ? undefined : (is_draft ? 1 : 0), id);


const updated = db.prepare('SELECT * FROM diary WHERE id = ?').get(id);
res.json(updated);
});


// DELETE /diary/:id (delete) owner only
router.delete('/:id', auth, (req, res) => {
const id = req.params.id;
const row = db.prepare('SELECT * FROM diary WHERE id = ?').get(id);
if (!row) return res.status(404).json({ error: 'not found' });
if (row.user_id !== req.user.id) return res.status(403).json({ error: 'forbidden' });


db.prepare('DELETE FROM diary WHERE id = ?').run(id);
res.json({ ok: true });
});


module.exports = router;