import { Router } from 'express'
import { db } from '../database/db'

export const partsRouter = Router()

/* =========================================================
   GET /api/parts
   Buscar y filtrar repuestos
   ========================================================= */

partsRouter.get('/', (req, res) => {
  const q = String(req.query.q ?? '').trim()
  const verification = String(
    req.query.verification ?? '',
  ).trim()

  const where: string[] = []
  const params: unknown[] = []

  if (verification) {
    where.push('verification_status = ?')
    params.push(verification)
  }

  if (q) {
    where.push(`
      (
        sap_code LIKE ?
        OR oem_code LIKE ?
        OR name LIKE ?
        OR legacy_id LIKE ?
      )
    `)

    const term = `%${q}%`

    params.push(
      term,
      term,
      term,
      term,
    )
  }

  const whereSql =
    where.length > 0
      ? `WHERE ${where.join(' AND ')}`
      : ''

  const parts = db
    .prepare(`
      SELECT
        id,
        legacy_id,
        sap_code,
        oem_code,
        name,
        notes,
        status,
        verification_status
      FROM parts
      ${whereSql}
      ORDER BY name ASC
    `)
    .all(...params)

  res.json(parts)
})


/* =========================================================
   GET /api/parts/stats
   Contadores para dashboard
   ========================================================= */

partsRouter.get('/stats', (_req, res) => {
  const total = db
    .prepare(`
      SELECT COUNT(*) AS total
      FROM parts
    `)
    .get() as { total: number }

  const byStatus = db
    .prepare(`
      SELECT
        verification_status,
        COUNT(*) AS total
      FROM parts
      GROUP BY verification_status
    `)
    .all() as {
      verification_status: string
      total: number
    }[]

  const stats = {
    total: total.total,
    pending: 0,
    review: 0,
    verified: 0,
  }

  for (const row of byStatus) {
    if (
      row.verification_status === 'pending'
    ) {
      stats.pending = row.total
    }

    if (
      row.verification_status === 'review'
    ) {
      stats.review = row.total
    }

    if (
      row.verification_status === 'verified'
    ) {
      stats.verified = row.total
    }
  }

  res.json(stats)
})


/* =========================================================
   GET /api/parts/:id
   Detalle de repuesto
   ========================================================= */

partsRouter.get('/:id', (req, res) => {
  const id = Number(req.params.id)

  if (!Number.isInteger(id)) {
    return res.status(400).json({
      error: 'ID inválido',
    })
  }

  const part = db
    .prepare(`
      SELECT
        id,
        legacy_id,
        sap_code,
        oem_code,
        name,
        notes,
        status,
        verification_status
      FROM parts
      WHERE id = ?
    `)
    .get(id)

  if (!part) {
    return res.status(404).json({
      error: 'Repuesto no encontrado',
    })
  }

  res.json(part)
})


/* =========================================================
   GET /api/parts/:id/compatibilities
   Compatibilidades CONFIRMADAS
   ========================================================= */

partsRouter.get(
  '/:id/compatibilities',
  (req, res) => {
    const partId = Number(req.params.id)

    if (!Number.isInteger(partId)) {
      return res.status(400).json({
        error: 'ID inválido',
      })
    }

    const rows = db
      .prepare(`
        SELECT
          pc.id,
          pc.part_id,
          pc.model_id,
          pc.notes,
          pc.verified_at,

          m.brand,
          m.name AS model_name,
          m.variant,

          f.id AS family_id,
          f.code AS family_code,
          f.name AS family_name

        FROM part_compatibilities pc

        INNER JOIN models m
          ON m.id = pc.model_id

        INNER JOIN families f
          ON f.id = m.family_id

        WHERE pc.part_id = ?

        ORDER BY
          f.name,
          m.brand,
          m.name
      `)
      .all(partId)

    res.json(rows)
  },
)


/* =========================================================
   GET /api/parts/:id/suggestions
   Sugerencias históricas
   ========================================================= */

partsRouter.get(
  '/:id/suggestions',
  (req, res) => {
    const partId = Number(req.params.id)

    if (!Number.isInteger(partId)) {
      return res.status(400).json({
        error: 'ID inválido',
      })
    }

    const rows = db
      .prepare(`
        SELECT
          cs.id,
          cs.part_id,
          cs.family_id,
          cs.model_id,
          cs.source,
          cs.confidence,

          f.code AS family_code,
          f.name AS family_name,

          m.brand,
          m.name AS model_name,
          m.variant

        FROM compatibility_suggestions cs

        INNER JOIN families f
          ON f.id = cs.family_id

        LEFT JOIN models m
          ON m.id = cs.model_id

        WHERE cs.part_id = ?

        ORDER BY
          CASE cs.confidence
            WHEN 'high' THEN 1
            WHEN 'medium' THEN 2
            ELSE 3
          END,
          f.name,
          m.brand,
          m.name
      `)
      .all(partId)

    res.json(rows)
  },
)


/* =========================================================
   POST /api/parts/:id/compatibilities
   Añadir compatibilidad confirmada

   Body:
   {
     "modelId": 13,
     "notes": "opcional"
   }
   ========================================================= */

partsRouter.post(
  '/:id/compatibilities',
  (req, res) => {
    const partId = Number(req.params.id)
    const modelId = Number(req.body.modelId)
    const notes =
      typeof req.body.notes === 'string'
        ? req.body.notes.trim()
        : null

    if (!Number.isInteger(partId)) {
      return res.status(400).json({
        error: 'ID de repuesto inválido',
      })
    }

    if (!Number.isInteger(modelId)) {
      return res.status(400).json({
        error: 'ID de modelo inválido',
      })
    }

    const part = db
      .prepare(`
        SELECT id
        FROM parts
        WHERE id = ?
      `)
      .get(partId)

    if (!part) {
      return res.status(404).json({
        error: 'Repuesto no encontrado',
      })
    }

    const model = db
      .prepare(`
        SELECT id
        FROM models
        WHERE id = ?
      `)
      .get(modelId)

    if (!model) {
      return res.status(404).json({
        error: 'Modelo no encontrado',
      })
    }

    const existing = db
      .prepare(`
        SELECT id
        FROM part_compatibilities
        WHERE part_id = ?
          AND model_id = ?
      `)
      .get(
        partId,
        modelId,
      )

    if (existing) {
      return res.status(409).json({
        error:
          'La compatibilidad ya existe.',
      })
    }

    const result = db
      .prepare(`
        INSERT INTO part_compatibilities (
          part_id,
          model_id,
          notes,
          verified_at
        )
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `)
      .run(
        partId,
        modelId,
        notes,
      )

    const created = db
      .prepare(`
        SELECT
          pc.id,
          pc.part_id,
          pc.model_id,
          pc.notes,
          pc.verified_at,

          m.brand,
          m.name AS model_name,
          m.variant,

          f.id AS family_id,
          f.code AS family_code,
          f.name AS family_name

        FROM part_compatibilities pc

        INNER JOIN models m
          ON m.id = pc.model_id

        INNER JOIN families f
          ON f.id = m.family_id

        WHERE pc.id = ?
      `)
      .get(result.lastInsertRowid)

    res.status(201).json(created)
  },
)


/* =========================================================
   DELETE /api/parts/:id/compatibilities/:modelId
   Quitar compatibilidad confirmada
   ========================================================= */

partsRouter.delete(
  '/:id/compatibilities/:modelId',
  (req, res) => {
    const partId = Number(req.params.id)
    const modelId = Number(
      req.params.modelId,
    )

    if (
      !Number.isInteger(partId) ||
      !Number.isInteger(modelId)
    ) {
      return res.status(400).json({
        error: 'IDs inválidos',
      })
    }

    const result = db
      .prepare(`
        DELETE FROM part_compatibilities
        WHERE part_id = ?
          AND model_id = ?
      `)
      .run(
        partId,
        modelId,
      )

    if (result.changes === 0) {
      return res.status(404).json({
        error:
          'Compatibilidad no encontrada.',
      })
    }

    res.json({
      ok: true,
    })
  },
)


/* =========================================================
   PATCH /api/parts/:id/verification
   Cambiar estado de verificación

   Body:
   {
     "status": "verified"
   }

   Permitidos:
   pending
   review
   verified
   ========================================================= */

partsRouter.patch(
  '/:id/verification',
  (req, res) => {
    const partId = Number(req.params.id)
    const status = String(
      req.body.status ?? '',
    ).trim()

    const allowed = new Set([
      'pending',
      'review',
      'verified',
    ])

    if (!Number.isInteger(partId)) {
      return res.status(400).json({
        error: 'ID inválido',
      })
    }

    if (!allowed.has(status)) {
      return res.status(400).json({
        error:
          'Estado inválido. Usa pending, review o verified.',
      })
    }

    const result = db
      .prepare(`
        UPDATE parts
        SET
          verification_status = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .run(
        status,
        partId,
      )

    if (result.changes === 0) {
      return res.status(404).json({
        error: 'Repuesto no encontrado',
      })
    }

    const updated = db
      .prepare(`
        SELECT
          id,
          legacy_id,
          sap_code,
          oem_code,
          name,
          notes,
          status,
          verification_status
        FROM parts
        WHERE id = ?
      `)
      .get(partId)

    res.json(updated)
  },
)