import { db } from './database'

import {
  familias,
  modelos,
  repuestos,
  compatibilidades,
} from '../data/demo'

const CATALOG_VERSION = '0.1.0-demo'

export async function seedDatabase() {
  const currentVersion = await db.metadata.get('catalogVersion')

  if (currentVersion?.value === CATALOG_VERSION) {
    return
  }

  await db.transaction(
    'rw',
    [
      db.familias,
      db.modelos,
      db.repuestos,
      db.compatibilidades,
      db.metadata,
    ],
    async () => {
      await db.familias.clear()
      await db.modelos.clear()
      await db.repuestos.clear()
      await db.compatibilidades.clear()

      await db.familias.bulkPut(familias)
      await db.modelos.bulkPut(modelos)
      await db.repuestos.bulkPut(repuestos)
      await db.compatibilidades.bulkPut(compatibilidades)

      await db.metadata.put({
        key: 'catalogVersion',
        value: CATALOG_VERSION,
      })

      await db.metadata.put({
        key: 'generatedAt',
        value: new Date().toISOString(),
      })
    },
  )
}