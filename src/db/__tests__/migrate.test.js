// db/__tests__/migrate.test.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');
const migrate = require('../migrate');
const conn = require('../connection');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'app-'));
}

test('初回適用→冪等', () => {
  const work = tmpDir();
  const migDir = path.join(work, 'migrations');
  fs.mkdirSync(migDir);

  // 001, 002 を作成（最小DDL）
  fs.writeFileSync(path.join(migDir, '001_init.sql'),
    `CREATE TABLE t1(id INTEGER PRIMARY KEY);`);
  fs.writeFileSync(path.join(migDir, '002_init_extension.sql'),
    `CREATE TABLE t2(id INTEGER PRIMARY KEY);`);

  const dbPath = path.join(work, 'app.sqlite3');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  const r1 = migrate.run(db, { migrationsDir: migDir, logger: () => {} });
  expect(r1.applied).toBe(2);

  // スキーマ存在確認
  const t1 = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='t1'`).get();
  const t2 = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='t2'`).get();
  expect(t1 && t2).toBeTruthy();

  // 冪等（もう一度は 0）
  const r2 = migrate.run(db, { migrationsDir: migDir, logger: () => {} });
  expect(r2.applied).toBe(0);
});

test('部分適用→追加入り', () => {
  const work = tmpDir();
  const migDir = path.join(work, 'migrations');
  fs.mkdirSync(migDir);
  fs.writeFileSync(path.join(migDir, '001_init.sql'),
    `CREATE TABLE a(id INTEGER PRIMARY KEY);`);

  const db = new Database(path.join(work, 'app.sqlite3'));
  migrate.run(db, { migrationsDir: migDir });

  // 後から 002 を投入
  fs.writeFileSync(path.join(migDir, '002_more.sql'),
    `CREATE TABLE b(id INTEGER PRIMARY KEY);`);

  const r = migrate.run(db, { migrationsDir: migDir });
  expect(r.applied).toBe(1);

  const b = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='b'`).get();
  expect(b).toBeTruthy();
});

test('失敗時はロールバックされ記録されない', () => {
  const work = tmpDir();
  const migDir = path.join(work, 'migrations');
  fs.mkdirSync(migDir);
  fs.writeFileSync(path.join(migDir, '001_ok.sql'),
    `CREATE TABLE ok(id INTEGER PRIMARY KEY);`);
  fs.writeFileSync(path.join(migDir, '002_bad.sql'),
    `CREATE TABLE ok(id INTEGER PRIMARY KEY); -- 同名でエラー`);

  const db = new Database(path.join(work, 'app.sqlite3'));

  // 001 は通るが 002 で失敗
  try { migrate.run(db, { migrationsDir: migDir }); } catch (e) {}

  // 001 は作成されているが、002 は schema_migrations に入っていない
  const count = db.prepare(`SELECT COUNT(*) c FROM schema_migrations`).get().c;
  expect(count).toBe(1);
});

test('connection.init 経由でPRAGMAとmigrateが走る', () => {
  const work = tmpDir();
  const migDir = path.join(work, 'migrations');
  fs.mkdirSync(migDir);
  fs.writeFileSync(path.join(migDir, '001_init.sql'),
    `CREATE TABLE x(id INTEGER PRIMARY KEY);`);

  const dbPath = path.join(work, 'app.sqlite3');
  process.env.DB_PATH = dbPath; // connection.js の解決に使う
  const logger = () => {};
  conn.init({ migrationsDir: migDir, logger, skipSignalHandlers: true });

  const d = conn.db();
  const jm = d.pragma('journal_mode', { simple: true });
  const fk = d.pragma('foreign_keys', { simple: true });

  expect(/wal/i.test(jm)).toBe(true);
  expect(fk === 1).toBe(true);

  const x = d.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='x'`).get();
  expect(x).toBeTruthy();
});
