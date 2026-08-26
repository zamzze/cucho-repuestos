import path from 'node:path'
import Database from 'better-sqlite3'

const dbPath = path.join(
  process.cwd(),
  'server',
  'database',
  'mpc.db',
)

export const db = new Database(dbPath)

db.pragma('foreign_keys = ON')