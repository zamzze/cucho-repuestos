import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'

import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Copy,
  Database,
  Download,
  Layers3,
  PackageSearch,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  Wrench,
  X,
} from 'lucide-react'

import {
  addCompatibility,
  createFamily,
  createModel,
  deleteCompatibility,
  getFamilies,
  getModels,
  getPart,
  getPartCompatibilities,
  getPartStats,
  getPartSuggestions,
  getParts,
  updatePartVerification,
} from '../db/repository'

import type {
  ApiCompatibility,
  ApiFamily,
  ApiModel,
  ApiPart,
  ApiPartStats,
  ApiSuggestion,
} from '../db/repository'

import {
  importDatabase,
  resetToOfficialDatabase,
} from '../db/sqlite'

import {
  downloadDatabase,
} from '../utils/downloadDatabase'

type Section =
  | 'parts'
  | 'families'
  | 'models'

type VerificationFilter =
  | 'all'
  | 'pending'
  | 'review'
  | 'verified'

function AdminPage() {
  const [section, setSection] =
    useState<Section>('parts')

  const [parts, setParts] =
    useState<ApiPart[]>([])

  const [stats, setStats] =
    useState<ApiPartStats | null>(null)

  const [families, setFamilies] =
    useState<ApiFamily[]>([])

  const [models, setModels] =
    useState<ApiModel[]>([])

  const [selectedPart, setSelectedPart] =
    useState<ApiPart | null>(null)

  const [
    compatibilities,
    setCompatibilities,
  ] = useState<ApiCompatibility[]>([])

  const [suggestions, setSuggestions] =
    useState<ApiSuggestion[]>([])

  const [search, setSearch] =
    useState('')

  const [filter, setFilter] =
    useState<VerificationFilter>('all')

  const [loading, setLoading] =
    useState(true)

  const [
    detailLoading,
    setDetailLoading,
  ] = useState(false)

  const [error, setError] =
    useState<string | null>(null)

  const [copiedSap, setCopiedSap] =
    useState(false)

  const [
    showAddCompatibility,
    setShowAddCompatibility,
  ] = useState(false)

  const [
    selectedFamilyId,
    setSelectedFamilyId,
  ] = useState<number | null>(null)

  const [
    selectedModelId,
    setSelectedModelId,
  ] = useState<number | null>(null)

  const [
    newFamilyCode,
    setNewFamilyCode,
  ] = useState('')

  const [
    newFamilyName,
    setNewFamilyName,
  ] = useState('')

  const [
    modelFamilyId,
    setModelFamilyId,
  ] = useState<number | null>(null)

  const [
    newModelBrand,
    setNewModelBrand,
  ] = useState('')

  const [
    newModelName,
    setNewModelName,
  ] = useState('')

  const [
    newModelVariant,
    setNewModelVariant,
  ] = useState('')

  const [saving, setSaving] =
    useState(false)

  const databaseInputRef =
    useRef<HTMLInputElement>(null)

  useEffect(() => {
    void loadInitialData()
  }, [])

  useEffect(() => {
    if (section !== 'parts') {
      return
    }

    const timer =
      window.setTimeout(() => {
        void loadParts()
      }, 220)

    return () => {
      window.clearTimeout(timer)
    }
  }, [
    search,
    filter,
    section,
  ])

  async function loadInitialData() {
    try {
      setLoading(true)
      setError(null)

      const [
        statsData,
        familiesData,
        modelsData,
      ] = await Promise.all([
        getPartStats(),
        getFamilies(),
        getModels(),
      ])

      setStats(statsData)
      setFamilies(familiesData)
      setModels(modelsData)

      await loadParts()
    } catch (err) {
      handleError(err)
    } finally {
      setLoading(false)
    }
  }

  async function loadParts() {
    try {
      const data =
        await getParts({
          q:
            search.trim() ||
            undefined,

          verification:
            filter === 'all'
              ? undefined
              : filter,
        })

      setParts(data)
    } catch (err) {
      handleError(err)
    }
  }

  async function refreshStats() {
    try {
      const data =
        await getPartStats()

      setStats(data)
    } catch (err) {
      handleError(err)
    }
  }

  async function openPart(
    partId: number,
  ) {
    try {
      setDetailLoading(true)
      setError(null)

      const [
        part,
        compatibilityData,
        suggestionData,
      ] = await Promise.all([
        getPart(partId),

        getPartCompatibilities(
          partId,
        ),

        getPartSuggestions(
          partId,
        ),
      ])

      if (!part) {
        throw new Error(
          'Repuesto no encontrado.',
        )
      }

      setSelectedPart(part)

      setCompatibilities(
        compatibilityData,
      )

      setSuggestions(
        suggestionData,
      )

      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      })
    } catch (err) {
      handleError(err)
    } finally {
      setDetailLoading(false)
    }
  }

  async function refreshPartDetail() {
    if (!selectedPart) {
      return
    }

    await openPart(
      selectedPart.id,
    )
  }

  function closePart() {
    setSelectedPart(null)

    setCompatibilities([])
    setSuggestions([])

    setShowAddCompatibility(
      false,
    )

    setSelectedFamilyId(null)
    setSelectedModelId(null)

    void loadParts()
    void refreshStats()
  }

  async function copySap(
    code: string,
  ) {
    try {
      await navigator.clipboard.writeText(
        code,
      )

      setCopiedSap(true)

      window.setTimeout(() => {
        setCopiedSap(false)
      }, 1500)
    } catch {
      setError(
        'No se pudo copiar el código SAP.',
      )
    }
  }

  async function handleAddCompatibility(
    modelId?: number | null,
  ) {
    if (!selectedPart) {
      return
    }

    const targetModelId =
      modelId ??
      selectedModelId

    if (!targetModelId) {
      setError(
        'Selecciona un modelo.',
      )

      return
    }

    try {
      setSaving(true)
      setError(null)

      await addCompatibility(
        selectedPart.id,
        targetModelId,
      )

      setShowAddCompatibility(
        false,
      )

      setSelectedFamilyId(null)
      setSelectedModelId(null)

      await refreshPartDetail()
    } catch (err) {
      handleError(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteCompatibility(
    modelId: number,
  ) {
    if (!selectedPart) {
      return
    }

    const confirmed =
      window.confirm(
        '¿Quitar esta compatibilidad del repuesto?',
      )

    if (!confirmed) {
      return
    }

    try {
      setSaving(true)
      setError(null)

      await deleteCompatibility(
        selectedPart.id,
        modelId,
      )

      await refreshPartDetail()
    } catch (err) {
      handleError(err)
    } finally {
      setSaving(false)
    }
  }

  async function setVerificationStatus(
    status:
      | 'pending'
      | 'review'
      | 'verified',
  ) {
    if (!selectedPart) {
      return
    }

    try {
      setSaving(true)
      setError(null)

      const updated =
        await updatePartVerification(
          selectedPart.id,
          status,
        )

      setSelectedPart(updated)

      await refreshStats()
      await loadParts()
    } catch (err) {
      handleError(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateFamily(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (
      !newFamilyCode.trim() ||
      !newFamilyName.trim()
    ) {
      setError(
        'Completa código y nombre de la familia.',
      )

      return
    }

    try {
      setSaving(true)
      setError(null)

      await createFamily(
        newFamilyCode,
        newFamilyName,
      )

      setNewFamilyCode('')
      setNewFamilyName('')

      const data =
        await getFamilies()

      setFamilies(data)
    } catch (err) {
      handleError(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateModel(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (
      !modelFamilyId ||
      !newModelBrand.trim() ||
      !newModelName.trim()
    ) {
      setError(
        'Completa familia, marca y modelo.',
      )

      return
    }

    try {
      setSaving(true)
      setError(null)

      await createModel({
        familyId:
          modelFamilyId,

        brand:
          newModelBrand,

        name:
          newModelName,

        variant:
          newModelVariant ||
          undefined,
      })

      setNewModelBrand('')
      setNewModelName('')
      setNewModelVariant('')

      const [
        modelsData,
        familiesData,
      ] = await Promise.all([
        getModels(),
        getFamilies(),
      ])

      setModels(modelsData)
      setFamilies(
        familiesData,
      )
    } catch (err) {
      handleError(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleImportDatabase(
    event:
      ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0]

    if (!file) {
      return
    }

    const confirmed =
      window.confirm(
        `¿Cargar "${file.name}" como base de trabajo?\n\nLa copia local actual será reemplazada.`,
      )

    if (!confirmed) {
      event.target.value = ''
      return
    }

    try {
      setLoading(true)
      setError(null)

      setSelectedPart(null)

      await importDatabase(file)

      await loadInitialData()

      window.alert(
        'Base SQLite cargada correctamente.',
      )
    } catch (err) {
      handleError(err)
    } finally {
      setLoading(false)

      event.target.value = ''
    }
  }

  async function handleResetDatabase() {
    const confirmed =
      window.confirm(
        '¿Descartar TODOS los cambios locales y volver a la base oficial publicada?\n\nEsta acción no se puede deshacer.',
      )

    if (!confirmed) {
      return
    }

    try {
      setLoading(true)
      setError(null)

      setSelectedPart(null)

      await resetToOfficialDatabase()

      await loadInitialData()

      window.alert(
        'Se restauró la base oficial publicada.',
      )
    } catch (err) {
      handleError(err)
    } finally {
      setLoading(false)
    }
  }

  function handleError(
    err: unknown,
  ) {
    if (
      err instanceof Error
    ) {
      setError(err.message)
      return
    }

    setError(
      'Ocurrió un error inesperado.',
    )
  }

  const availableModels =
    useMemo(() => {
      if (!selectedFamilyId) {
        return []
      }

      return models.filter(
        (model) =>
          model.family_id ===
          selectedFamilyId,
      )
    }, [
      models,
      selectedFamilyId,
    ])

  const groupedSuggestions =
    useMemo(() => {
      const map =
        new Map<
          number,
          {
            familyId: number
            familyCode: string
            familyName: string
            suggestions:
              ApiSuggestion[]
          }
        >()

      for (
        const suggestion
        of suggestions
      ) {
        const current =
          map.get(
            suggestion.family_id,
          )

        if (current) {
          current.suggestions.push(
            suggestion,
          )
        } else {
          map.set(
            suggestion.family_id,
            {
              familyId:
                suggestion.family_id,

              familyCode:
                suggestion.family_code,

              familyName:
                suggestion.family_name,

              suggestions: [
                suggestion,
              ],
            },
          )
        }
      }

      return [
        ...map.values(),
      ]
    }, [suggestions])

  if (selectedPart) {
    return (
      <PartVerification
        part={selectedPart}
        compatibilities={
          compatibilities
        }
        suggestionGroups={
          groupedSuggestions
        }
        families={families}
        availableModels={
          availableModels
        }
        selectedFamilyId={
          selectedFamilyId
        }
        selectedModelId={
          selectedModelId
        }
        showAddCompatibility={
          showAddCompatibility
        }
        copiedSap={copiedSap}
        saving={saving}
        loading={
          detailLoading
        }
        error={error}
        onBack={closePart}
        onCopySap={copySap}
        onOpenAdd={() =>
          setShowAddCompatibility(
            true,
          )
        }
        onCloseAdd={() => {
          setShowAddCompatibility(
            false,
          )

          setSelectedFamilyId(
            null,
          )

          setSelectedModelId(
            null,
          )
        }}
        onFamilyChange={(
          id,
        ) => {
          setSelectedFamilyId(
            id,
          )

          setSelectedModelId(
            null,
          )
        }}
        onModelChange={
          setSelectedModelId
        }
        onAddCompatibility={
          handleAddCompatibility
        }
        onDeleteCompatibility={
          handleDeleteCompatibility
        }
        onSetVerification={
          setVerificationStatus
        }
        onClearError={() =>
          setError(null)
        }
      />
    )
  }

  return (
    <main className="admin-app">
      <header className="admin-header">
        <div>
          <span className="admin-brand">
            MPC
          </span>

          <h1>
            Administración de
            repuestos
          </h1>
        </div>

        <div className="admin-header-actions">
          <input
            ref={
              databaseInputRef
            }
            type="file"
            accept=".db,.sqlite,.sqlite3"
            hidden
            onChange={
              handleImportDatabase
            }
          />

          <button
            type="button"
            className="download-db-button"
            onClick={() =>
              databaseInputRef.current?.click()
            }
          >
            <Upload size={16} />

            Cargar BD
          </button>

          <button
            type="button"
            className="download-db-button"
            onClick={() => {
              void downloadDatabase()
            }}
          >
            <Download
              size={16}
            />

            Descargar BD
          </button>

          <button
            type="button"
            className="reset-db-button"
            onClick={() => {
              void handleResetDatabase()
            }}
          >
            <RotateCcw
              size={16}
            />

            Restaurar
          </button>

          <div className="database-badge">
            <Database size={15} />
            SQLite local
          </div>
        </div>
      </header>

      <nav className="admin-nav">
        <button
          type="button"
          className={
            section === 'parts'
              ? 'active'
              : ''
          }
          onClick={() =>
            setSection('parts')
          }
        >
          <ClipboardCheck
            size={18}
          />

          Verificar
        </button>

        <button
          type="button"
          className={
            section ===
            'families'
              ? 'active'
              : ''
          }
          onClick={() =>
            setSection(
              'families',
            )
          }
        >
          <Layers3
            size={18}
          />

          Familias
        </button>

        <button
          type="button"
          className={
            section === 'models'
              ? 'active'
              : ''
          }
          onClick={() =>
            setSection(
              'models',
            )
          }
        >
          <Wrench size={18} />

          Modelos
        </button>
      </nav>

      {error && (
        <ErrorBanner
          message={error}
          onClose={() =>
            setError(null)
          }
        />
      )}

      {loading ? (
        <div className="loading-state">
          <RefreshCw
            className="spin"
            size={25}
          />

          Cargando MPC...
        </div>
      ) : (
        <>
          {section ===
            'parts' && (
            <PartsDashboard
              parts={parts}
              stats={stats}
              search={search}
              filter={filter}
              onSearch={
                setSearch
              }
              onFilter={
                setFilter
              }
              onOpenPart={
                openPart
              }
            />
          )}

          {section ===
            'families' && (
            <FamiliesAdmin
              families={
                families
              }
              code={
                newFamilyCode
              }
              name={
                newFamilyName
              }
              saving={saving}
              onCodeChange={
                setNewFamilyCode
              }
              onNameChange={
                setNewFamilyName
              }
              onSubmit={
                handleCreateFamily
              }
            />
          )}

          {section ===
            'models' && (
            <ModelsAdmin
              families={
                families
              }
              models={models}
              familyId={
                modelFamilyId
              }
              brand={
                newModelBrand
              }
              name={
                newModelName
              }
              variant={
                newModelVariant
              }
              saving={saving}
              onFamilyChange={
                setModelFamilyId
              }
              onBrandChange={
                setNewModelBrand
              }
              onNameChange={
                setNewModelName
              }
              onVariantChange={
                setNewModelVariant
              }
              onSubmit={
                handleCreateModel
              }
            />
          )}
        </>
      )}
    </main>
  )
}

/* ========================================================
   DASHBOARD REPUESTOS
   ======================================================== */

interface PartsDashboardProps {
  parts: ApiPart[]
  stats: ApiPartStats | null

  search: string

  filter:
    VerificationFilter

  onSearch: (
    value: string,
  ) => void

  onFilter: (
    value:
      VerificationFilter,
  ) => void

  onOpenPart: (
    partId: number,
  ) => void
}

function PartsDashboard({
  parts,
  stats,
  search,
  filter,
  onSearch,
  onFilter,
  onOpenPart,
}: PartsDashboardProps) {
  return (
    <>
      <section className="dashboard-hero">
        <span className="eyebrow">
          VERIFICACIÓN
        </span>

        <h2>
          Construyamos el
          catálogo
        </h2>

        <p>
          Revisa cada repuesto
          y confirma únicamente
          los modelos en los que
          realmente aplica.
        </p>
      </section>

      <section className="dashboard-content">
        <div className="stats-grid">
          <StatCard
            label="Total"
            value={
              stats?.total ?? 0
            }
            active={
              filter === 'all'
            }
            onClick={() =>
              onFilter('all')
            }
          />

          <StatCard
            label="Pendientes"
            value={
              stats?.pending ??
              0
            }
            type="pending"
            active={
              filter ===
              'pending'
            }
            onClick={() =>
              onFilter(
                'pending',
              )
            }
          />

          <StatCard
            label="Revisar"
            value={
              stats?.review ?? 0
            }
            type="review"
            active={
              filter ===
              'review'
            }
            onClick={() =>
              onFilter(
                'review',
              )
            }
          />

          <StatCard
            label="Verificados"
            value={
              stats?.verified ??
              0
            }
            type="verified"
            active={
              filter ===
              'verified'
            }
            onClick={() =>
              onFilter(
                'verified',
              )
            }
          />
        </div>

        <div className="admin-search">
          <Search size={20} />

          <input
            type="search"
            placeholder="SAP, PN, descripción o ID..."
            value={search}
            onChange={(
              event,
            ) =>
              onSearch(
                event.target
                  .value,
              )
            }
          />

          {search && (
            <button
              type="button"
              className="clear-search"
              onClick={() =>
                onSearch('')
              }
              aria-label="Limpiar búsqueda"
            >
              <X size={17} />
            </button>
          )}
        </div>

        <div className="list-heading">
          <div>
            <span>
              REPUESTOS
            </span>

            <h3>
              {parts.length}{' '}
              {parts.length ===
              1
                ? 'resultado'
                : 'resultados'}
            </h3>
          </div>
        </div>

        <div className="parts-list">
          {parts.map(
            (part) => (
              <button
                type="button"
                key={part.id}
                className="admin-part-card"
                onClick={() =>
                  onOpenPart(
                    part.id,
                  )
                }
              >
                <div className="part-symbol">
                  <PackageSearch
                    size={22}
                  />
                </div>

                <div className="part-card-main">
                  <h4>
                    {part.name}
                  </h4>

                  <div className="part-identifiers-mini">
                    {part.sap_code && (
                      <span className="sap-chip">
                        <b>
                          SAP
                        </b>

                        {
                          part.sap_code
                        }
                      </span>
                    )}

                    {part.oem_code && (
                      <span>
                        PN{' '}
                        {
                          part.oem_code
                        }
                      </span>
                    )}

                    {part.legacy_id && (
                      <span>
                        {
                          part.legacy_id
                        }
                      </span>
                    )}
                  </div>
                </div>

                <StatusBadge
                  status={
                    part.verification_status
                  }
                />

                <ChevronRight
                  size={19}
                  className="card-arrow"
                />
              </button>
            ),
          )}

          {parts.length ===
            0 && (
            <div className="empty-state">
              <PackageSearch
                size={40}
              />

              <h3>
                Sin resultados
              </h3>

              <p>
                Prueba con otro
                SAP, descripción
                o estado.
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  )
}

/* ========================================================
   VERIFICAR REPUESTO
   ======================================================== */

interface SuggestionGroup {
  familyId: number
  familyCode: string
  familyName: string
  suggestions:
    ApiSuggestion[]
}

interface PartVerificationProps {
  part: ApiPart

  compatibilities:
    ApiCompatibility[]

  suggestionGroups:
    SuggestionGroup[]

  families: ApiFamily[]

  availableModels:
    ApiModel[]

  selectedFamilyId:
    number | null

  selectedModelId:
    number | null

  showAddCompatibility:
    boolean

  copiedSap: boolean
  saving: boolean
  loading: boolean

  error:
    string | null

  onBack: () => void

  onCopySap: (
    code: string,
  ) => void

  onOpenAdd: () => void
  onCloseAdd: () => void

  onFamilyChange: (
    id: number,
  ) => void

  onModelChange: (
    id: number,
  ) => void

  onAddCompatibility: (
    modelId?:
      number | null,
  ) => void

  onDeleteCompatibility: (
    modelId: number,
  ) => void

  onSetVerification: (
    status:
      | 'pending'
      | 'review'
      | 'verified',
  ) => void

  onClearError: () => void
}

function PartVerification({
  part,
  compatibilities,
  suggestionGroups,
  families,
  availableModels,
  selectedFamilyId,
  selectedModelId,
  showAddCompatibility,
  copiedSap,
  saving,
  loading,
  error,
  onBack,
  onCopySap,
  onOpenAdd,
  onCloseAdd,
  onFamilyChange,
  onModelChange,
  onAddCompatibility,
  onDeleteCompatibility,
  onSetVerification,
  onClearError,
}: PartVerificationProps) {
  return (
    <main className="admin-app">
      <header className="detail-header">
        <button
          type="button"
          className="back-button"
          onClick={onBack}
        >
          <ArrowLeft
            size={20}
          />
        </button>

        <div>
          <span className="admin-brand">
            MPC
          </span>

          <h1>
            Verificar producto
          </h1>
        </div>

        <StatusBadge
          status={
            part.verification_status
          }
        />
      </header>

      {error && (
        <ErrorBanner
          message={error}
          onClose={
            onClearError
          }
        />
      )}

      <section className="part-detail-hero">
        <span className="eyebrow">
          {part.legacy_id ??
            `REPUESTO ${part.id}`}
        </span>

        <h2>
          {part.name}
        </h2>

        {part.sap_code && (
          <div className="sap-display">
            <div>
              <span>
                CÓDIGO SAP
              </span>

              <strong>
                {part.sap_code}
              </strong>
            </div>

            <button
              type="button"
              className={
                copiedSap
                  ? 'copy-sap copied'
                  : 'copy-sap'
              }
              onClick={() =>
                onCopySap(
                  part.sap_code!,
                )
              }
            >
              {copiedSap ? (
                <>
                  <Check
                    size={19}
                  />

                  Copiado
                </>
              ) : (
                <>
                  <Copy
                    size={19}
                  />

                  Copiar
                </>
              )}
            </button>
          </div>
        )}

        {part.oem_code && (
          <div className="secondary-code">
            <span>
              PN / OEM
            </span>

            <strong>
              {part.oem_code}
            </strong>
          </div>
        )}
      </section>

      {loading ? (
        <div className="loading-state">
          <RefreshCw
            className="spin"
            size={22}
          />

          Cargando...
        </div>
      ) : (
        <section className="verification-content">
          <div className="verification-section">
            <div className="section-heading-row">
              <div>
                <span>
                  COMPATIBILIDADES
                  CONFIRMADAS
                </span>

                <h3>
                  {
                    compatibilities.length
                  }{' '}
                  {compatibilities.length ===
                  1
                    ? 'modelo'
                    : 'modelos'}
                </h3>
              </div>

              <button
                type="button"
                className="primary-small"
                onClick={
                  onOpenAdd
                }
              >
                <Plus
                  size={17}
                />

                Añadir
              </button>
            </div>

            <div className="compatibility-list">
              {compatibilities.map(
                (
                  compatibility,
                ) => (
                  <div
                    key={
                      compatibility.id
                    }
                    className="compatibility-row"
                  >
                    <div className="family-pill">
                      {
                        compatibility.family_code
                      }
                    </div>

                    <div>
                      <strong>
                        {
                          compatibility.brand
                        }{' '}
                        {
                          compatibility.model_name
                        }

                        {compatibility.variant
                          ? ` · ${compatibility.variant}`
                          : ''}
                      </strong>

                      <span>
                        {
                          compatibility.family_name
                        }
                      </span>
                    </div>

                    <button
                      type="button"
                      className="delete-button"
                      onClick={() =>
                        onDeleteCompatibility(
                          compatibility.model_id,
                        )
                      }
                      disabled={
                        saving
                      }
                      aria-label="Eliminar compatibilidad"
                    >
                      <Trash2
                        size={18}
                      />
                    </button>
                  </div>
                ),
              )}

              {compatibilities.length ===
                0 && (
                <div className="empty-compact">
                  Todavía no se
                  ha confirmado
                  ningún modelo.
                </div>
              )}
            </div>
          </div>

          <div className="verification-section">
            <div className="section-heading-row">
              <div>
                <span>
                  AYUDA HISTÓRICA
                </span>

                <h3>
                  Sugerencias
                </h3>
              </div>
            </div>

            <p className="section-help">
              Estas relaciones
              provienen de la
              información histórica.
              No se consideran
              compatibilidades
              confirmadas hasta que
              las añadas.
            </p>

            <div className="suggestions-list">
              {suggestionGroups.map(
                (group) => (
                  <div
                    className="suggestion-group"
                    key={
                      group.familyId
                    }
                  >
                    <div className="suggestion-family">
                      <div className="family-pill warning">
                        {
                          group.familyCode
                        }
                      </div>

                      <div>
                        <strong>
                          {
                            group.familyName
                          }
                        </strong>

                        <span>
                          Evidencia
                          histórica
                        </span>
                      </div>
                    </div>

                    {group.suggestions.map(
                      (
                        suggestion,
                      ) => {
                        const alreadyAdded =
                          suggestion.model_id !==
                            null &&
                          compatibilities.some(
                            (
                              item,
                            ) =>
                              item.model_id ===
                              suggestion.model_id,
                          )

                        return (
                          <div
                            className="suggestion-model"
                            key={
                              suggestion.id
                            }
                          >
                            <div>
                              {suggestion.model_id ? (
                                <>
                                  <strong>
                                    {
                                      suggestion.brand
                                    }{' '}
                                    {
                                      suggestion.model_name
                                    }

                                    {suggestion.variant
                                      ? ` · ${suggestion.variant}`
                                      : ''}
                                  </strong>

                                  <span>
                                    Confianza:{' '}
                                    {translateConfidence(
                                      suggestion.confidence,
                                    )}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <strong>
                                    Modelo
                                    sin
                                    identificar
                                  </strong>

                                  <span>
                                    Solo
                                    conocemos
                                    la
                                    familia
                                  </span>
                                </>
                              )}
                            </div>

                            {suggestion.model_id ? (
                              <button
                                type="button"
                                className="suggestion-add"
                                disabled={
                                  saving ||
                                  alreadyAdded
                                }
                                onClick={() =>
                                  onAddCompatibility(
                                    suggestion.model_id,
                                  )
                                }
                              >
                                {alreadyAdded ? (
                                  <>
                                    <Check
                                      size={
                                        16
                                      }
                                    />

                                    Añadido
                                  </>
                                ) : (
                                  <>
                                    <Plus
                                      size={
                                        16
                                      }
                                    />

                                    Añadir
                                  </>
                                )}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="suggestion-add"
                                onClick={() => {
                                  onFamilyChange(
                                    group.familyId,
                                  )

                                  onOpenAdd()
                                }}
                              >
                                Elegir modelo
                              </button>
                            )}
                          </div>
                        )
                      },
                    )}
                  </div>
                ),
              )}

              {suggestionGroups.length ===
                0 && (
                <div className="empty-compact">
                  Este repuesto no
                  tiene sugerencias
                  históricas.
                </div>
              )}
            </div>
          </div>

          <div className="verification-section">
            <div className="section-heading-row">
              <div>
                <span>
                  VALIDACIÓN
                </span>

                <h3>
                  Estado del
                  repuesto
                </h3>
              </div>
            </div>

            <div className="verification-actions">
              <button
                type="button"
                className="verify-button success"
                disabled={
                  saving
                }
                onClick={() =>
                  onSetVerification(
                    'verified',
                  )
                }
              >
                <CheckCircle2
                  size={19}
                />

                Marcar
                verificado
              </button>

              <button
                type="button"
                className="verify-button warning"
                disabled={
                  saving
                }
                onClick={() =>
                  onSetVerification(
                    'review',
                  )
                }
              >
                <AlertTriangle
                  size={19}
                />

                Necesita
                revisión
              </button>

              <button
                type="button"
                className="verify-button neutral"
                disabled={
                  saving
                }
                onClick={() =>
                  onSetVerification(
                    'pending',
                  )
                }
              >
                Dejar pendiente
              </button>
            </div>
          </div>
        </section>
      )}

      {showAddCompatibility && (
        <div className="modal-backdrop">
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-label="Añadir compatibilidad"
          >
            <div className="modal-header">
              <div>
                <span>
                  NUEVA RELACIÓN
                </span>

                <h3>
                  Añadir
                  compatibilidad
                </h3>
              </div>

              <button
                type="button"
                onClick={
                  onCloseAdd
                }
              >
                <X
                  size={21}
                />
              </button>
            </div>

            <label>
              Familia

              <select
                value={
                  selectedFamilyId ??
                  ''
                }
                onChange={(
                  event,
                ) => {
                  const value =
                    Number(
                      event
                        .target
                        .value,
                    )

                  if (
                    Number.isInteger(
                      value,
                    ) &&
                    value > 0
                  ) {
                    onFamilyChange(
                      value,
                    )
                  }
                }}
              >
                <option value="">
                  Selecciona
                  familia
                </option>

                {families.map(
                  (
                    family,
                  ) => (
                    <option
                      key={
                        family.id
                      }
                      value={
                        family.id
                      }
                    >
                      {
                        family.code
                      }{' '}
                      —{' '}
                      {
                        family.name
                      }
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              Modelo

              <select
                value={
                  selectedModelId ??
                  ''
                }
                disabled={
                  !selectedFamilyId
                }
                onChange={(
                  event,
                ) => {
                  const value =
                    Number(
                      event
                        .target
                        .value,
                    )

                  if (
                    Number.isInteger(
                      value,
                    ) &&
                    value > 0
                  ) {
                    onModelChange(
                      value,
                    )
                  }
                }}
              >
                <option value="">
                  Selecciona
                  modelo
                </option>

                {availableModels.map(
                  (
                    model,
                  ) => (
                    <option
                      key={
                        model.id
                      }
                      value={
                        model.id
                      }
                    >
                      {
                        model.brand
                      }{' '}
                      {
                        model.name
                      }

                      {model.variant
                        ? ` — ${model.variant}`
                        : ''}
                    </option>
                  ),
                )}
              </select>
            </label>

            {selectedFamilyId &&
              availableModels.length ===
                0 && (
                <div className="empty-compact">
                  Esta familia
                  todavía no tiene
                  modelos.
                </div>
              )}

            <button
              type="button"
              className="modal-submit"
              disabled={
                !selectedModelId ||
                saving
              }
              onClick={() =>
                onAddCompatibility()
              }
            >
              <Plus
                size={18}
              />

              Añadir
              compatibilidad
            </button>
          </div>
        </div>
      )}
    </main>
  )
}

/* ========================================================
   FAMILIAS
   ======================================================== */

function FamiliesAdmin({
  families,
  code,
  name,
  saving,
  onCodeChange,
  onNameChange,
  onSubmit,
}: {
  families:
    ApiFamily[]

  code: string
  name: string
  saving: boolean

  onCodeChange: (
    value: string,
  ) => void

  onNameChange: (
    value: string,
  ) => void

  onSubmit: (
    event:
      FormEvent<HTMLFormElement>,
  ) => void
}) {
  return (
    <section className="admin-content">
      <div className="admin-page-title">
        <span>
          CATÁLOGO
        </span>

        <h2>
          Familias
        </h2>

        <p>
          Crea una familia una
          sola vez. Los modelos
          posteriormente se
          relacionan con ella.
        </p>
      </div>

      <form
        className="create-form"
        onSubmit={onSubmit}
      >
        <h3>
          <Plus size={18} />

          Nueva familia
        </h3>

        <div className="form-grid">
          <label>
            Código

            <input
              value={code}
              maxLength={10}
              placeholder="Ej. PE"
              onChange={(
                event,
              ) =>
                onCodeChange(
                  event.target.value.toUpperCase(),
                )
              }
            />
          </label>

          <label>
            Nombre

            <input
              value={name}
              placeholder="Ej. Planta eléctrica"
              onChange={(
                event,
              ) =>
                onNameChange(
                  event.target.value,
                )
              }
            />
          </label>
        </div>

        <button
          type="submit"
          className="form-submit"
          disabled={
            saving
          }
        >
          <Plus size={18} />

          Crear familia
        </button>
      </form>

      <div className="catalog-list">
        {families.map(
          (family) => (
            <div
              className="catalog-row"
              key={
                family.id
              }
            >
              <div className="family-pill">
                {
                  family.code
                }
              </div>

              <div>
                <strong>
                  {
                    family.name
                  }
                </strong>

                <span>
                  {
                    family.model_count ??
                    0
                  }{' '}
                  modelos
                </span>
              </div>
            </div>
          ),
        )}
      </div>
    </section>
  )
}

/* ========================================================
   MODELOS
   ======================================================== */

function ModelsAdmin({
  families,
  models,
  familyId,
  brand,
  name,
  variant,
  saving,
  onFamilyChange,
  onBrandChange,
  onNameChange,
  onVariantChange,
  onSubmit,
}: {
  families:
    ApiFamily[]

  models:
    ApiModel[]

  familyId:
    number | null

  brand: string
  name: string
  variant: string
  saving: boolean

  onFamilyChange: (
    value: number,
  ) => void

  onBrandChange: (
    value: string,
  ) => void

  onNameChange: (
    value: string,
  ) => void

  onVariantChange: (
    value: string,
  ) => void

  onSubmit: (
    event:
      FormEvent<HTMLFormElement>,
  ) => void
}) {
  return (
    <section className="admin-content">
      <div className="admin-page-title">
        <span>
          CATÁLOGO
        </span>

        <h2>
          Modelos
        </h2>

        <p>
          Cada modelo pertenece
          a una única familia.
        </p>
      </div>

      <form
        className="create-form"
        onSubmit={onSubmit}
      >
        <h3>
          <Plus size={18} />

          Nuevo modelo
        </h3>

        <div className="form-grid">
          <label>
            Familia

            <select
              value={
                familyId ??
                ''
              }
              onChange={(
                event,
              ) => {
                const value =
                  Number(
                    event
                      .target
                      .value,
                  )

                if (
                  Number.isInteger(
                    value,
                  ) &&
                  value > 0
                ) {
                  onFamilyChange(
                    value,
                  )
                }
              }}
            >
              <option value="">
                Selecciona
                familia
              </option>

              {families.map(
                (
                  family,
                ) => (
                  <option
                    value={
                      family.id
                    }
                    key={
                      family.id
                    }
                  >
                    {
                      family.code
                    }{' '}
                    —{' '}
                    {
                      family.name
                    }
                  </option>
                ),
              )}
            </select>
          </label>

          <label>
            Marca

            <input
              value={brand}
              placeholder="Ej. TLD"
              onChange={(
                event,
              ) =>
                onBrandChange(
                  event.target.value,
                )
              }
            />
          </label>

          <label>
            Modelo

            <input
              value={name}
              placeholder="Ej. JST25"
              onChange={(
                event,
              ) =>
                onNameChange(
                  event.target.value,
                )
              }
            />
          </label>

          <label>
            Variante

            <span className="optional">
              opcional
            </span>

            <input
              value={variant}
              placeholder="Ej. DIESEL"
              onChange={(
                event,
              ) =>
                onVariantChange(
                  event.target.value,
                )
              }
            />
          </label>
        </div>

        <button
          type="submit"
          className="form-submit"
          disabled={
            saving
          }
        >
          <Plus size={18} />

          Crear modelo
        </button>
      </form>

      <div className="catalog-list">
        {models.map(
          (model) => (
            <div
              className="catalog-row"
              key={model.id}
            >
              <div className="family-pill">
                {
                  model.family_code
                }
              </div>

              <div>
                <strong>
                  {
                    model.brand
                  }{' '}
                  {
                    model.name
                  }
                </strong>

                <span>
                  {
                    model.family_name
                  }

                  {model.variant
                    ? ` · ${model.variant}`
                    : ''}
                </span>
              </div>
            </div>
          ),
        )}
      </div>
    </section>
  )
}

/* ========================================================
   COMPONENTES PEQUEÑOS
   ======================================================== */

function StatCard({
  label,
  value,
  type = 'total',
  active,
  onClick,
}: {
  label: string
  value: number

  type?:
    | 'total'
    | 'pending'
    | 'review'
    | 'verified'

  active: boolean

  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`stat-button ${type} ${
        active
          ? 'active'
          : ''
      }`}
      onClick={onClick}
    >
      <strong>
        {value}
      </strong>

      <span>
        {label}
      </span>
    </button>
  )
}

function StatusBadge({
  status,
}: {
  status:
    | 'pending'
    | 'review'
    | 'verified'
}) {
  const labels = {
    pending:
      'Pendiente',

    review:
      'Revisar',

    verified:
      'Verificado',
  }

  return (
    <span
      className={`status-badge ${status}`}
    >
      {labels[status]}
    </span>
  )
}

function ErrorBanner({
  message,
  onClose,
}: {
  message: string
  onClose: () => void
}) {
  return (
    <div className="error-banner">
      <AlertTriangle
        size={18}
      />

      <span>
        {message}
      </span>

      <button
        type="button"
        onClick={
          onClose
        }
        aria-label="Cerrar error"
      >
        <X size={17} />
      </button>
    </div>
  )
}

function translateConfidence(
  confidence:
    | 'high'
    | 'medium'
    | 'low'
    | null,
) {
  if (
    confidence === 'high'
  ) {
    return 'Alta'
  }

  if (
    confidence === 'medium'
  ) {
    return 'Media'
  }

  if (
    confidence === 'low'
  ) {
    return 'Baja'
  }

  return 'Sin clasificar'
}

export default AdminPage