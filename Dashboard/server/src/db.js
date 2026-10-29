import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

export class ReadingDB {
  constructor({ dbPath } = {}) {
    const defaultPath = path.resolve(process.cwd(), 'readings.db');
    this.dbPath = dbPath || defaultPath;
    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new DatabaseSync(this.dbPath);
    this.#init();
  }

  #init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        value INTEGER NOT NULL,
        severity TEXT,
        state TEXT
      )
    `);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_readings_ts ON readings(timestamp)`);
  }

  insertReading({ timestamp, value, severity, state }) {
    try {
      const stmt = this.db.prepare('INSERT INTO readings (timestamp, value, severity, state) VALUES (?, ?, ?, ?)');
      stmt.run(timestamp, value, severity || null, state || null);
    } catch (err) {
      console.error('[db] failed to insert reading:', err);
    }
  }

  getHistory(limit = 720) {
    try {
      const stmt = this.db.prepare('SELECT timestamp as t, value, severity FROM readings ORDER BY timestamp ASC LIMIT ?');
      const rows = stmt.all(limit);
      // Return in chronological order (oldest first) to match history format
      return rows;
    } catch (err) {
      console.error('[db] failed to get history:', err);
      return [];
    }
  }

  getRecentHistory(limit = 720) {
    try {
      const stmt = this.db.prepare('SELECT timestamp as t, value, severity FROM readings ORDER BY timestamp DESC LIMIT ?');
      const rows = stmt.all(limit);
      // Reverse to get chronological order
      return rows.reverse();
    } catch (err) {
      console.error('[db] failed to get recent history:', err);
      return [];
    }
  }

  close() {
    try {
      this.db.close();
    } catch {}
  }
}
