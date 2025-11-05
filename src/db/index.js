// db/index.js
// 役割: 再エクスポートだけ。DB生成やPRAGMAは connection.js に集約。

const conn = require('./connection');
const migrate = require('./migrate');

module.exports = {
  ...conn,
  migrate,
};
