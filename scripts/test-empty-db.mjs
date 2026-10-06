import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import Database from 'better-sqlite3'

const testPath = path.resolve('tmp/mpc-crud-test.db')

execFileSync(
  process.execPath,
  [
    'scripts/create-empty-db.mjs',
    '--output',
    testPath,
    '--force',
  ],
  { stdio: 'inherit' },
)

const db = new Database(testPath)
db.pragma('foreign_keys = ON')

try {
  const createFamily = db.prepare(`
    INSERT INTO families (code, name, notes)
    VALUES ('TR', 'Tractor', 'Familia temporal')
  `).run()
  const familyId = Number(createFamily.lastInsertRowid)

  const createModel = db.prepare(`
    INSERT INTO models (family_id, brand, name, variant)
    VALUES (?, 'TLD', 'JST25', 'DIESEL')
  `).run(familyId)
  const modelId = Number(createModel.lastInsertRowid)

  const createPart = db.prepare(`
    INSERT INTO parts (name, sap_code, oem_code, notes)
    VALUES ('Filtro de prueba', 'SAP-TEST', 'OEM-TEST', 'Temporal')
  `).run()
  const partId = Number(createPart.lastInsertRowid)

  db.prepare(`
    INSERT INTO part_compatibilities (part_id, model_id, verified_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
  `).run(partId, modelId)

  db.prepare(`
    UPDATE parts
    SET name = 'Filtro de prueba editado', sap_code = 'SAP-EDITADO'
    WHERE id = ?
  `).run(partId)
  db.prepare(`
    UPDATE families
    SET name = 'Tractor editado', notes = 'Notas editadas'
    WHERE id = ?
  `).run(familyId)
  db.prepare(`
    UPDATE models
    SET name = 'JST25 editado', variant = 'DIESEL EVO'
    WHERE id = ?
  `).run(modelId)
  db.prepare(`
    UPDATE parts
    SET verification_status = 'verified'
    WHERE id = ?
  `).run(partId)

  const catalogCount = () => db.prepare(`
    SELECT COUNT(*) AS count
    FROM parts p
    JOIN part_compatibilities pc ON pc.part_id = p.id
    JOIN models m ON m.id = pc.model_id
    JOIN families f ON f.id = m.family_id
    WHERE
      p.status = 'active'
      AND p.verification_status = 'verified'
      AND m.status = 'active'
      AND f.status = 'active'
  `).get().count

  const publishedBeforeArchive = catalogCount()
  db.prepare("UPDATE parts SET status = 'inactive' WHERE id = ?").run(partId)
  const publishedWhileArchived = catalogCount()
  db.prepare("UPDATE parts SET status = 'active' WHERE id = ?").run(partId)
  const publishedAfterRestore = catalogCount()

  db.prepare("UPDATE models SET status = 'inactive' WHERE id = ?").run(modelId)
  const relationAfterModelArchive = db.prepare(`
    SELECT COUNT(*) AS count
    FROM part_compatibilities
    WHERE part_id = ? AND model_id = ?
  `).get(partId, modelId).count
  db.prepare("UPDATE models SET status = 'active' WHERE id = ?").run(modelId)

  const quickCheck = db.pragma('quick_check', { simple: true })
  const foreignKeyIssues = db.pragma('foreign_key_check')

  const result = {
    created: { familyId, modelId, partId },
    publishedBeforeArchive,
    publishedWhileArchived,
    publishedAfterRestore,
    relationAfterModelArchive,
    quickCheck,
    foreignKeyIssues: foreignKeyIssues.length,
  }

  if (
    publishedBeforeArchive !== 1 ||
    publishedWhileArchived !== 0 ||
    publishedAfterRestore !== 1 ||
    relationAfterModelArchive !== 1 ||
    quickCheck !== 'ok' ||
    foreignKeyIssues.length !== 0
  ) {
    throw new Error(`Prueba CRUD fallida: ${JSON.stringify(result)}`)
  }

  console.log('Prueba CRUD temporal: OK')
  console.log(JSON.stringify(result, null, 2))
} finally {
  db.close()
  fs.rmSync(testPath, { force: true })
}
