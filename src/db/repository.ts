import {
  initDatabase,
  persistDatabase,
} from './sqlite'

export interface ApiPart {
  id: number
  legacy_id: string | null
  sap_code: string | null
  oem_code: string | null
  name: string
  notes: string | null
  status: string

  verification_status:
    | 'pending'
    | 'review'
    | 'verified'
}

export interface ApiPartStats {
  total: number
  pending: number
  review: number
  verified: number
}

export interface ApiFamily {
  id: number
  code: string
  name: string
  status: string
  notes: string | null
  model_count?: number
}

export interface ApiModel {
  id: number
  family_id: number
  family_code: string
  family_name: string
  brand: string
  name: string
  variant: string | null
  status: string
}

export interface ApiCompatibility {
  id: number
  part_id: number
  model_id: number
  notes: string | null
  verified_at: string | null

  brand: string
  model_name: string
  variant: string | null

  family_id: number
  family_code: string
  family_name: string
}

export interface ApiSuggestion {
  id: number
  part_id: number
  family_id: number
  model_id: number | null
  source: string | null

  confidence:
    | 'high'
    | 'medium'
    | 'low'
    | null

  family_code: string
  family_name: string

  brand: string | null
  model_name: string | null
  variant: string | null
}

type SqlValue =
  | string
  | number
  | Uint8Array
  | null

async function query<T>(
  sql: string,
  params: SqlValue[] = [],
): Promise<T[]> {
  const db =
    await initDatabase()

  const statement =
    db.prepare(sql)

  statement.bind(params)

  const rows: T[] = []

  while (statement.step()) {
    rows.push(
      statement.getAsObject() as T,
    )
  }

  statement.free()

  return rows
}

async function queryOne<T>(
  sql: string,
  params: SqlValue[] = [],
): Promise<T | null> {
  const rows =
    await query<T>(
      sql,
      params,
    )

  return rows[0] ?? null
}

export async function getPartStats() {
  const result =
    await queryOne<ApiPartStats>(`
      SELECT
        COUNT(*) AS total,

        SUM(
          verification_status =
          'pending'
        ) AS pending,

        SUM(
          verification_status =
          'review'
        ) AS review,

        SUM(
          verification_status =
          'verified'
        ) AS verified

      FROM parts
    `)

  return {
    total:
      Number(result?.total) || 0,

    pending:
      Number(result?.pending) || 0,

    review:
      Number(result?.review) || 0,

    verified:
      Number(result?.verified) || 0,
  }
}

export async function getParts(
  options?: {
    q?: string
    verification?: string
  },
) {
  const conditions: string[] = []
  const params: SqlValue[] = []

  if (options?.verification) {
    conditions.push(
      'verification_status = ?',
    )

    params.push(
      options.verification,
    )
  }

  if (options?.q?.trim()) {
    const term =
      `%${options.q.trim()}%`

    conditions.push(`
      (
        sap_code LIKE ?
        OR oem_code LIKE ?
        OR name LIKE ?
        OR legacy_id LIKE ?
      )
    `)

    params.push(
      term,
      term,
      term,
      term,
    )
  }

  const where =
    conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : ''

  return query<ApiPart>(`
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

    ${where}

    ORDER BY name
  `, params)
}

export function getPart(
  id: number,
) {
  return queryOne<ApiPart>(`
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
  `, [id])
}

export function getFamilies() {
  return query<ApiFamily>(`
    SELECT
      f.id,
      f.code,
      f.name,
      f.status,
      f.notes,

      COUNT(m.id)
        AS model_count

    FROM families f

    LEFT JOIN models m
      ON m.family_id = f.id

    GROUP BY f.id

    ORDER BY f.name
  `)
}

export function getModels(
  familyId?: number,
) {
  if (familyId) {
    return query<ApiModel>(`
      SELECT
        m.id,
        m.family_id,

        f.code
          AS family_code,

        f.name
          AS family_name,

        m.brand,
        m.name,
        m.variant,
        m.status

      FROM models m

      JOIN families f
        ON f.id = m.family_id

      WHERE m.family_id = ?

      ORDER BY
        m.brand,
        m.name
    `, [familyId])
  }

  return query<ApiModel>(`
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

    JOIN families f
      ON f.id = m.family_id

    ORDER BY
      f.name,
      m.brand,
      m.name
  `)
}

export function getPartCompatibilities(
  partId: number,
) {
  return query<ApiCompatibility>(`
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

    JOIN models m
      ON m.id = pc.model_id

    JOIN families f
      ON f.id = m.family_id

    WHERE pc.part_id = ?

    ORDER BY
      f.name,
      m.brand,
      m.name
  `, [partId])
}

export function getPartSuggestions(
  partId: number,
) {
  return query<ApiSuggestion>(`
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

    JOIN families f
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
  `, [partId])
}

export async function addCompatibility(
  partId: number,
  modelId: number,
) {
  const db =
    await initDatabase()

  const existing =
    await queryOne<{
      id: number
    }>(`
      SELECT id

      FROM part_compatibilities

      WHERE
        part_id = ?
        AND model_id = ?
    `, [
      partId,
      modelId,
    ])

  if (existing) {
    throw new Error(
      'La compatibilidad ya existe.',
    )
  }

  db.run(`
    INSERT INTO
      part_compatibilities (
        part_id,
        model_id,
        verified_at
      )

    VALUES (
      ?,
      ?,
      CURRENT_TIMESTAMP
    )
  `, [
    partId,
    modelId,
  ])

  await persistDatabase()

  const created =
    await queryOne<ApiCompatibility>(`
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

      JOIN models m
        ON m.id = pc.model_id

      JOIN families f
        ON f.id = m.family_id

      WHERE
        pc.part_id = ?
        AND pc.model_id = ?
    `, [
      partId,
      modelId,
    ])

  if (!created) {
    throw new Error(
      'No se pudo recuperar la compatibilidad creada.',
    )
  }

  return created
}

export async function deleteCompatibility(
  partId: number,
  modelId: number,
) {
  const db =
    await initDatabase()

  db.run(`
    DELETE FROM
      part_compatibilities

    WHERE
      part_id = ?
      AND model_id = ?
  `, [
    partId,
    modelId,
  ])

  await persistDatabase()

  return {
    ok: true,
  }
}

export async function updatePartVerification(
  partId: number,
  status:
    | 'pending'
    | 'review'
    | 'verified',
) {
  const db =
    await initDatabase()

  db.run(`
    UPDATE parts

    SET
      verification_status = ?,
      updated_at =
        CURRENT_TIMESTAMP

    WHERE id = ?
  `, [
    status,
    partId,
  ])

  await persistDatabase()

  const updated =
    await getPart(partId)

  if (!updated) {
    throw new Error(
      'Repuesto no encontrado.',
    )
  }

  return updated
}

export async function createFamily(
  code: string,
  name: string,
) {
  const db =
    await initDatabase()

  const normalized =
    code.trim().toUpperCase()

  const existing =
    await queryOne(`
      SELECT id

      FROM families

      WHERE UPPER(code) =
        UPPER(?)
    `, [normalized])

  if (existing) {
    throw new Error(
      'Ya existe una familia con ese código.',
    )
  }

  db.run(`
    INSERT INTO families (
      code,
      name,
      status
    )

    VALUES (
      ?,
      ?,
      'active'
    )
  `, [
    normalized,
    name.trim(),
  ])

  await persistDatabase()

  const created =
    await queryOne<ApiFamily>(`
      SELECT
        id,
        code,
        name,
        status,
        notes

      FROM families

      WHERE code = ?
    `, [normalized])

  if (!created) {
    throw new Error(
      'No se pudo crear la familia.',
    )
  }

  return created }

  export async function createModel(
  data: {
    familyId: number
    brand: string
    name: string
    variant?: string
  },
) {
  const db =
    await initDatabase()

  const variant =
    data.variant?.trim() || null

  db.run(`
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
  `, [
    data.familyId,
    data.brand.trim(),
    data.name.trim(),
    variant,
  ])

  const idResult =
    db.exec(`
      SELECT
        last_insert_rowid()
    `)

  const id =
    Number(
      idResult[0]
        ?.values[0]?.[0],
    )

  await persistDatabase()

  const created =
    await queryOne<ApiModel>(`
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

      JOIN families f
        ON f.id = m.family_id

      WHERE m.id = ?
    `, [id])

  if (!created) {
    throw new Error(
      'No se pudo crear el modelo.',
    )
  }

  return created
}