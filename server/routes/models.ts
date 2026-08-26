import { Router } from 'express'
import { db } from '../database/db'

export const modelsRouter = Router()

modelsRouter.get('/', (req, res) => {
  const familyIdRaw =
    req.query.familyId

  const familyId =
    familyIdRaw !== undefined
      ? Number(familyIdRaw)
      : null

  if (
    familyId !== null &&
    !Number.isInteger(familyId)
  ) {
    return res.status(400).json({
      error: 'familyId inválido',
    })
  }

  if (familyId !== null) {
    const models = db
      .prepare(`
        SELECT
          m.id,
          m.family_id,

          f.code AS family_code,
          f.name AS family_name,

          m.brand,
          m.name,
          m.variant,
          m.status

        FROM models m

        INNER JOIN families f
          ON f.id = m.family_id

        WHERE m.family_id = ?

        ORDER BY
          m.brand,
          m.name
      `)
      .all(familyId)

    return res.json(models)
  }

  const models = db
    .prepare(`
      SELECT
        m.id,
        m.family_id,

        f.code AS family_code,
        f.name AS family_name,

        m.brand,
        m.name,
        m.variant,
        m.status

      FROM models m

      INNER JOIN families f
        ON f.id = m.family_id

      ORDER BY
        f.name,
        m.brand,
        m.name
    `)
    .all()

  res.json(models)
})


/* =========================================================
   POST /api/models

   Body:
   {
     "familyId": 1,
     "brand": "FORD",
     "name": "300",
     "variant": "DIESEL"
   }
   ========================================================= */

modelsRouter.post('/', (req, res) => {
  const familyId = Number(
    req.body.familyId,
  )

  const brand = String(
    req.body.brand ?? '',
  ).trim()

  const name = String(
    req.body.name ?? '',
  ).trim()

  const variant =
    typeof req.body.variant === 'string'
      ? req.body.variant.trim() || null
      : null

  if (!Number.isInteger(familyId)) {
    return res.status(400).json({
      error:
        'familyId es obligatorio.',
    })
  }

  if (!brand) {
    return res.status(400).json({
      error:
        'La marca es obligatoria.',
    })
  }

  if (!name) {
    return res.status(400).json({
      error:
        'El modelo es obligatorio.',
    })
  }

  const family = db
    .prepare(`
      SELECT id
      FROM families
      WHERE id = ?
    `)
    .get(familyId)

  if (!family) {
    return res.status(404).json({
      error:
        'La familia indicada no existe.',
    })
  }

  const duplicate = db
    .prepare(`
      SELECT id
      FROM models
      WHERE family_id = ?
        AND UPPER(brand) = UPPER(?)
        AND UPPER(name) = UPPER(?)
        AND COALESCE(
          UPPER(variant),
          ''
        ) = COALESCE(
          UPPER(?),
          ''
        )
    `)
    .get(
      familyId,
      brand,
      name,
      variant,
    )

  if (duplicate) {
    return res.status(409).json({
      error:
        'Ese modelo ya existe en la familia.',
    })
  }

  const result = db
    .prepare(`
      INSERT INTO models (
        family_id,
        brand,
        name,
        variant,
        status
      )
      VALUES (
        ?,
        ?,
        ?,
        ?,
        'active'
      )
    `)
    .run(
      familyId,
      brand,
      name,
      variant,
    )

  const created = db
    .prepare(`
      SELECT
        m.id,
        m.family_id,

        f.code AS family_code,
        f.name AS family_name,

        m.brand,
        m.name,
        m.variant,
        m.status

      FROM models m

      INNER JOIN families f
        ON f.id = m.family_id

      WHERE m.id = ?
    `)
    .get(result.lastInsertRowid)

  res.status(201).json(created)
})