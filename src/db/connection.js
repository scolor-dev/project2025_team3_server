// db/connection.js
// 役割: DB接続の単一生成と共有、PRAGMA適用、マイグレーション起動、ヘルスチェック、TXラッパ。

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const migrate = require('./migrate');

let _db = null;
let _initialized = false;

/**
 * DBファイルの実パスを解決し、親ディレクトリを作成
 */
function resolveDbPath() {
  const defaultPath = path.join(process.cwd(), 'data', 'app.sqlite3');
  const p = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : defaultPath;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  return p;
}

/**
 * PRAGMAの既定値を適用（WAL/外部キー/timeout/同期モード）
 */
function applyPragmas(db) {
  const busyMs = Number(process.env.DB_BUSY_TIMEOUT_MS || 8000);
  const syncMode = process.env.DB_SYNCHRONOUS || 'NORMAL';
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma(`busy_timeout = ${busyMs}`);
  db.pragma(`synchronous = ${syncMode}`);
}

/**
 * 初期化。一度だけ接続を開き、PRAGMA適用、マイグレーション実行。
 */
function init(opts = {}) {
  if (_initialized) return _db;
  const dbPath = resolveDbPath();

  // 読み取り専用は必要時のみ。通常は書き込み可能で開く。
  const readonly = process.env.DB_READONLY === '1';
  _db = new Database(dbPath, { fileMustExist: false, readonly });

  applyPragmas(_db);

  // マイグレーション（読み取り専用時はスキップ）
  if (!readonly) {
    migrate.run(_db, { migrationsDir: opts.migrationsDir, logger: opts.logger });
  }

  // シグナルでクリーン終了
  const shutdown = () => {
    try { if (_db) _db.close(); } catch (_) {}
    process.exit(0);
  };
  if (!opts.skipSignalHandlers) {
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  }

  _initialized = true;
  return _db;
}

/**
 * 共有DBインスタンスを返す。未初期化なら init() を呼ぶ。
 */
function db() {
  if (!_initialized) init();
  return _db;
}

/**
 * ヘルスチェック。SELECT 1 を実行し、成功なら true。
 */
function health() {
  if (!_initialized) init();
  try {
    _db.prepare('SELECT 1').get();
    return true;
  } catch {
    return false;
  }
}

/**
 * トランザクションラッパ。fn の中で DB操作を行い、成功でCOMMIT、例外でROLLBACK。
 */
function withTx(fn) {
  if (!_initialized) init();
  const tx = _db.transaction((innerFn) => innerFn(_db));
  return tx(fn);
}

/**
 * チェックポイント（WALファイルを整理）
 */
function checkpoint(mode = 'FULL') {
  if (!_initialized) init();
  _db.pragma(`wal_checkpoint(${mode})`);
}

/**
 * VACUUM を実行（サイズ回収）
 */
function vacuum() {
  if (!_initialized) init();
  _db.exec('VACUUM');
}

/**
 * 明示的クローズ
 */
function close() {
  if (_db) {
    _db.close();
    _db = null;
    _initialized = false;
  }
}

module.exports = {
  init,     // アプリ起動時に一度だけ呼ぶ
  db,       // どこからでも共有接続を取得
  withTx,   // まとめて原子的に実行
  health,   // 疎通確認用
  checkpoint,
  vacuum,
  close
};
