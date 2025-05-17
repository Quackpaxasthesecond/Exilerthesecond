const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./exile_data.db');

// Create exile count table if not exists
db.run(`CREATE TABLE IF NOT EXISTS exiles (
  user_id TEXT PRIMARY KEY,
  count INTEGER DEFAULT 0
)`);

module.exports = db;