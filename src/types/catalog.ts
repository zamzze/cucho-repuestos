export interface Familia {
  id: string
  codigo: string
  nombre: string
  estado: 'ACTIVO' | 'DESUSO'
}

export interface Modelo {
  id: string
  familiaId: string
  familiaCodigo: string
  familia: string
  marca: string
  modelo: string
  motorVersion?: string
  descripcionAdicional?: string
  estado: 'ACTIVO' | 'DESUSO'
}

export interface Repuesto {
  id: string
  codigoSap?: string
  codigoPnOem?: string
  descripcion: string
  observacion?: string
  estado: 'ACTIVO' | 'INACTIVO'
}

export interface Compatibilidad {
  id: string
  repuestoId: string
  modeloId: string
}

export interface Metadata {
  key: string
  value: string
}