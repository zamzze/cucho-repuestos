import fs from 'node:fs'
import path from 'node:path'

import Database from 'better-sqlite3'

const args = process.argv.slice(2)
const outputIndex = args.indexOf('--output')
const requestedOutput =
  outputIndex >= 0
    ? args[outputIndex + 1]
    : 'tmp/mpc-empty.db'
const force = args.includes('--force')

if (!requestedOutput) {
  throw new Error('Falta la ruta después de --output.')
}

const destination = path.resolve(process.cwd(), requestedOutput)

if (fs.existsSync(destination) && !force) {
  throw new Error(
    `El destino ya existe: ${destination}\n` +
      'Usa otra ruta o añade --force conscientemente.',
  )
}

fs.mkdirSync(path.dirname(destination), { recursive: true })

if (fs.existsSync(destination)) {
  fs.unlinkSync(destination)
}

const db = new Database(destination)

try {
  db.pragma('foreign_keys = ON')
  db.exec(`
    CREATE TABLE metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE families (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      legacy_id TEXT UNIQUE,
      code TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active'
        CHECK(status IN ('active','inactive','deprecated')),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      legacy_id TEXT UNIQUE,
      family_id INTEGER NOT NULL,
      brand TEXT NOT NULL,
      name TEXT NOT NULL,
      variant TEXT,
      status TEXT NOT NULL DEFAULT 'active'
        CHECK(status IN ('active','inactive','deprecated')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE RESTRICT,
      UNIQUE (family_id, brand, name, variant)
    );

    CREATE TABLE parts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      legacy_id TEXT UNIQUE,
      sap_code TEXT COLLATE NOCASE,
      oem_code TEXT COLLATE NOCASE,
      name TEXT NOT NULL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'active'
        CHECK(status IN ('active','inactive')),
      verification_status TEXT NOT NULL DEFAULT 'pending'
        CHECK(verification_status IN ('pending','verified','review')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE part_compatibilities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_id INTEGER NOT NULL,
      model_id INTEGER NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      verified_at TEXT,
      FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE CASCADE,
      FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
      UNIQUE (part_id, model_id)
    );

    CREATE TABLE compatibility_suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_id INTEGER NOT NULL,
      family_id INTEGER,
      model_id INTEGER,
      source_candidate_id TEXT,
      source TEXT,
      evidence TEXT,
      confidence TEXT NOT NULL DEFAULT 'low'
        CHECK(confidence IN ('low','medium','high')),
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending','accepted','rejected')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE CASCADE,
      FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
      FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
      UNIQUE (part_id, model_id, source_candidate_id)
    );

    CREATE INDEX idx_parts_sap ON parts(sap_code);
    CREATE INDEX idx_parts_oem ON parts(oem_code);
    CREATE INDEX idx_parts_name ON parts(name);
    CREATE INDEX idx_parts_verification ON parts(verification_status);
    CREATE INDEX idx_models_family ON models(family_id);
    CREATE INDEX idx_compat_part ON part_compatibilities(part_id);
    CREATE INDEX idx_compat_model ON part_compatibilities(model_id);
    CREATE INDEX idx_suggestions_part ON compatibility_suggestions(part_id);
    CREATE INDEX idx_suggestions_model ON compatibility_suggestions(model_id);

    INSERT INTO metadata (key, value)
    VALUES ('catalog_version', '0.2.0');
  `)

  const quickCheck = db.pragma('quick_check', { simple: true })
  const foreignKeyIssues = db.pragma('foreign_key_check')

  if (quickCheck !== 'ok' || foreignKeyIssues.length > 0) {
    throw new Error('La base generada no superó las validaciones SQLite.')
  }

  console.log(`Base SQLite vacía creada en: ${destination}`)
  console.log('quick_check: ok')
  console.log('foreign_key_check: 0 filas')
} catch (error) {
  db.close()
  fs.rmSync(destination, { force: true })
  throw error
}

db.close()
