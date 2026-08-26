import Dexie, { type EntityTable } from 'dexie'

import type {
  Familia,
  Modelo,
  Repuesto,
  Compatibilidad,
  Metadata,
} from '../types/catalog'

const db = new Dexie('MPCRepuestosDB') as Dexie & {
  familias: EntityTable<Familia, 'id'>
  modelos: EntityTable<Modelo, 'id'>
  repuestos: EntityTable<Repuesto, 'id'>
  compatibilidades: EntityTable<Compatibilidad, 'id'>
  metadata: EntityTable<Metadata, 'key'>
}

db.version(1).stores({
  familias: 'id, codigo, nombre',
  modelos: 'id, familiaId, familiaCodigo, marca, modelo',
  repuestos: 'id, codigoSap, codigoPnOem, descripcion',
  compatibilidades: 'id, repuestoId, modeloId',
  metadata: 'key',
})

export { db }