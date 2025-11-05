// db/migrate.js
// 役割: SQLファイルの順次適用。未適用のみをトランザクションで実行し、履歴を記録する。

const fs = require('fs');
const path = require('path');

/**
 * マイグレーションファイル名を検証して {version, name, filename} を返す
 * 例: "001_init.sql" -> { version: 1, name: "init", filename: "001_init.sql" }
 */
function parseMigrationFilename(filename) {
  const m = filename.match(/^(\d+)_([A-Za-z0-9._-]+)\.sql$/);
  if (!m) return null;
  return { version: Number(m[1], 10), name: m[2], filename };
}

/**
 * migrations ディレクトリから有効な .sql を検出し、version 昇順で返す
 */
function discoverMigrations(migrationsDir) {
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
  const parsed = files
    .map(parseMigrationFilename)
    .filter(Boolean)
    .sort((a, b) => a.version - b.version);
  return parsed;
}

/**
 * schema_migrations テーブルを作成（初回のみ）
 */
function ensureSchemaMigrationsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     INTEGER PRIMARY KEY,
      name        TEXT NOT NULL,
      filename    TEXT NOT NULL,
      applied_at  INTEGER NOT NULL
    );
  `);
}

/**
 * 適用済みバージョン集合を取得
 */
function getAppliedVersions(db) {
  const rows = db.prepare(`SELECT version FROM schema_migrations`).all();
  return new Set(rows.map(r => r.version));
}

/**
 * 単一マイグレーションを適用（トランザクション）
 */
function applyOne(db, migrationsDir, mig) {
  const full = path.join(migrationsDir, mig.filename);
  const sql = fs.readFileSync(full, 'utf8');

  const tx = db.transaction(() => {
    db.exec(sql);
    db.prepare(`
      INSERT INTO schema_migrations(version, name, filename, applied_at)
      VALUES (?, ?, ?, strftime('%s','now'))
    `).run(mig.version, mig.name, mig.filename);
  });

  tx();
}

/**
 * 公開API: すべての未適用マイグレーションを実行
 * @param {Database} db - better-sqlite3 の DB インスタンス
 * @param {object} opts - { migrationsDir?: string, logger?: (msg)=>void }
 */
function run(db, opts = {}) {
  const migrationsDir = opts.migrationsDir || path.join(__dirname, 'migrations');
  const log = opts.logger || (() => {});
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`migrations dir not found: ${migrationsDir}`);
  }

  ensureSchemaMigrationsTable(db);

  const all = discoverMigrations(migrationsDir);
  const applied = getAppliedVersions(db);
  const pendings = all.filter(m => !applied.has(m.version));

  if (pendings.length === 0) {
    log('[migrate] no pending migrations');
    return { applied: 0 };
  }

  for (const mig of pendings) {
    log(`[migrate] applying ${String(mig.version).padStart(3, '0')}_${mig.name}`);
    applyOne(db, migrationsDir, mig);
  }
  log(`[migrate] done. applied=${pendings.length}`);
  return { applied: pendings.length };
}

module.exports = {
  run,
  // 下記はユニットテストやCLIで使う場合のみ
  _internal: { parseMigrationFilename, discoverMigrations, ensureSchemaMigrationsTable, getAppliedVersions }
};
