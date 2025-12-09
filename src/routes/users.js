const express = require('express');
const router = express.Router();
const db = require('../db');


// GET /users/:id (public profile)
router.get('/:id', (req, res) => {
const id = req.params.id;
const user = db.prepare('SELECT id, uuid, email, is_active, created_at FROM users WHERE id = ?').get(id);
if (!user) return res.status(404).json({ error: 'not found' });


const profile = db.prepare('SELECT username, display_name, bio, avatar_url, locale, birthdate FROM profiles WHERE user_id = ?').get(id) || {};


res.json({ user, profile });
});


module.exports = router;