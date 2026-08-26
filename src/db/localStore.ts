import Dexie, {
  type EntityTable,
} from 'dexie'

export interface LocalDatabaseFile {
  key: string
  data: ArrayBuffer

  updatedAt: string

  /*
    Versión de la BD oficial
    desde la que nació esta copia.
  */
  catalogVersion: string

  /*
    true = este dispositivo realizó
    cambios todavía no publicados.
  */
  dirty: boolean
}

const storage = new Dexie(
  'MPCBrowserStorage',
) as Dexie & {
  files: EntityTable<
    LocalDatabaseFile,
    'key'
  >
}

storage.version(1).stores({
  files: 'key',
})

storage.version(2).stores({
  files: 'key',
})

const DATABASE_KEY =
  'mpc-working-database'

function cloneBuffer(
  data: Uint8Array,
) {
  const copy =
    new Uint8Array(data.length)

  copy.set(data)

  return copy.buffer
}

export async function saveLocalDatabase(
  data: Uint8Array,
  options: {
    catalogVersion: string
    dirty: boolean
  },
) {
  await storage.files.put({
    key: DATABASE_KEY,

    data: cloneBuffer(data),

    updatedAt:
      new Date().toISOString(),

    catalogVersion:
      options.catalogVersion,

    dirty: options.dirty,
  })
}

export async function getLocalDatabase() {
  return (
    await storage.files.get(
      DATABASE_KEY,
    )
  ) ?? null
}

export async function clearLocalDatabase() {
  await storage.files.delete(
    DATABASE_KEY,
  )
}

export async function hasLocalDatabase() {
  return Boolean(
    await storage.files.get(
      DATABASE_KEY,
    ),
  )
}