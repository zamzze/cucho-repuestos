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

  compatibility_count?: number
}

export interface ApiPartStats {
  total: number
  pending: number
  review: number
  verified: number
}

export interface PartDependencyCounts {
  compatibilityCount: number
  suggestionCount: number
}

export interface FamilyDependencyCounts {
  modelCount: number
  compatibilityCount: number
}

export interface ModelDependencyCounts {
  compatibilityCount: number
}

export interface ApiCatalogStats {
  parts: number
  families: number
  models: number
  compatibilities: number
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

      WHERE status = 'active'
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
    includeInactive?: boolean
  },
) {
  const conditions: string[] = []
  const params: SqlValue[] = []

  if (!options?.includeInactive) {
    conditions.push(
      "status = 'active'",
    )
  }

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

    ORDER BY
      CASE verification_status
        WHEN 'pending' THEN 1
        WHEN 'review' THEN 2
        WHEN 'verified' THEN 3
        ELSE 4
      END,
      name COLLATE NOCASE ASC
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

export async function getCatalogStats() {
  const result =
    await queryOne<ApiCatalogStats>(`
      SELECT
        (SELECT COUNT(*) FROM parts WHERE status = 'active') AS parts,
        (SELECT COUNT(*) FROM families WHERE status = 'active') AS families,
        (
          SELECT COUNT(*)
          FROM models m
          JOIN families f ON f.id = m.family_id
          WHERE m.status = 'active' AND f.status = 'active'
        ) AS models,
        (
          SELECT COUNT(*)
          FROM part_compatibilities pc
          JOIN parts p ON p.id = pc.part_id
          JOIN models m ON m.id = pc.model_id
          JOIN families f ON f.id = m.family_id
          WHERE
            p.status = 'active'
            AND m.status = 'active'
            AND f.status = 'active'
        ) AS compatibilities,
        (
          SELECT COUNT(*) FROM parts
          WHERE status = 'active' AND verification_status = 'pending'
        ) AS pending,
        (
          SELECT COUNT(*) FROM parts
          WHERE status = 'active' AND verification_status = 'review'
        ) AS review,
        (
          SELECT COUNT(*) FROM parts
          WHERE status = 'active' AND verification_status = 'verified'
        ) AS verified
    `)

  return {
    parts: Number(result?.parts) || 0,
    families: Number(result?.families) || 0,
    models: Number(result?.models) || 0,
    compatibilities:
      Number(result?.compatibilities) || 0,
    pending: Number(result?.pending) || 0,
    review: Number(result?.review) || 0,
    verified: Number(result?.verified) || 0,
  }
}

export function getFamilies(
  options?: {
    includeInactive?: boolean
  },
) {
  const where =
    options?.includeInactive
      ? ''
      : "WHERE f.status = 'active'"

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

    ${where}

    GROUP BY f.id

    ORDER BY f.name
  `)
}

export function getModels(
  familyId?: number,
  options?: {
    includeInactive?: boolean
  },
) {
  const statusCondition =
    options?.includeInactive
      ? ''
      : `
        AND m.status = 'active'
        AND f.status = 'active'
      `

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

      ${statusCondition}

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

    WHERE 1 = 1

    ${statusCondition}

    ORDER BY
      f.name,
      m.brand,
      m.name
  `)
}

export function getPartCompatibilities(
  partId: number,
  options?: {
    includeInactive?: boolean
  },
) {
  const statusCondition =
    options?.includeInactive
      ? ''
      : `
        AND m.status = 'active'
        AND f.status = 'active'
      `

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

    ${statusCondition}

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

  const activeTargets =
    await queryOne<{ id: number }>(`
      SELECT p.id
      FROM parts p
      JOIN models m
        ON m.id = ?
      JOIN families f
        ON f.id = m.family_id
      WHERE
        p.id = ?
        AND p.status = 'active'
        AND m.status = 'active'
        AND f.status = 'active'
    `, [modelId, partId])

  if (!activeTargets) {
    throw new Error(
      'Solo se pueden relacionar repuestos, modelos y familias activos.',
    )
  }

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

function requiredText(
  value: string,
  label: string,
) {
  const normalized = value.trim()

  if (!normalized) {
    throw new Error(
      `${label} es obligatorio.`,
    )
  }

  return normalized
}

function nullableText(
  value?: string | null,
) {
  return value?.trim() || null
}

async function assertSapAvailable(
  sapCode: string | null,
  excludedPartId?: number,
) {
  if (!sapCode) {
    return
  }

  const existing =
    await queryOne<{ id: number }>(`
      SELECT id
      FROM parts
      WHERE
        UPPER(TRIM(sap_code)) =
          UPPER(TRIM(?))
        AND (? IS NULL OR id <> ?)
      LIMIT 1
    `, [
      sapCode,
      excludedPartId ?? null,
      excludedPartId ?? null,
    ])

  if (existing) {
    throw new Error(
      'Ya existe un repuesto con ese código SAP.',
    )
  }
}

export async function createPart(
  data: {
    name: string
    sapCode?: string
    oemCode?: string
    notes?: string
  },
) {
  const db = await initDatabase()
  const name =
    requiredText(data.name, 'El nombre')
  const sapCode =
    nullableText(data.sapCode)

  await assertSapAvailable(sapCode)

  db.run(`
    INSERT INTO parts (
      name,
      sap_code,
      oem_code,
      notes,
      status,
      verification_status,
      (
        SELECT COUNT(*)
        FROM part_compatibilities pc
        WHERE pc.part_id = parts.id
      ) AS compatibility_count
    )
    VALUES (?, ?, ?, ?, 'active', 'pending')
  `, [
    name,
    sapCode,
    nullableText(data.oemCode),
    nullableText(data.notes),
  ])

  const id = Number(
    db.exec(
      'SELECT last_insert_rowid()',
    )[0]?.values[0]?.[0],
  )

  await persistDatabase()

  const created = await getPart(id)

  if (!created) {
    throw new Error(
      'No se pudo crear el repuesto.',
    )
  }

  return created
}

export async function updatePart(
  id: number,
  data: {
    name: string
    sapCode?: string
    oemCode?: string
    notes?: string
  },
) {
  const db = await initDatabase()
  const name =
    requiredText(data.name, 'El nombre')
  const sapCode =
    nullableText(data.sapCode)

  await assertSapAvailable(
    sapCode,
    id,
  )

  db.run(`
    UPDATE parts
    SET
      name = ?,
      sap_code = ?,
      oem_code = ?,
      notes = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    name,
    sapCode,
    nullableText(data.oemCode),
    nullableText(data.notes),
    id,
  ])

  if (db.getRowsModified() === 0) {
    throw new Error(
      'Repuesto no encontrado.',
    )
  }

  await persistDatabase()

  return getPart(id)
}

async function setPartActiveStatus(
  id: number,
  status: 'active' | 'inactive',
) {
  const db = await initDatabase()

  db.run(`
    UPDATE parts
    SET
      status = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [status, id])

  if (db.getRowsModified() === 0) {
    throw new Error(
      'Repuesto no encontrado.',
    )
  }

  await persistDatabase()

  return getPart(id)
}

export function archivePart(id: number) {
  return setPartActiveStatus(
    id,
    'inactive',
  )
}

export function restorePart(id: number) {
  return setPartActiveStatus(
    id,
    'active',
  )
}

export async function getPartDependencyCounts(
  partId: number,
) {
  const result =
    await queryOne<{
      compatibilityCount: number
      suggestionCount: number
    }>(`
      SELECT
        (
          SELECT COUNT(*)
          FROM part_compatibilities
          WHERE part_id = ?
        ) AS compatibilityCount,
        (
          SELECT COUNT(*)
          FROM compatibility_suggestions
          WHERE part_id = ?
        ) AS suggestionCount
    `, [partId, partId])

  return {
    compatibilityCount:
      Number(result?.compatibilityCount) || 0,
    suggestionCount:
      Number(result?.suggestionCount) || 0,
  } satisfies PartDependencyCounts
}

export async function createFamily(
  code: string,
  name: string,
  notes?: string,
) {
  const db =
    await initDatabase()

  const normalized =
    requiredText(
      code,
      'El código',
    ).toUpperCase()

  const normalizedName =
    requiredText(
      name,
      'El nombre',
    )

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
      notes,
      status
    )

    VALUES (
      ?,
      ?,
      ?,
      'active'
    )
  `, [
    normalized,
    normalizedName,
    nullableText(notes),
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

  return created
}

export async function updateFamily(
  id: number,
  data: {
    code: string
    name: string
    notes?: string
  },
) {
  const db = await initDatabase()
  const code =
    requiredText(
      data.code,
      'El código',
    ).toUpperCase()
  const name =
    requiredText(
      data.name,
      'El nombre',
    )

  const existing =
    await queryOne<{ id: number }>(`
      SELECT id
      FROM families
      WHERE
        UPPER(code) = UPPER(?)
        AND id <> ?
      LIMIT 1
    `, [code, id])

  if (existing) {
    throw new Error(
      'Ya existe una familia con ese código.',
    )
  }

  db.run(`
    UPDATE families
    SET
      code = ?,
      name = ?,
      notes = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    code,
    name,
    nullableText(data.notes),
    id,
  ])

  if (db.getRowsModified() === 0) {
    throw new Error(
      'Familia no encontrada.',
    )
  }

  await persistDatabase()

  return queryOne<ApiFamily>(`
    SELECT id, code, name, status, notes
    FROM families
    WHERE id = ?
  `, [id])
}

async function setFamilyActiveStatus(
  id: number,
  status: 'active' | 'inactive',
) {
  const db = await initDatabase()

  db.run(`
    UPDATE families
    SET
      status = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [status, id])

  if (db.getRowsModified() === 0) {
    throw new Error(
      'Familia no encontrada.',
    )
  }

  await persistDatabase()
}

export function archiveFamily(id: number) {
  return setFamilyActiveStatus(
    id,
    'inactive',
  )
}

export function restoreFamily(id: number) {
  return setFamilyActiveStatus(
    id,
    'active',
  )
}

export async function getFamilyDependencyCounts(
  familyId: number,
) {
  const result =
    await queryOne<{
      modelCount: number
      compatibilityCount: number
    }>(`
      SELECT
        (
          SELECT COUNT(*)
          FROM models
          WHERE family_id = ?
        ) AS modelCount,
        (
          SELECT COUNT(*)
          FROM part_compatibilities pc
          JOIN models m
            ON m.id = pc.model_id
          WHERE m.family_id = ?
        ) AS compatibilityCount
    `, [familyId, familyId])

  return {
    modelCount:
      Number(result?.modelCount) || 0,
    compatibilityCount:
      Number(result?.compatibilityCount) || 0,
  } satisfies FamilyDependencyCounts
}

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

  const brand =
    requiredText(
      data.brand,
      'La marca',
    )
  const name =
    requiredText(
      data.name,
      'El modelo',
    )

  const family =
    await queryOne<{ id: number }>(`
      SELECT id
      FROM families
      WHERE id = ? AND status = 'active'
    `, [data.familyId])

  if (!family) {
    throw new Error(
      'Selecciona una familia activa.',
    )
  }

  await assertModelAvailable({
    familyId: data.familyId,
    brand,
    name,
    variant,
  })

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
    brand,
    name,
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

async function assertModelAvailable(
  data: {
    familyId: number
    brand: string
    name: string
    variant: string | null
    excludedId?: number
  },
) {
  const existing =
    await queryOne<{ id: number }>(`
      SELECT id
      FROM models
      WHERE
        family_id = ?
        AND UPPER(TRIM(COALESCE(brand, ''))) =
          UPPER(TRIM(?))
        AND UPPER(TRIM(name)) =
          UPPER(TRIM(?))
        AND UPPER(TRIM(COALESCE(variant, ''))) =
          UPPER(TRIM(COALESCE(?, '')))
        AND (? IS NULL OR id <> ?)
      LIMIT 1
    `, [
      data.familyId,
      data.brand,
      data.name,
      data.variant,
      data.excludedId ?? null,
      data.excludedId ?? null,
    ])

  if (existing) {
    throw new Error(
      'Ya existe ese modelo en la familia seleccionada.',
    )
  }
}

export async function updateModel(
  id: number,
  data: {
    familyId: number
    brand: string
    name: string
    variant?: string
  },
) {
  const db = await initDatabase()
  const brand =
    requiredText(
      data.brand,
      'La marca',
    )
  const name =
    requiredText(
      data.name,
      'El modelo',
    )
  const variant =
    nullableText(data.variant)

  const family =
    await queryOne<{ id: number }>(`
      SELECT id
      FROM families
      WHERE id = ? AND status = 'active'
    `, [data.familyId])

  if (!family) {
    throw new Error(
      'Selecciona una familia activa.',
    )
  }

  await assertModelAvailable({
    familyId: data.familyId,
    brand,
    name,
    variant,
    excludedId: id,
  })

  db.run(`
    UPDATE models
    SET
      family_id = ?,
      brand = ?,
      name = ?,
      variant = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    data.familyId,
    brand,
    name,
    variant,
    id,
  ])

  if (db.getRowsModified() === 0) {
    throw new Error(
      'Modelo no encontrado.',
    )
  }

  await persistDatabase()
}

async function setModelActiveStatus(
  id: number,
  status: 'active' | 'inactive',
) {
  const db = await initDatabase()

  db.run(`
    UPDATE models
    SET
      status = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [status, id])

  if (db.getRowsModified() === 0) {
    throw new Error(
      'Modelo no encontrado.',
    )
  }

  await persistDatabase()
}

export function archiveModel(id: number) {
  return setModelActiveStatus(
    id,
    'inactive',
  )
}

export function restoreModel(id: number) {
  return setModelActiveStatus(
    id,
    'active',
  )
}

export async function getModelDependencyCounts(
  modelId: number,
) {
  const result =
    await queryOne<{
      compatibilityCount: number
    }>(`
      SELECT COUNT(*) AS compatibilityCount
      FROM part_compatibilities
      WHERE model_id = ?
    `, [modelId])

  return {
    compatibilityCount:
      Number(result?.compatibilityCount) || 0,
  } satisfies ModelDependencyCounts
}
