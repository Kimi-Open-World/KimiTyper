import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_PATH = process.env.DB_PATH || './data/kimityper.db'

// 确保目录存在
const dbDir = path.dirname(path.resolve(DB_PATH))
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
}

const db = new Database(path.resolve(DB_PATH))

// 开启 WAL 模式提升写入性能
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

/**
 * 初始化数据库表
 */
export function initDB(): void {
    db.exec(`
    -- 用户表
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      nickname TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Refresh Token 表（支持多设备登录）
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- 同步数据表（通用 KV 存储）
    -- data_type: 'progress' | 'book' | 'sm2card' | 'stats' | 'settings' | 'keyVocabulary'
    CREATE TABLE IF NOT EXISTS sync_data (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      data_type TEXT NOT NULL,
      data_key TEXT NOT NULL,
      data_value TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      UNIQUE(user_id, data_type, data_key),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sync_data_user ON sync_data(user_id);
    CREATE INDEX IF NOT EXISTS idx_sync_data_type ON sync_data(user_id, data_type);
    CREATE INDEX IF NOT EXISTS idx_sync_data_updated ON sync_data(user_id, updated_at);
  `)

    console.log('✅ Database initialized')
}

export default db
