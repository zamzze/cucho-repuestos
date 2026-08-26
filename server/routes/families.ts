import { Router } from 'express'
import { db } from '../database/db'

export const familiesRouter = Router()

familiesRouter.get('/', (_req, res) => {
  const families = db
    .prepare(`
      SELECT
        f.id,
        f.code,
        f.name,
        f.status,
        f.notes,

        COUNT(m.id) AS model_count

      FROM families f

      LEFT JOIN models m
        ON m.family_id = f.id

      GROUP BY f.id

      ORDER BY f.name ASC
    `)
    .all()

  res.json(families)
})


/* =========================================================
   POST /api/families

   Body:
   {
     "code": "PE",
     "name": "Planta eléctrica"
   }
   ========================================================= */

familiesRouter.post('/', (req, res) => {
  const code = String(
    req.body.code ?? '',
  )
    .trim()
    .toUpperCase()

  const name = String(
    req.body.name ?? '',
  ).trim()

  if (!code) {
    return res.status(400).json({
      error:
        'El código de familia es obligatorio.',
    })
  }

  if (!name) {
    return res.status(400).json({
      error:
        'El nombre de familia es obligatorio.',
    })
  }

  const existing = db
    .prepare(`
      SELECT id
      FROM families
      WHERE code = ?
    `)
    .get(code)

  if (existing) {
    return res.status(409).json({
      error:
        'Ya existe una familia con ese código.',
    })
  }

  const result = db
    .prepare(`
      INSERT INTO families (
        code,
        name,
        status
      )
      VALUES (?, ?, 'active')
    `)
    .run(
      code,
      name,
    )

  const created = db
    .prepare(`
      SELECT
        id,
        code,
        name,
        status,
        notes
      FROM families
      WHERE id = ?
    `)
    .get(result.lastInsertRowid)

  res.status(201).json(created)
})