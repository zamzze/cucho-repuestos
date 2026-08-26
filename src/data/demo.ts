import type {
  Familia,
  Modelo,
  Repuesto,
  Compatibilidad,
} from '../types/catalog'

export const familias: Familia[] = [
  {
    id: 'F001',
    codigo: 'AA',
    nombre: 'Aire acondicionado',
    estado: 'ACTIVO',
  },
  {
    id: 'F002',
    codigo: 'APD',
    nombre: 'Ambulift',
    estado: 'DESUSO',
  },
  {
    id: 'F003',
    codigo: 'AS',
    nombre: 'Aspiradora',
    estado: 'ACTIVO',
  },
  {
    id: 'F004',
    codigo: 'CA',
    nombre: 'Carro de agua',
    estado: 'ACTIVO',
  },
  {
    id: 'F005',
    codigo: 'CB',
    nombre: 'Carro de baño',
    estado: 'ACTIVO',
  },
  {
    id: 'F006',
    codigo: 'CM',
    nombre: 'Camioneta de mantenimiento',
    estado: 'ACTIVO',
  },
  {
    id: 'F007',
    codigo: 'EM',
    nombre: 'Escalera motorizada',
    estado: 'ACTIVO',
  },
  {
    id: 'F008',
    codigo: 'EN',
    nombre: 'Escalera no motorizada',
    estado: 'ACTIVO',
  },
  {
    id: 'F009',
    codigo: 'FT',
    nombre: 'Faja transportadora',
    estado: 'ACTIVO',
  },
  {
    id: 'F013',
    codigo: 'PM',
    nombre: 'Paymover',
    estado: 'ACTIVO',
  },
  {
    id: 'F014',
    codigo: 'QU',
    nombre: 'Quantum',
    estado: 'ACTIVO',
  },
  {
    id: 'F015',
    codigo: 'TLL',
    nombre: 'Taller',
    estado: 'ACTIVO',
  },
  {
    id: 'F016',
    codigo: 'TR',
    nombre: 'Tractor',
    estado: 'ACTIVO',
  },
]

export const modelos: Modelo[] = [
  {
    id: 'M0001',
    familiaId: 'F016',
    familiaCodigo: 'TR',
    familia: 'Tractor',
    marca: 'TLD',
    modelo: 'JST25',
    estado: 'ACTIVO',
  },
  {
    id: 'M0002',
    familiaId: 'F016',
    familiaCodigo: 'TR',
    familia: 'Tractor',
    marca: 'TUG',
    modelo: 'MA50 CONVENCIONAL',
    estado: 'ACTIVO',
  },
  {
    id: 'M0003',
    familiaId: 'F016',
    familiaCodigo: 'TR',
    familia: 'Tractor',
    marca: 'TUG',
    modelo: 'MA50 ELECTRONICO',
    estado: 'ACTIVO',
  },
  {
    id: 'M0004',
    familiaId: 'F016',
    familiaCodigo: 'TR',
    familia: 'Tractor',
    marca: 'WOLLARD',
    modelo: 'M100',
    descripcionAdicional: 'DIESEL',
    estado: 'ACTIVO',
  },

  {
    id: 'M0005',
    familiaId: 'F009',
    familiaCodigo: 'FT',
    familia: 'Faja transportadora',
    marca: 'TLD',
    modelo: 'NBL GLP',
    estado: 'ACTIVO',
  },
  {
    id: 'M0006',
    familiaId: 'F009',
    familiaCodigo: 'FT',
    familia: 'Faja transportadora',
    marca: 'TLD',
    modelo: 'NBL DIESEL',
    estado: 'ACTIVO',
  },

  {
    id: 'M0007',
    familiaId: 'F001',
    familiaCodigo: 'AA',
    familia: 'Aire acondicionado',
    marca: 'TLD',
    modelo: 'ACU302',
    estado: 'ACTIVO',
  },
  {
    id: 'M0008',
    familiaId: 'F001',
    familiaCodigo: 'AA',
    familia: 'Aire acondicionado',
    marca: 'TLD',
    modelo: 'ACU804',
    estado: 'ACTIVO',
  },

  {
    id: 'M0009',
    familiaId: 'F003',
    familiaCodigo: 'AS',
    familia: 'Aspiradora',
    marca: 'MAKITA',
    modelo: 'DVC660',
    estado: 'ACTIVO',
  },

  {
    id: 'M0010',
    familiaId: 'F004',
    familiaCodigo: 'CA',
    familia: 'Carro de agua',
    marca: 'TLD',
    modelo: 'WSP900',
    estado: 'ACTIVO',
  },

  {
    id: 'M0011',
    familiaId: 'F005',
    familiaCodigo: 'CB',
    familia: 'Carro de baño',
    marca: 'TLD',
    modelo: 'LSP900',
    estado: 'ACTIVO',
  },

  {
    id: 'M0012',
    familiaId: 'F002',
    familiaCodigo: 'APD',
    familia: 'Ambulift',
    marca: 'LIFT-A-LOFT',
    modelo: 'APX16',
    estado: 'DESUSO',
  },

  {
    id: 'M0013',
    familiaId: 'F006',
    familiaCodigo: 'CM',
    familia: 'Camioneta de mantenimiento',
    marca: 'CHANGAN',
    modelo: 'NEW VAN',
    estado: 'ACTIVO',
  },
  {
    id: 'M0014',
    familiaId: 'F006',
    familiaCodigo: 'CM',
    familia: 'Camioneta de mantenimiento',
    marca: 'CHEVROLET',
    modelo: 'N300',
    estado: 'ACTIVO',
  },

  {
    id: 'M0015',
    familiaId: 'F007',
    familiaCodigo: 'EM',
    familia: 'Escalera motorizada',
    marca: 'TLD',
    modelo: 'ABS580',
    estado: 'ACTIVO',
  },
  {
    id: 'M0016',
    familiaId: 'F007',
    familiaCodigo: 'EM',
    familia: 'Escalera motorizada',
    marca: 'TLD',
    modelo: 'ABS580-E',
    descripcionAdicional: 'HIBRIDO',
    estado: 'ACTIVO',
  },

  {
    id: 'M0017',
    familiaId: 'F008',
    familiaCodigo: 'EN',
    familia: 'Escalera no motorizada',
    marca: 'CLYDE',
    modelo: 'CLYDE',
    estado: 'ACTIVO',
  },
  {
    id: 'M0018',
    familiaId: 'F008',
    familiaCodigo: 'EN',
    familia: 'Escalera no motorizada',
    marca: 'METALLICAS',
    modelo: 'A320 B737',
    estado: 'ACTIVO',
  },

  {
    id: 'M0019',
    familiaId: 'F013',
    familiaCodigo: 'PM',
    familia: 'Paymover',
    marca: 'FMC',
    modelo: 'B1200',
    estado: 'ACTIVO',
  },
  {
    id: 'M0020',
    familiaId: 'F013',
    familiaCodigo: 'PM',
    familia: 'Paymover',
    marca: 'JBT',
    modelo: 'B250',
    estado: 'ACTIVO',
  },
  {
    id: 'M0021',
    familiaId: 'F013',
    familiaCodigo: 'PM',
    familia: 'Paymover',
    marca: 'TLD',
    modelo: 'TMX150',
    estado: 'ACTIVO',
  },
  {
    id: 'M0022',
    familiaId: 'F013',
    familiaCodigo: 'PM',
    familia: 'Paymover',
    marca: 'TLD',
    modelo: 'TMX450',
    estado: 'ACTIVO',
  },

  {
    id: 'M0023',
    familiaId: 'F014',
    familiaCodigo: 'QU',
    familia: 'Quantum',
    marca: 'GPS',
    modelo: 'QUANTUM',
    estado: 'ACTIVO',
  },

  {
    id: 'M0024',
    familiaId: 'F015',
    familiaCodigo: 'TLL',
    familia: 'Taller',
    marca: 'INSUMOS',
    modelo: 'TALLER',
    estado: 'ACTIVO',
  },
]

//
// DATA TEMPORAL
// Después será reemplazada por el catálogo generado desde Excel.
//
export const repuestos: Repuesto[] = [
  {
    id: 'R0001',
    codigoSap: '1035466',
    descripcion: 'BATERIA SU-1217 PRO LM (ETNA)',
    estado: 'ACTIVO',
  },
  {
    id: 'R0002',
    codigoSap: '1015258',
    descripcion: 'STARTER DENSO TYPE OSGR 12V',
    estado: 'ACTIVO',
  },
  {
    id: 'R0003',
    codigoSap: '1029740',
    descripcion: 'ALTERNADOR PERKINS',
    estado: 'ACTIVO',
  },
  {
    id: 'R0004',
    codigoSap: '1001502',
    descripcion: 'FUSIBLE TERMICO 20 AMP',
    estado: 'ACTIVO',
  },
]

export const compatibilidades: Compatibilidad[] = [
  {
    id: 'C0001',
    repuestoId: 'R0001',
    modeloId: 'M0013',
  },
  {
    id: 'C0002',
    repuestoId: 'R0002',
    modeloId: 'M0002',
  },
  {
    id: 'C0003',
    repuestoId: 'R0002',
    modeloId: 'M0003',
  },
  {
    id: 'C0004',
    repuestoId: 'R0003',
    modeloId: 'M0005',
  },
  {
    id: 'C0005',
    repuestoId: 'R0004',
    modeloId: 'M0015',
  },
]