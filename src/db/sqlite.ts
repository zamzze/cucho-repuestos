import initSqlJs, {
  type Database,
  type SqlJsStatic,
} from 'sql.js'

import {
  clearLocalDatabase,
  getLocalDatabase,
  saveLocalDatabase,
} from './localStore'

interface CatalogVersion {
  version: string
  updatedAt: string
}

export interface LocalDatabaseVersionConflict {
  localVersion: string
  officialVersion: string
  localUpdatedAt: string
}

export class LocalDatabaseVersionConflictError extends Error {
  conflict: LocalDatabaseVersionConflict

  constructor(conflict: LocalDatabaseVersionConflict) {
    super(
      'Existe una base local con cambios pendientes de una versión anterior.',
    )
    this.name = 'LocalDatabaseVersionConflictError'
    this.conflict = conflict
  }
}

let SQL:
  | SqlJsStatic
  | null = null

let database:
  | Database
  | null = null

let currentVersion =
  'unknown'

async function getSqlJs() {
  if (SQL) {
    return SQL
  }

  SQL = await initSqlJs({
    locateFile: () =>
      '/sql-wasm.wasm',
  })

  return SQL
}

async function getOfficialVersion():
  Promise<CatalogVersion> {
  const response =
    await fetch(
      '/data/catalog-version.json',
      {
        cache: 'no-store',
      },
    )

  if (!response.ok) {
    throw new Error(
      'No se pudo consultar la versión del catálogo.',
    )
  }

  return response.json()
}

async function downloadOfficialDatabase() {
  const response =
    await fetch(
      '/data/mpc.db',
      {
        cache: 'no-store',
      },
    )

  if (!response.ok) {
    throw new Error(
      `No se pudo cargar mpc.db (${response.status})`,
    )
  }

  return new Uint8Array(
    await response.arrayBuffer(),
  )
}

export async function getLocalDatabaseVersionConflict():
  Promise<LocalDatabaseVersionConflict | null> {
  const [official, local] =
    await Promise.all([
      getOfficialVersion(),
      getLocalDatabase(),
    ])

  if (
    !local ||
    !local.dirty ||
    local.catalogVersion === official.version
  ) {
    return null
  }

  return {
    localVersion: local.catalogVersion,
    officialVersion: official.version,
    localUpdatedAt: local.updatedAt,
  }
}

export async function getLocalDatabaseBackup() {
  const local = await getLocalDatabase()

  if (!local) {
    throw new Error(
      'No existe una base local para respaldar.',
    )
  }

  return {
    data: new Uint8Array(local.data),
    catalogVersion: local.catalogVersion,
  }
}

function validateDatabase(
  db: Database,
) {
  const result =
    db.exec(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
    `)

  const names =
    result[0]?.values.map(
      (row) =>
        String(row[0]),
    ) ?? []

  const required = [
    'families',
    'models',
    'parts',
    'part_compatibilities',
    'compatibility_suggestions',
  ]

  const missing =
    required.filter(
      (table) =>
        !names.includes(table),
    )

  if (missing.length > 0) {
    throw new Error(
      `SQLite inválido. Faltan tablas: ${missing.join(', ')}`,
    )
  }

  const integrity =
    db.exec(
      'PRAGMA quick_check;',
    )

  const resultValue =
    String(
      integrity[0]
        ?.values[0]?.[0] ??
        '',
    )

  if (resultValue !== 'ok') {
    throw new Error(
      `SQLite no pasó quick_check: ${resultValue}`,
    )
  }
}

export async function initDatabase() {
  if (database) {
    return database
  }

  const sql =
    await getSqlJs()

  const official =
    await getOfficialVersion()

  currentVersion =
    official.version

  const local =
    await getLocalDatabase()

  if (
    local?.dirty &&
    local.catalogVersion !==
      official.version
  ) {
    throw new LocalDatabaseVersionConflictError({
      localVersion:
        local.catalogVersion,
      officialVersion:
        official.version,
      localUpdatedAt:
        local.updatedAt,
    })
  }

  let data: Uint8Array

  /*
    CASO 1:
    no existe BD local.
  */
  if (!local) {
    data =
      await downloadOfficialDatabase()

    await saveLocalDatabase(
      data,
      {
        catalogVersion:
          official.version,

        dirty: false,
      },
    )
  }

  /*
    CASO 2:
    existe trabajo pendiente.

    Nunca lo reemplazamos
    automáticamente.
  */
  else if (local.dirty) {
    data =
      new Uint8Array(
        local.data,
      )

    currentVersion =
      local.catalogVersion
  }

  /*
    CASO 3:
    copia local limpia pero
    existe una versión publicada
    más nueva.
  */
  else if (
    local.catalogVersion !==
    official.version
  ) {
    data =
      await downloadOfficialDatabase()

    await saveLocalDatabase(
      data,
      {
        catalogVersion:
          official.version,

        dirty: false,
      },
    )
  }

  /*
    CASO 4:
    copia actual y limpia.
  */
  else {
    data =
      new Uint8Array(
        local.data,
      )
  }

  database =
    new sql.Database(data)

  database.run(
    'PRAGMA foreign_keys = ON;',
  )

  validateDatabase(database)

  return database
}

export async function persistDatabase() {
  const db =
    await initDatabase()

  validateDatabase(db)

  const data =
    db.export()

  await saveLocalDatabase(
    data,
    {
      catalogVersion:
        currentVersion,

      dirty: true,
    },
  )
}

export async function exportDatabase() {
  const db =
    await initDatabase()

  validateDatabase(db)

  return db.export()
}

export async function hasUnsavedChanges() {
  const local =
    await getLocalDatabase()

  return Boolean(
    local?.dirty,
  )
}

export async function getWorkingVersion() {
  const [local, official] =
    await Promise.all([
      getLocalDatabase(),
      getOfficialVersion(),
    ])

  if (!local || !local.dirty) {
    return official.version
  }

  return local.catalogVersion
}

/*
  Importa manualmente un SQLite.

  Útil si tu hermano descarga una BD
  y luego quiere continuar trabajando
  desde otro celular/PC.
*/
export async function importDatabase(
  file: File,
) {
  const sql =
    await getSqlJs()

  const data =
    new Uint8Array(
      await file.arrayBuffer(),
    )

  const candidate =
    new sql.Database(data)

  candidate.run(
    'PRAGMA foreign_keys = ON;',
  )

  validateDatabase(candidate)

  candidate.close()

  database?.close()
  database = null

  const official =
    await getOfficialVersion()

  currentVersion =
    official.version

  await saveLocalDatabase(
    data,
    {
      catalogVersion:
        official.version,

      /*
        El archivo importado se
        considera trabajo pendiente.
      */
      dirty: true,
    },
  )

  return initDatabase()
}

/*
  DESCARTAR trabajo local y volver
  exactamente al SQLite publicado.
*/
export async function resetToOfficialDatabase() {
  database?.close()
  database = null

  await clearLocalDatabase()

  return initDatabase()
}

export async function discardLocalDatabaseAndUseOfficial() {
  database?.close()
  database = null

  await clearLocalDatabase()

  return initDatabase()
}

export function closeDatabase() {
  database?.close()
  database = null
}
