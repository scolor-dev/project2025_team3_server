// File: src/index.js
// Entrypoint for Express + SQLite API
// (debug-enabled version — prints startup logs and global error handlers)

console.log('[debug] index.js START');

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err && err.stack ? err.stack : err);
  // don't exit immediately in dev, but log and exit to surface the problem
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  console.error('[unhandledRejection]', err && err.stack ? err.stack : err);
  process.exit(1);
});

const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// load env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const diaryRoutes = require('./routes/diary');
const db = require('./db'); // ensures DB initialization runs

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// basic request logger for debugging
app.use((req, res, next) => {
  console.log(`[req] ${req.method} ${req.url}`);
  next();
});

// routes
app.use('/auth', authRoutes);
app.use('/users', usersRoutes);
app.use('/diary', diaryRoutes);

// health
app.get('/', (req, res) => res.json({ ok: true }));

console.log('[debug] about to call app.listen on port', PORT);

app.listen(PORT, () => {
  console.log('[debug] listening on', PORT);
});
