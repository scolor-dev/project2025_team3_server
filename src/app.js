import express from "express";
import Database from "better-sqlite3";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());

const db = new Database("sns.db");
db.pragma("journal_mode = WAL");

// --- schema ---
db.exec(`
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS posts(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS comments(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS likes(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(post_id, user_id),
  FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
`);

// --- helpers ---
const JWT_SECRET = process.env.JWT_SECRET || "dev";
function signToken(user) {
  return jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
}
function auth(req, res, next) {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ error: "no token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "invalid token" });
  }
}

// --- auth ---
app.post("/auth/register", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "username and password required" });
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) return res.status(400).json({ error: "invalid username" });
  const hash = await bcrypt.hash(password, 10);
  try {
    const info = db.prepare("INSERT INTO users(username, password_hash) VALUES (?,?)").run(username, hash);
    const user = { id: info.lastInsertRowid, username };
    res.status(201).json({ user, token: signToken(user) });
  } catch (e) {
    if (String(e).includes("UNIQUE")) return res.status(409).json({ error: "username taken" });
    res.status(500).json({ error: "db error" });
  }
});

app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body || {};
  const row = db.prepare("SELECT * FROM users WHERE username=?").get(username);
  if (!row) return res.status(401).json({ error: "invalid credentials" });
  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) return res.status(401).json({ error: "invalid credentials" });
  const user = { id: row.id, username: row.username };
  res.json({ user, token: signToken(user) });
});

// --- users ---
app.get("/users/:id", (req, res) => {
  const user = db.prepare("SELECT id, username, created_at FROM users WHERE id=?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "not found" });
  const counts = db.prepare(`
    SELECT 
      (SELECT COUNT(*) FROM posts WHERE user_id=?) AS posts,
      (SELECT COUNT(*) FROM comments WHERE user_id=?) AS comments
  `).get(user.id, user.id);
  res.json({ ...user, stats: counts });
});

// --- posts CRUD ---
app.get("/posts", (req, res) => {
  const { limit = 20, offset = 0, userId } = req.query;
  const rows = db.prepare(`
    SELECT p.*, u.username,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
    FROM posts p
    JOIN users u ON u.id = p.user_id
    ${userId ? "WHERE p.user_id = @userId" : ""}
    ORDER BY p.id DESC
    LIMIT @limit OFFSET @offset
  `).all({ limit: Number(limit), offset: Number(offset), userId });
  res.json(rows);
});

app.post("/posts", auth, (req, res) => {
  const { content } = req.body || {};
  if (!content || content.length > 1000) return res.status(400).json({ error: "content required(<=1000)" });
  const info = db.prepare("INSERT INTO posts(user_id, content) VALUES (?,?)").run(req.user.sub, content);
  const post = db.prepare("SELECT * FROM posts WHERE id=?").get(info.lastInsertRowid);
  res.status(201).json(post);
});

app.get("/posts/:id", (req, res) => {
  const post = db.prepare(`
    SELECT p.*, u.username,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count
    FROM posts p JOIN users u ON u.id=p.user_id WHERE p.id=?`).get(req.params.id);
  if (!post) return res.status(404).json({ error: "not found" });
  const comments = db.prepare(`
    SELECT c.*, u.username FROM comments c JOIN users u ON u.id=c.user_id
    WHERE c.post_id=? ORDER BY c.id ASC
  `).all(req.params.id);
  res.json({ ...post, comments });
});

app.put("/posts/:id", auth, (req, res) => {
  const post = db.prepare("SELECT * FROM posts WHERE id=?").get(req.params.id);
  if (!post) return res.status(404).json({ error: "not found" });
  if (post.user_id !== req.user.sub) return res.status(403).json({ error: "forbidden" });
  const { content } = req.body || {};
  if (!content) return res.status(400).json({ error: "content required" });
  db.prepare("UPDATE posts SET content=? WHERE id=?").run(content, post.id);
  res.json(db.prepare("SELECT * FROM posts WHERE id=?").get(post.id));
});

app.delete("/posts/:id", auth, (req, res) => {
  const post = db.prepare("SELECT * FROM posts WHERE id=?").get(req.params.id);
  if (!post) return res.status(404).json({ error: "not found" });
  if (post.user_id !== req.user.sub) return res.status(403).json({ error: "forbidden" });
  db.prepare("DELETE FROM posts WHERE id=?").run(post.id);
  res.status(204).end();
});

// --- comments ---
app.post("/posts/:id/comments", auth, (req, res) => {
  const { content } = req.body || {};
  if (!content) return res.status(400).json({ error: "content required" });
  const post = db.prepare("SELECT id FROM posts WHERE id=?").get(req.params.id);
  if (!post) return res.status(404).json({ error: "post not found" });
  const info = db.prepare("INSERT INTO comments(post_id, user_id, content) VALUES (?,?,?)")
    .run(post.id, req.user.sub, content);
  const row = db.prepare("SELECT * FROM comments WHERE id=?").get(info.lastInsertRowid);
  res.status(201).json(row);
});

app.delete("/comments/:id", auth, (req, res) => {
  const c = db.prepare("SELECT * FROM comments WHERE id=?").get(req.params.id);
  if (!c) return res.status(404).json({ error: "not found" });
  if (c.user_id !== req.user.sub) return res.status(403).json({ error: "forbidden" });
  db.prepare("DELETE FROM comments WHERE id=?").run(c.id);
  res.status(204).end();
});

// --- likes ---
app.post("/posts/:id/like", auth, (req, res) => {
  const post = db.prepare("SELECT id FROM posts WHERE id=?").get(req.params.id);
  if (!post) return res.status(404).json({ error: "post not found" });
  try {
    db.prepare("INSERT INTO likes(post_id, user_id) VALUES (?,?)").run(post.id, req.user.sub);
  } catch {}
  const likeCount = db.prepare("SELECT COUNT(*) as n FROM likes WHERE post_id=?").get(post.id).n;
  res.json({ post_id: post.id, like_count: likeCount });
});

app.delete("/posts/:id/like", auth, (req, res) => {
  db.prepare("DELETE FROM likes WHERE post_id=? AND user_id=?").run(req.params.id, req.user.sub);
  const likeCount = db.prepare("SELECT COUNT(*) as n FROM likes WHERE post_id=?").get(req.params.id).n;
  res.json({ post_id: Number(req.params.id), like_count: likeCount });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`http://localhost:${port}`));
