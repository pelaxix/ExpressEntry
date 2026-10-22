import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
export function openStore(dir) {
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(join(dir, "express-entry.sqlite"));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS tracker_state(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS draws(id INTEGER PRIMARY KEY,date TEXT NOT NULL,category TEXT NOT NULL,json TEXT NOT NULL,first_seen TEXT NOT NULL,last_seen TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS pool_snapshots(date TEXT PRIMARY KEY,json TEXT NOT NULL,first_seen TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS alerts(id TEXT PRIMARY KEY,draw_id INTEGER NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,sent_at TEXT,error TEXT,attempts INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,expires_at INTEGER NOT NULL);`);
  // A stopped process may leave an alert claimed. Requeue at startup for at-least-once delivery.
  db.prepare("UPDATE alerts SET status='pending' WHERE status='sending'").run();
  return {
    db,
    read(key) {
      const r = db
        .prepare("SELECT value FROM tracker_state WHERE key=?")
        .get(key);
      return r ? JSON.parse(r.value) : null;
    },
    write(key, value) {
      db.prepare(
        "INSERT INTO tracker_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      ).run(key, JSON.stringify(value));
    },
    close() {
      db.close();
    },
  };
}
