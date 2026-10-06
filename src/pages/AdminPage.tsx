import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Database,
  Download,
  LayoutDashboard,
  Layers3,
  PackagePlus,
  PackageSearch,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Undo2,
  Upload,
  Wrench,
  X,
} from 'lucide-react'
import {
  addCompatibility,
  archiveFamily,
  archiveModel,
  archivePart,
  createFamily,
  createModel,
  createPart,
  deleteCompatibility,
  getFamilies,
  getCatalogStats,
  getFamilyDependencyCounts,
  getModelDependencyCounts,
  getModels,
  getPart,
  getPartCompatibilities,
  getPartDependencyCounts,
  getPartStats,
  getParts,
  restoreFamily,
  restoreModel,
  restorePart,
  updateFamily,
  updateModel,
  updatePart,
  updatePartVerification,
  type ApiCompatibility,
  type ApiCatalogStats,
  type ApiFamily,
  type ApiModel,
  type ApiPart,
  type ApiPartStats,
} from '../db/repository'
import {
  getWorkingVersion,
  hasUnsavedChanges,
  importDatabase,
  resetToOfficialDatabase,
} from '../db/sqlite'
import { downloadDatabase } from '../utils/downloadDatabase'

type Section = 'summary' | 'parts' | 'families' | 'models'
type Filter = 'all' | 'pending' | 'review' | 'verified'
type PartInput = {
  name: string
  sapCode: string
  oemCode: string
  notes: string
}
type ModelInput = {
  familyId: number
  brand: string
  name: string
  variant: string
}

const emptyPart: PartInput = {
  name: '',
  sapCode: '',
  oemCode: '',
  notes: '',
}
const emptySession = {
  verified: 0,
  compatibilitiesAdded: 0,
  compatibilitiesRemoved: 0,
  partsCreated: 0,
}
const messageOf = (value: unknown) =>
  value instanceof Error
    ? value.message
    : 'Ocurrió un error inesperado.'

export default function AdminPage() {
  const [section, setSection] = useState<Section>('summary')
  const [parts, setParts] = useState<ApiPart[]>([])
  const [queue, setQueue] = useState<ApiPart[]>([])
  const [stats, setStats] = useState<ApiPartStats | null>(null)
  const [catalogStats, setCatalogStats] =
    useState<ApiCatalogStats | null>(null)
  const [families, setFamilies] = useState<ApiFamily[]>([])
  const [models, setModels] = useState<ApiModel[]>([])
  const [selected, setSelected] = useState<ApiPart | null>(null)
  const [compatibilities, setCompatibilities] =
    useState<ApiCompatibility[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [version, setVersion] = useState('unknown')
  const [session, setSession] = useState(emptySession)
  const [dialog, setDialog] = useState<
    'new-part' | 'compatibility' | null
  >(null)
  const [editingFamily, setEditingFamily] =
    useState<ApiFamily | null>(null)
  const [editingModel, setEditingModel] =
    useState<ApiModel | null>(null)
  const [partDraft, setPartDraft] =
    useState<PartInput>(emptyPart)
  const fileRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    const [partData, queueData, statData, catalogStatData, familyData, modelData, isDirty, catalogVersion] =
      await Promise.all([
        getParts({
          q: search.trim() || undefined,
          verification: filter === 'all' ? undefined : filter,
          includeInactive: showArchived,
        }),
        getParts(),
        getPartStats(),
        getCatalogStats(),
        getFamilies({ includeInactive: true }),
        getModels(undefined, { includeInactive: true }),
        hasUnsavedChanges(),
        getWorkingVersion(),
      ])
    setParts(partData)
    setQueue(queueData)
    setStats(statData)
    setCatalogStats(catalogStatData)
    setFamilies(familyData)
    setModels(modelData)
    setDirty(isDirty)
    setVersion(catalogVersion)
  }, [filter, search, showArchived])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true)
      void refresh()
        .catch((caught) => setError(messageOf(caught)))
        .finally(() => setLoading(false))
    }, 180)
    return () => window.clearTimeout(timer)
  }, [refresh])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  const openPart = useCallback(async (id: number) => {
    setLoading(true)
    setError(null)
    try {
      const [part, relationData] = await Promise.all([
        getPart(id),
        getPartCompatibilities(id, { includeInactive: true }),
      ])
      if (!part) throw new Error('Componente no encontrado.')
      setSelected(part)
      setCompatibilities(relationData)
      setPartDraft({
        name: part.name,
        sapCode: part.sap_code ?? '',
        oemCode: part.oem_code ?? '',
        notes: part.notes ?? '',
      })
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setLoading(false)
    }
  }, [])

  async function mutate(action: () => Promise<unknown>, success: string) {
    setSaving(true)
    setError(null)
    try {
      await action()
      await refresh()
      setToast(success)
      return true
    } catch (caught) {
      setError(messageOf(caught))
      return false
    } finally {
      setSaving(false)
    }
  }

  const activeFamilies = useMemo(
    () => families.filter((item) => item.status === 'active'),
    [families],
  )
  const activeModels = useMemo(
    () => models.filter((item) =>
      item.status === 'active' &&
      activeFamilies.some((family) => family.id === item.family_id),
    ),
    [activeFamilies, models],
  )

  async function refreshDetail() {
    if (selected) await openPart(selected.id)
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !window.confirm(
      '¿Cargar esta base SQLite? La copia local actual será reemplazada.',
    )) return
    setLoading(true)
    try {
      await importDatabase(file)
      setSelected(null)
      await refresh()
      setToast('Base SQLite cargada')
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setLoading(false)
    }
  }

  async function handleReset() {
    if (!window.confirm(
      '¿Restaurar la base oficial? Se descartarán los cambios locales.',
    )) return
    setLoading(true)
    try {
      await resetToOfficialDatabase()
      setSelected(null)
      await refresh()
      setToast('Base oficial restaurada')
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setLoading(false)
    }
  }

  if (selected) {
    const queueIndex = queue.findIndex((item) => item.id === selected.id)
    const previous = queueIndex > 0 ? queue[queueIndex - 1] : null
    const next = queueIndex >= 0 ? queue[queueIndex + 1] ?? null : null

    async function setVerification(
      status: 'pending' | 'review' | 'verified',
    ) {
      const wasVerified = selected!.verification_status === 'verified'
      const ok = await mutate(
        () => updatePartVerification(selected!.id, status),
        'Estado actualizado',
      )
      if (ok && status === 'verified' && !wasVerified) {
        setSession((current) => ({
          ...current,
          verified: current.verified + 1,
        }))
      }
      if (ok) await refreshDetail()
    }

    async function verifyAndNext() {
      if (
        compatibilities.length === 0 &&
        !window.confirm(
          'Este componente no tiene modelos compatibles. ¿Confirmas que debe quedar verificado sin compatibilidades?',
        )
      ) return
      const wasVerified = selected!.verification_status === 'verified'
      const ok = await mutate(
        () => updatePartVerification(selected!.id, 'verified'),
        'Componente verificado',
      )
      if (!ok) return
      if (!wasVerified) {
        setSession((current) => ({
          ...current,
          verified: current.verified + 1,
        }))
      }
      const updatedQueue = await getParts()
      setQueue(updatedQueue)
      const following =
        updatedQueue.find((item) =>
          item.id !== selected!.id &&
          item.verification_status === 'pending',
        ) ??
        updatedQueue.find((item) =>
          item.id !== selected!.id &&
          item.verification_status === 'review',
        )
      if (following) await openPart(following.id)
      else {
        setToast(
          'Todos los componentes pendientes/revisión han sido procesados.',
        )
        await refreshDetail()
      }
    }

    return (
      <main className="admin-app">
        <header className="detail-header">
          <button
            type="button"
            className="back-button"
            aria-label="Volver a componentes"
            onClick={() => setSelected(null)}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <span className="admin-brand">MPC ADMIN</span>
            <h1>Detalle del componente</h1>
          </div>
          <StatusBadge status={selected.verification_status} />
        </header>
        <Messages
          error={error}
          toast={toast}
          onClear={() => setError(null)}
        />
        <section
          className={
            selected.status === 'active'
              ? 'part-detail-hero'
              : 'part-detail-hero archived'
          }
        >
          <span className="eyebrow">
            {selected.status === 'active' ? 'REPUESTO' : 'ARCHIVADO'}
          </span>
          <h2>{selected.name}</h2>
          <div className="detail-codes">
            <strong>SAP {selected.sap_code || '—'}</strong>
            {selected.oem_code && <span>PN/OEM {selected.oem_code}</span>}
            {selected.sap_code && (
              <button
                type="button"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(selected.sap_code!)
                    .then(() => setToast('SAP copiado'))
                }
              >
                <Copy size={17} /> Copiar SAP
              </button>
            )}
          </div>
        </section>
        <div className="queue-navigation">
          <button
            type="button"
            disabled={!previous || loading}
            onClick={() => previous && void openPart(previous.id)}
          >
            <ArrowLeft size={18} /> Anterior
          </button>
          <button
            type="button"
            disabled={!next || loading}
            onClick={() => next && void openPart(next.id)}
          >
            Siguiente <ArrowRight size={18} />
          </button>
        </div>
        <section className="verification-content">
          <Card title="Editar componente" eyebrow="DATOS PRINCIPALES">
            <PartForm
              value={partDraft}
              onChange={setPartDraft}
              saving={saving}
              label="Guardar cambios"
              onSubmit={async () => {
                const ok = await mutate(
                  () => updatePart(selected.id, partDraft),
                  'Componente actualizado',
                )
                if (ok) await refreshDetail()
              }}
            />
          </Card>

          <Card
            title={`${compatibilities.length} modelos compatibles`}
            eyebrow="COMPATIBILIDAD"
            action={
              <button
                type="button"
                className="primary-small"
                disabled={selected.status !== 'active'}
                onClick={() => setDialog('compatibility')}
              >
                <Plus size={17} /> Añadir
              </button>
            }
          >
            <div className="compatibility-list">
              {compatibilities.map((relation) => (
                <div className="compatibility-row" key={relation.id}>
                  <span className="family-pill">
                    {relation.family_code}
                  </span>
                  <div>
                    <strong>
                      {relation.brand} {relation.model_name}
                    </strong>
                    <small>
                      {relation.family_name}
                      {relation.variant ? ` · ${relation.variant}` : ''}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="delete-button"
                    aria-label={`Eliminar compatibilidad con ${relation.brand} ${relation.model_name}`}
                    onClick={async () => {
                      if (!window.confirm('¿Eliminar esta compatibilidad?')) return
                      const ok = await mutate(
                        () => deleteCompatibility(selected.id, relation.model_id),
                        'Compatibilidad eliminada',
                      )
                      if (ok) {
                        setSession((current) => ({
                          ...current,
                          compatibilitiesRemoved:
                            current.compatibilitiesRemoved + 1,
                        }))
                        await refreshDetail()
                      }
                    }}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
              {compatibilities.length === 0 && (
                <Empty>Este componente no tiene modelos compatibles.</Empty>
              )}
            </div>
          </Card>

          <Card title="Estado del componente" eyebrow="VALIDACIÓN">
            <button
              type="button"
              className="verify-next-button"
              disabled={saving || selected.status !== 'active'}
              onClick={() => void verifyAndNext()}
            >
              <CheckCircle2 size={20} /> Verificar y siguiente
            </button>
            <div className="verification-actions">
              <button
                type="button"
                className="verify-button warning"
                disabled={saving}
                onClick={() => void setVerification('review')}
              >
                <AlertTriangle size={18} /> Necesita revisión
              </button>
              <button
                type="button"
                className="verify-button neutral"
                disabled={saving}
                onClick={() => void setVerification('pending')}
              >
                Dejar pendiente
              </button>
            </div>
          </Card>

          <div className="danger-zone">
            <h3>Acciones del registro</h3>
            {selected.status === 'active' ? (
              <button
                type="button"
                className="danger-action"
                onClick={async () => {
                  const counts = await getPartDependencyCounts(selected.id)
                  if (!window.confirm([
                    `Archivar: ${selected.name}`,
                    `SAP: ${selected.sap_code || '—'}`,
                    `Compatibilidades: ${counts.compatibilityCount}`,
                  ].join('\n'))) return
                  const ok = await mutate(
                    () => archivePart(selected.id),
                    'Componente archivado',
                  )
                  if (ok) await refreshDetail()
                }}
              >
                <Trash2 size={18} /> Eliminar componente
              </button>
            ) : (
              <button
                type="button"
                className="restore-action"
                onClick={async () => {
                  const ok = await mutate(
                    () => restorePart(selected.id),
                    'Componente restaurado',
                  )
                  if (ok) await refreshDetail()
                }}
              >
                <Undo2 size={18} /> Restaurar componente
              </button>
            )}
            <p>Eliminar archiva el registro; no borra datos ni relaciones.</p>
          </div>
        </section>

        {dialog === 'compatibility' && (
          <CompatibilityDialog
            families={activeFamilies}
            models={activeModels}
            saving={saving}
            onClose={() => setDialog(null)}
            onSubmit={async (modelId) => {
              const ok = await mutate(
                () => addCompatibility(selected.id, modelId),
                'Compatibilidad añadida',
              )
              if (ok) {
                setSession((current) => ({
                  ...current,
                  compatibilitiesAdded:
                    current.compatibilitiesAdded + 1,
                }))
                setDialog(null)
                await refreshDetail()
              }
            }}
          />
        )}
      </main>
    )
  }

  const total = stats?.total ?? 0
  const verified = stats?.verified ?? 0
  const percent = total
    ? Math.round((verified / total) * 100)
    : 0

  return (
    <main className="admin-app">
      <header className="admin-header">
        <div>
          <span className="admin-brand">MPC ADMIN</span>
          <h1>Mantenimiento del catálogo</h1>
        </div>
        <div className="admin-header-actions">
          <div
            className={dirty ? 'database-badge dirty' : 'database-badge'}
            role="status"
          >
            <Database size={15} />
            {dirty ? 'Cambios locales pendientes' : 'SQLite local'}
          </div>
          <details className="database-menu">
            <summary>
              <Database size={17} /> Base de datos
            </summary>
            <div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={17} /> Cargar BD
              </button>
              <button
                type="button"
                onClick={() => {
                  void downloadDatabase()
                  setToast('Descarga preparada')
                }}
              >
                <Download size={17} /> Descargar BD
              </button>
              <button
                type="button"
                className="danger-text"
                onClick={() => void handleReset()}
              >
                <RotateCcw size={17} /> Restaurar oficial
              </button>
            </div>
          </details>
          <input
            ref={fileRef}
            type="file"
            accept=".db,.sqlite,.sqlite3"
            hidden
            onChange={handleImport}
          />
        </div>
      </header>
      <div className="catalog-meta">Catálogo v{version}</div>
      <nav className="admin-nav" aria-label="Administración">
        {([
          ['summary', 'Resumen', <LayoutDashboard size={18} />],
          ['parts', 'Componentes', <ClipboardCheck size={18} />],
          ['families', 'Familias', <Layers3 size={18} />],
          ['models', 'Modelos', <Wrench size={18} />],
        ] as const).map(([value, label, icon]) => (
          <button
            type="button"
            key={value}
            className={section === value ? 'active' : ''}
            aria-pressed={section === value}
            onClick={() => setSection(value)}
          >
            {icon} {label}
          </button>
        ))}
      </nav>
      <Messages
        error={error}
        toast={toast}
        onClear={() => setError(null)}
      />

      {loading ? (
        <div className="loading-state" role="status">
          <RefreshCw className="spin" size={25} /> Cargando MPC...
        </div>
      ) : section === 'summary' ? (
        <SummaryDashboard
          stats={catalogStats}
          onCreatePart={() => {
            setPartDraft(emptyPart)
            setDialog('new-part')
          }}
          onCreateFamily={() => setSection('families')}
          onCreateModel={() => setSection('models')}
        />
      ) : section === 'parts' ? (
        <section className="dashboard-content">
          <div className="progress-card">
            <div>
              <span>PROGRESO</span>
              <strong>Verificados {verified} / {total}</strong>
              <small>
                Pendientes {stats?.pending ?? 0} · Revisar{' '}
                {stats?.review ?? 0}
              </small>
            </div>
            <b>{percent}%</b>
            <div
              className="progress-track"
              aria-label={`${percent}% verificado`}
            >
              <i style={{ width: `${percent}%` }} />
            </div>
          </div>
          <div className="session-card">
            <strong>Esta sesión</strong>
            <span>+{session.verified} verificados</span>
            <span>+{session.compatibilitiesAdded} compatibilidades</span>
            <span>−{session.compatibilitiesRemoved} compatibilidades</span>
            <span>+{session.partsCreated} componentes</span>
          </div>
          <div className="admin-toolbar">
            <button
              type="button"
              className="primary-action"
              onClick={() => {
                setPartDraft(emptyPart)
                setDialog('new-part')
              }}
            >
              <PackagePlus size={18} /> Nuevo componente
            </button>
            <ArchiveToggle
              checked={showArchived}
              onChange={setShowArchived}
            />
          </div>
          <div className="stats-grid">
            {([
              ['all', 'Total', total],
              ['pending', 'Pendientes', stats?.pending ?? 0],
              ['review', 'Revisar', stats?.review ?? 0],
              ['verified', 'Verificados', verified],
            ] as const).map(([value, label, count]) => (
              <button
                type="button"
                key={value}
                className={
                  filter === value
                    ? `stat-button ${value} active`
                    : `stat-button ${value}`
                }
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                <strong>{count}</strong><span>{label}</span>
              </button>
            ))}
          </div>
          <div className="admin-search">
            <Search size={20} />
            <input
              type="search"
              aria-label="Buscar componentes"
              placeholder="SAP, PN/OEM o nombre..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search && (
              <button
                type="button"
                aria-label="Limpiar búsqueda"
                onClick={() => setSearch('')}
              >
                <X size={17} />
              </button>
            )}
          </div>
          <div className="parts-list">
            {parts.map((part) => (
              <button
                type="button"
                key={part.id}
                className={
                  part.status === 'active'
                    ? 'admin-part-card'
                    : 'admin-part-card archived'
                }
                onClick={() => void openPart(part.id)}
              >
                <span className="part-symbol">
                  <PackageSearch size={22} />
                </span>
                <span className="part-card-main">
                  <strong>{part.name}</strong>
                  <small>
                    SAP {part.sap_code || '—'}
                    {' · '}PN/OEM {part.oem_code || '—'}
                    {' · '}{part.compatibility_count ?? 0} modelos
                    {part.status !== 'active' ? ' · Archivado' : ''}
                  </small>
                </span>
                <StatusBadge status={part.verification_status} />
              </button>
            ))}
            {parts.length === 0 && (
              <div className="guided-empty">
                <Empty>No hay componentes registrados con estos filtros.</Empty>
                {!search && filter === 'all' && !showArchived && (
                  <button
                    type="button"
                    className="primary-action"
                    onClick={() => {
                      setPartDraft(emptyPart)
                      setDialog('new-part')
                    }}
                  >
                    <PackagePlus size={18} /> Crear primer componente
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      ) : section === 'families' ? (
        <MaintenanceSection
          title="Familias"
          description="Edita, archiva o restaura familias sin perder relaciones."
          showArchived={showArchived}
          onShowArchived={setShowArchived}
          create={
            <FamilyForm
              saving={saving}
              onSubmit={async (data) => {
                await mutate(
                  () => createFamily(data.code, data.name, data.notes),
                  'Familia creada',
                )
              }}
            />
          }
        >
          {(showArchived ? families : activeFamilies).map((family) => (
            <MaintenanceRow
              key={family.id}
              archived={family.status !== 'active'}
              code={family.code}
              title={family.name}
              subtitle={`${family.model_count ?? 0} modelos`}
              onEdit={() => setEditingFamily(family)}
              onArchive={async () => {
                const counts = await getFamilyDependencyCounts(family.id)
                if (!window.confirm([
                  `Archivar ${family.code} — ${family.name}`,
                  `Modelos: ${counts.modelCount}`,
                  `Compatibilidades: ${counts.compatibilityCount}`,
                ].join('\n'))) return
                await mutate(
                  () => archiveFamily(family.id),
                  'Familia archivada',
                )
              }}
              onRestore={() =>
                void mutate(
                  () => restoreFamily(family.id),
                  'Familia restaurada',
                )
              }
            />
          ))}
          {(showArchived ? families : activeFamilies).length === 0 && (
            <Empty>No hay familias creadas.</Empty>
          )}
        </MaintenanceSection>
      ) : (
        <MaintenanceSection
          title="Modelos"
          description="Mantén familia, marca, modelo y variante."
          showArchived={showArchived}
          onShowArchived={setShowArchived}
          create={activeFamilies.length > 0 ? (
            <ModelForm
              families={activeFamilies}
              saving={saving}
              onSubmit={async (data) => {
                await mutate(
                  () => createModel(data),
                  'Modelo creado',
                )
              }}
            />
          ) : (
            <div className="guided-empty">
              <Empty>Primero crea una familia.</Empty>
              <button
                type="button"
                className="primary-action"
                onClick={() => setSection('families')}
              >
                <Plus size={18} /> Crear familia
              </button>
            </div>
          )}
        >
          {(showArchived ? models : activeModels).map((model) => (
            <MaintenanceRow
              key={model.id}
              archived={model.status !== 'active'}
              code={model.family_code}
              title={`${model.brand} ${model.name}`}
              subtitle={
                model.variant
                  ? `${model.family_name} · ${model.variant}`
                  : model.family_name
              }
              onEdit={() => setEditingModel(model)}
              onArchive={async () => {
                const counts = await getModelDependencyCounts(model.id)
                if (!window.confirm(
                  `Archivar ${model.brand} ${model.name}?\nCompatibilidades: ${counts.compatibilityCount}`,
                )) return
                await mutate(
                  () => archiveModel(model.id),
                  'Modelo archivado',
                )
              }}
              onRestore={() =>
                void mutate(
                  () => restoreModel(model.id),
                  'Modelo restaurado',
                )
              }
            />
          ))}
          {(showArchived ? models : activeModels).length === 0 &&
            activeFamilies.length > 0 && (
              <Empty>No hay modelos creados.</Empty>
            )}
        </MaintenanceSection>
      )}

      {dialog === 'new-part' && (
        <Dialog title="Nuevo componente" onClose={() => setDialog(null)}>
          <PartForm
            value={partDraft}
            onChange={setPartDraft}
            saving={saving}
            label="Crear componente"
            autoFocus
            onSubmit={async () => {
              let created: ApiPart | null = null
              const ok = await mutate(
                async () => {
                  created = await createPart(partDraft)
                },
                'Componente creado',
              )
              if (ok && created) {
                setSession((current) => ({
                  ...current,
                  partsCreated: current.partsCreated + 1,
                }))
                setDialog(null)
                setPartDraft(emptyPart)
                await openPart((created as ApiPart).id)
              }
            }}
          />
        </Dialog>
      )}
      {editingFamily && (
        <Dialog
          title="Editar familia"
          onClose={() => setEditingFamily(null)}
        >
          <FamilyForm
            family={editingFamily}
            saving={saving}
            onSubmit={async (data) => {
              const ok = await mutate(
                () => updateFamily(editingFamily.id, data),
                'Familia actualizada',
              )
              if (ok) setEditingFamily(null)
            }}
          />
        </Dialog>
      )}
      {editingModel && (
        <Dialog
          title="Editar modelo"
          onClose={() => setEditingModel(null)}
        >
          <ModelForm
            model={editingModel}
            families={activeFamilies}
            saving={saving}
            onSubmit={async (data) => {
              const ok = await mutate(
                () => updateModel(editingModel.id, data),
                'Modelo actualizado',
              )
              if (ok) setEditingModel(null)
            }}
          />
        </Dialog>
      )}
    </main>
  )
}

function SummaryDashboard({
  stats,
  onCreatePart,
  onCreateFamily,
  onCreateModel,
}: {
  stats: ApiCatalogStats | null
  onCreatePart: () => void
  onCreateFamily: () => void
  onCreateModel: () => void
}) {
  const total = stats?.parts ?? 0
  const verified = stats?.verified ?? 0
  const percent = total
    ? Math.round((verified / total) * 100)
    : 0
  const empty =
    !stats ||
    (stats.parts === 0 &&
      stats.families === 0 &&
      stats.models === 0)

  return (
    <section className="admin-content master-summary">
      <div className="admin-page-title">
        <span>SISTEMA MAESTRO</span>
        <h2>Resumen del catálogo</h2>
        <p>
          Construye familias, modelos, componentes y sus compatibilidades.
        </p>
      </div>

      {empty && (
        <div className="master-empty">
          <PackagePlus size={38} />
          <h3>El catálogo está vacío.</h3>
          <p>
            Empieza creando una familia, después sus modelos y finalmente
            los componentes.
          </p>
          <ol>
            <li>Crear familia</li>
            <li>Crear modelo</li>
            <li>Crear componente</li>
          </ol>
        </div>
      )}

      <div className="master-stats-grid">
        <Stat label="Componentes" value={stats?.parts ?? 0} />
        <Stat label="Familias" value={stats?.families ?? 0} />
        <Stat label="Modelos" value={stats?.models ?? 0} />
        <Stat label="Compatibilidades" value={stats?.compatibilities ?? 0} />
        <Stat label="Pendientes" value={stats?.pending ?? 0} />
        <Stat label="Revisar" value={stats?.review ?? 0} />
        <Stat label="Verificados" value={verified} />
      </div>

      <div className="progress-card">
        <div>
          <span>VERIFICACIÓN</span>
          <strong>Verificados {verified} / {total}</strong>
        </div>
        <b>{percent}%</b>
        <div className="progress-track" aria-label={`${percent}% verificado`}>
          <i style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div className="quick-actions">
        <button type="button" onClick={onCreateFamily}>
          <Layers3 size={19} /> Nueva familia
        </button>
        <button type="button" onClick={onCreateModel}>
          <Wrench size={19} /> Nuevo modelo
        </button>
        <button type="button" onClick={onCreatePart}>
          <PackagePlus size={19} /> Nuevo componente
        </button>
      </div>
    </section>
  )
}

function Stat({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="master-stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

function PartForm({
  value,
  onChange,
  saving,
  label,
  autoFocus = false,
  onSubmit,
}: {
  value: PartInput
  onChange: (value: PartInput) => void
  saving: boolean
  label: string
  autoFocus?: boolean
  onSubmit: () => Promise<void>
}) {
  const field = (name: keyof PartInput, next: string) =>
    onChange({ ...value, [name]: next })
  return (
    <form
      className="edit-form"
      onSubmit={(event) => {
        event.preventDefault()
        void onSubmit()
      }}
    >
      <div className="form-grid">
        <label>
          Nombre
          <input
            autoFocus={autoFocus}
            required
            value={value.name}
            onChange={(event) => field('name', event.target.value)}
          />
        </label>
        <label>
          Código SAP
          <input
            value={value.sapCode}
            onChange={(event) => field('sapCode', event.target.value)}
          />
        </label>
        <label>
          PN/OEM
          <input
            value={value.oemCode}
            onChange={(event) => field('oemCode', event.target.value)}
          />
        </label>
        <label className="wide-field">
          Notas
          <textarea
            value={value.notes}
            onChange={(event) => field('notes', event.target.value)}
          />
        </label>
      </div>
      <button
        className="form-submit"
        disabled={saving || !value.name.trim()}
      >
        <Save size={18} /> {saving ? 'Guardando...' : label}
      </button>
    </form>
  )
}

function FamilyForm({
  family,
  saving,
  onSubmit,
}: {
  family?: ApiFamily
  saving: boolean
  onSubmit: (data: {
    code: string
    name: string
    notes?: string
  }) => Promise<void>
}) {
  const [code, setCode] = useState(family?.code ?? '')
  const [name, setName] = useState(family?.name ?? '')
  const [notes, setNotes] = useState(family?.notes ?? '')
  return (
    <form
      className="create-form"
      onSubmit={(event) => {
        event.preventDefault()
        void onSubmit({ code, name, notes }).then(() => {
          if (!family) {
            setCode('')
            setName('')
            setNotes('')
          }
        })
      }}
    >
      <div className="form-grid">
        <label>
          Código
          <input
            autoFocus={Boolean(family)}
            required
            value={code}
            onChange={(event) =>
              setCode(event.target.value.toUpperCase())
            }
          />
        </label>
        <label>
          Nombre
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="wide-field">
          Notas
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
      </div>
      <button className="form-submit" disabled={saving}>
        {family ? <Save size={18} /> : <Plus size={18} />}
        {family ? 'Guardar cambios' : 'Crear familia'}
      </button>
    </form>
  )
}

function ModelForm({
  model,
  families,
  saving,
  onSubmit,
}: {
  model?: ApiModel
  families: ApiFamily[]
  saving: boolean
  onSubmit: (data: ModelInput) => Promise<void>
}) {
  const [value, setValue] = useState<ModelInput>({
    familyId: model?.family_id ?? families[0]?.id ?? 0,
    brand: model?.brand ?? '',
    name: model?.name ?? '',
    variant: model?.variant ?? '',
  })
  const field = (
    name: keyof ModelInput,
    next: string | number,
  ) => setValue((current) => ({ ...current, [name]: next }))
  return (
    <form
      className="create-form"
      onSubmit={(event) => {
        event.preventDefault()
        void onSubmit(value).then(() => {
          if (!model) {
            setValue((current) => ({
              ...current,
              brand: '',
              name: '',
              variant: '',
            }))
          }
        })
      }}
    >
      <div className="form-grid">
        <label>
          Familia
          <select
            value={value.familyId}
            onChange={(event) =>
              field('familyId', Number(event.target.value))
            }
          >
            {families.map((family) => (
              <option value={family.id} key={family.id}>
                {family.code} — {family.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Marca
          <input
            required
            value={value.brand}
            onChange={(event) => field('brand', event.target.value)}
          />
        </label>
        <label>
          Modelo
          <input
            required
            value={value.name}
            onChange={(event) => field('name', event.target.value)}
          />
        </label>
        <label>
          Variante
          <input
            value={value.variant}
            onChange={(event) => field('variant', event.target.value)}
          />
        </label>
      </div>
      <button
        className="form-submit"
        disabled={
          saving ||
          !value.familyId ||
          !value.brand.trim() ||
          !value.name.trim()
        }
      >
        {model ? <Save size={18} /> : <Plus size={18} />}
        {model ? 'Guardar cambios' : 'Crear modelo'}
      </button>
    </form>
  )
}

function CompatibilityDialog({
  families,
  models,
  saving,
  onClose,
  onSubmit,
}: {
  families: ApiFamily[]
  models: ApiModel[]
  saving: boolean
  onClose: () => void
  onSubmit: (modelId: number) => Promise<void>
}) {
  const [familyId, setFamilyId] =
    useState(families[0]?.id ?? 0)
  const [modelId, setModelId] = useState(0)
  const available = models.filter((item) => item.family_id === familyId)
  return (
    <Dialog title="Añadir compatibilidad" onClose={onClose}>
      <label>
        Familia
        <select
          autoFocus
          value={familyId}
          onChange={(event) => {
            setFamilyId(Number(event.target.value))
            setModelId(0)
          }}
        >
          {families.map((family) => (
            <option value={family.id} key={family.id}>
              {family.code} — {family.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Modelo
        <select
          value={modelId}
          onChange={(event) => setModelId(Number(event.target.value))}
        >
          <option value={0}>Selecciona modelo</option>
          {available.map((model) => (
            <option value={model.id} key={model.id}>
              {model.brand} {model.name}
              {model.variant ? ` — ${model.variant}` : ''}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="modal-submit"
        disabled={!modelId || saving}
        onClick={() => void onSubmit(modelId)}
      >
        <Plus size={18} /> Añadir compatibilidad
      </button>
    </Dialog>
  )
}

function Dialog({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose()
      }}
    >
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <div className="modal-header">
          <h3 id="dialog-title">{title}</h3>
          <button
            type="button"
            aria-label="Cerrar diálogo"
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function MaintenanceSection({
  title,
  description,
  showArchived,
  onShowArchived,
  create,
  children,
}: {
  title: string
  description: string
  showArchived: boolean
  onShowArchived: (value: boolean) => void
  create: ReactNode
  children: ReactNode
}) {
  return (
    <section className="admin-content">
      <div className="admin-page-title">
        <span>CATÁLOGO</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <ArchiveToggle
        checked={showArchived}
        onChange={onShowArchived}
      />
      {create}
      <div className="maintenance-list">{children}</div>
    </section>
  )
}

function MaintenanceRow({
  archived,
  code,
  title,
  subtitle,
  onEdit,
  onArchive,
  onRestore,
}: {
  archived: boolean
  code: string
  title: string
  subtitle: string
  onEdit: () => void
  onArchive: () => Promise<void>
  onRestore: () => void
}) {
  return (
    <article
      className={
        archived
          ? 'maintenance-card archived'
          : 'maintenance-card'
      }
    >
      <div>
        <span className="family-pill">{code}</span>
        <strong>{title}</strong>
        <small>
          {subtitle}{archived ? ' · Archivado' : ''}
        </small>
      </div>
      <div className="row-actions">
        <button type="button" onClick={onEdit}>Editar</button>
        {archived ? (
          <button type="button" onClick={onRestore}>Restaurar</button>
        ) : (
          <button
            type="button"
            className="danger-text"
            onClick={() => void onArchive()}
          >
            Archivar
          </button>
        )}
      </div>
    </article>
  )
}

function ArchiveToggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="archive-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      Mostrar archivados
    </label>
  )
}

function Card({
  title,
  eyebrow,
  action,
  children,
}: {
  title: string
  eyebrow: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="verification-section">
      <div className="section-heading-row">
        <div>
          <span>{eyebrow}</span>
          <h3>{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function StatusBadge({
  status,
}: {
  status: ApiPart['verification_status']
}) {
  const labels = {
    pending: 'Pendiente',
    review: 'Revisar',
    verified: 'Verificado',
  }
  return (
    <span className={`status-badge ${status}`}>
      {labels[status]}
    </span>
  )
}

function Messages({
  error,
  toast,
  onClear,
}: {
  error: string | null
  toast: string | null
  onClear: () => void
}) {
  return (
    <>
      {error && (
        <div className="feedback-banner error" role="alert">
          <AlertTriangle size={18} />
          <span>{error}</span>
          <button
            type="button"
            aria-label="Cerrar error"
            onClick={onClear}
          >
            <X size={17} />
          </button>
        </div>
      )}
      {toast && (
        <div className="feedback-banner success" role="status">
          <CheckCircle2 size={18} />
          <span>{toast}</span>
        </div>
      )}
    </>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty-state">
      <PackageSearch size={34} />
      <p>{children}</p>
    </div>
  )
}
