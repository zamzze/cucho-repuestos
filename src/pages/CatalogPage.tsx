import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  ArrowLeft,
  Check,
  ChevronRight,
  Copy,
  PackageSearch,
  Search,
} from 'lucide-react'

import {
  getFamilies,
  getModels,
  getPartCompatibilities,
  getParts,
} from '../db/repository'

import type {
  ApiCompatibility,
  ApiFamily,
  ApiModel,
  ApiPart,
} from '../db/repository'

type CatalogView =
  | {
      type: 'home'
    }
  | {
      type: 'part'
      partId: number
    }
  | {
      type: 'family'
      familyId: number
    }
  | {
      type: 'model'
      modelId: number
    }

function normalizeText(
  value?: string | null,
) {
  if (!value) {
    return ''
  }

  return value
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      '',
    )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim()
}

function matchesTokens(
  query: string,
  values: Array<
    string | null | undefined
  >,
) {
  const tokens =
    normalizeText(query)
      .split(' ')
      .filter(Boolean)

  if (tokens.length === 0) {
    return false
  }

  const text =
    normalizeText(
      values
        .filter(Boolean)
        .join(' '),
    )

  return tokens.every(
    (token) =>
      text.includes(token),
  )
}

export default function CatalogPage() {
  const [parts, setParts] =
    useState<ApiPart[]>([])

  const [families, setFamilies] =
    useState<ApiFamily[]>([])

  const [models, setModels] =
    useState<ApiModel[]>([])

  const [compatibilityMap, setCompatibilityMap] =
    useState<
      Map<
        number,
        ApiCompatibility[]
      >
    >(new Map())

  const [search, setSearch] =
    useState('')

  const [view, setView] =
    useState<CatalogView>({
      type: 'home',
    })

  const [loading, setLoading] =
    useState(true)

  const [copied, setCopied] =
    useState(false)

  useEffect(() => {
    loadCatalog()
  }, [])

  async function loadCatalog() {
    try {
      setLoading(true)

      const [
        partData,
        familyData,
        modelData,
      ] = await Promise.all([
        /*
          Solo mostramos repuestos
          verificados en catálogo.
        */
        getParts({
          verification:
            'verified',
        }),

        getFamilies(),
        getModels(),
      ])

      setParts(partData)
      setFamilies(familyData)
      setModels(modelData)

      /*
        Nuestra BD es pequeña.
        Podemos cargar las
        compatibilidades localmente.
      */
      const entries =
        await Promise.all(
          partData.map(
            async (part) => {
              const relations =
                await getPartCompatibilities(
                  part.id,
                )

              return [
                part.id,
                relations,
              ] as const
            },
          ),
        )

      setCompatibilityMap(
        new Map(entries),
      )
    } finally {
      setLoading(false)
    }
  }

  async function copySap(
    code: string,
  ) {
    await navigator.clipboard.writeText(
      code,
    )

    setCopied(true)

    window.setTimeout(
      () =>
        setCopied(false),
      1400,
    )
  }

  const query =
    search.trim()

  const searchParts =
    useMemo(() => {
      if (!query) {
        return []
      }

      return parts.filter(
        (part) => {
          const relations =
            compatibilityMap.get(
              part.id,
            ) ?? []

          const compatibilityFields =
            relations.flatMap(
              (relation) => [
                relation.family_code,
                relation.family_name,
                relation.brand,
                relation.model_name,
                relation.variant,
              ],
            )

          return matchesTokens(
            query,
            [
              part.sap_code,
              part.oem_code,
              part.name,
              part.notes,
              ...compatibilityFields,
            ],
          )
        },
      )
    }, [
      parts,
      query,
      compatibilityMap,
    ])

  const searchModels =
    useMemo(() => {
      if (!query) {
        return []
      }

      return models.filter(
        (model) =>
          matchesTokens(
            query,
            [
              model.family_code,
              model.family_name,
              model.brand,
              model.name,
              model.variant,
            ],
          ),
      )
    }, [models, query])

  const searchFamilies =
    useMemo(() => {
      if (!query) {
        return []
      }

      return families.filter(
        (family) =>
          matchesTokens(
            query,
            [
              family.code,
              family.name,
            ],
          ),
      )
    }, [
      families,
      query,
    ])

  if (loading) {
    return (
      <div className="catalog-loading">
        Cargando catálogo...
      </div>
    )
  }

  if (view.type === 'part') {
    const part =
      parts.find(
        (item) =>
          item.id === view.partId,
      )

    if (!part) {
      return null
    }

    const relations =
      compatibilityMap.get(
        part.id,
      ) ?? []

    return (
      <main className="catalog-app">
        <CatalogHeader
          title="Detalle del repuesto"
          onBack={() =>
            setView({
              type: 'home',
            })
          }
        />

        <section className="catalog-detail-hero">
          <span>REPUESTO</span>

          <h2>
            {part.name}
          </h2>

          {part.sap_code && (
            <div className="catalog-sap">
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
                onClick={() =>
                  copySap(
                    part.sap_code!,
                  )
                }
              >
                {copied ? (
                  <>
                    <Check
                      size={18}
                    />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy
                      size={18}
                    />
                    Copiar
                  </>
                )}
              </button>
            </div>
          )}

          {part.oem_code && (
            <div className="catalog-oem">
              PN/OEM:
              <strong>
                {part.oem_code}
              </strong>
            </div>
          )}
        </section>

        <section className="catalog-section">
          <span className="catalog-section-label">
            COMPATIBILIDAD
          </span>

          <h3>
            Modelos compatibles
          </h3>

          <div className="catalog-list">
            {relations.map(
              (relation) => (
                <button
                  type="button"
                  className="catalog-card"
                  key={
                    relation.id
                  }
                  onClick={() =>
                    setView({
                      type: 'model',
                      modelId:
                        relation.model_id,
                    })
                  }
                >
                  <div className="catalog-family-code">
                    {
                      relation.family_code
                    }
                  </div>

                  <div>
                    <strong>
                      {
                        relation.brand
                      }{' '}
                      {
                        relation.model_name
                      }
                    </strong>

                    <span>
                      {
                        relation.family_name
                      }
                    </span>
                  </div>

                  <ChevronRight
                    size={18}
                  />
                </button>
              ),
            )}

            {relations.length ===
              0 && (
              <div className="catalog-empty">
                Sin modelos asociados.
              </div>
            )}
          </div>
        </section>
      </main>
    )
  }

  if (view.type === 'family') {
    const family =
      families.find(
        (item) =>
          item.id ===
          view.familyId,
      )

    if (!family) {
      return null
    }

    const familyModels =
      models.filter(
        (model) =>
          model.family_id ===
          family.id,
      )

    return (
      <main className="catalog-app">
        <CatalogHeader
          title={family.name}
          onBack={() =>
            setView({
              type: 'home',
            })
          }
        />

        <section className="catalog-detail-hero">
          <span>
            FAMILIA {family.code}
          </span>

          <h2>{family.name}</h2>

          <p>
            Selecciona un modelo.
          </p>
        </section>

        <section className="catalog-section">
          <div className="catalog-list">
            {familyModels.map(
              (model) => (
                <button
                  type="button"
                  className="catalog-card"
                  key={model.id}
                  onClick={() =>
                    setView({
                      type: 'model',
                      modelId:
                        model.id,
                    })
                  }
                >
                  <div className="catalog-family-code">
                    {
                      model.family_code
                    }
                  </div>

                  <div>
                    <strong>
                      {model.brand}{' '}
                      {model.name}
                    </strong>

                    <span>
                      {model.variant ||
                        family.name}
                    </span>
                  </div>

                  <ChevronRight
                    size={18}
                  />
                </button>
              ),
            )}
          </div>
        </section>
      </main>
    )
  }

  if (view.type === 'model') {
    const model =
      models.find(
        (item) =>
          item.id ===
          view.modelId,
      )

    if (!model) {
      return null
    }

    const compatibleParts =
      parts.filter(
        (part) =>
          (
            compatibilityMap.get(
              part.id,
            ) ?? []
          ).some(
            (relation) =>
              relation.model_id ===
              model.id,
          ),
      )

    return (
      <main className="catalog-app">
        <CatalogHeader
          title={`${model.brand} ${model.name}`}
          onBack={() =>
            setView({
              type: 'family',
              familyId:
                model.family_id,
            })
          }
        />

        <section className="catalog-detail-hero">
          <span>
            {model.family_name}
          </span>

          <h2>
            {model.brand}{' '}
            {model.name}
          </h2>

          {model.variant && (
            <p>
              {model.variant}
            </p>
          )}
        </section>

        <section className="catalog-section">
          <span className="catalog-section-label">
            REPUESTOS
          </span>

          <h3>
            {compatibleParts.length}{' '}
            compatibles
          </h3>

          <div className="catalog-list">
            {compatibleParts.map(
              (part) => (
                <button
                  type="button"
                  className="catalog-card"
                  key={part.id}
                  onClick={() =>
                    setView({
                      type: 'part',
                      partId:
                        part.id,
                    })
                  }
                >
                  <div className="catalog-part-icon">
                    <PackageSearch
                      size={20}
                    />
                  </div>

                  <div>
                    <strong>
                      {part.name}
                    </strong>

                    {part.sap_code && (
                      <span>
                        SAP{' '}
                        {
                          part.sap_code
                        }
                      </span>
                    )}
                  </div>

                  <ChevronRight
                    size={18}
                  />
                </button>
              ),
            )}
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="catalog-app">
      <header className="catalog-main-header">
        <div>
          <span>MPC</span>

          <h1>
            Catálogo de Repuestos
          </h1>
        </div>

        <div className="catalog-offline">
          Local
        </div>
      </header>

      <section className="catalog-hero">
        <span>
          MECATRÓNICA
        </span>

        <h2>
          ¿Qué repuesto necesitas?
        </h2>

        <p>
          Busca por SAP, repuesto,
          familia, marca o modelo.
        </p>

        <div className="catalog-search">
          <Search size={21} />

          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value,
              )
            }
            placeholder="SAP, repuesto, modelo, familia..."
          />
        </div>
      </section>

      {query ? (
        <section className="catalog-section">
          <SearchGroup
            title="Repuestos"
            count={
              searchParts.length
            }
          >
            {searchParts.map(
              (part) => (
                <button
                  type="button"
                  className="catalog-card"
                  key={part.id}
                  onClick={() =>
                    setView({
                      type: 'part',
                      partId:
                        part.id,
                    })
                  }
                >
                  <div className="catalog-part-icon">
                    <PackageSearch
                      size={20}
                    />
                  </div>

                  <div>
                    <strong>
                      {part.name}
                    </strong>

                    {part.sap_code && (
                      <span>
                        SAP{' '}
                        {
                          part.sap_code
                        }
                      </span>
                    )}
                  </div>

                  <ChevronRight
                    size={18}
                  />
                </button>
              ),
            )}
          </SearchGroup>

          <SearchGroup
            title="Modelos"
            count={
              searchModels.length
            }
          >
            {searchModels.map(
              (model) => (
                <button
                  type="button"
                  className="catalog-card"
                  key={model.id}
                  onClick={() =>
                    setView({
                      type: 'model',
                      modelId:
                        model.id,
                    })
                  }
                >
                  <div className="catalog-family-code">
                    {
                      model.family_code
                    }
                  </div>

                  <div>
                    <strong>
                      {model.brand}{' '}
                      {model.name}
                    </strong>

                    <span>
                      {
                        model.family_name
                      }
                    </span>
                  </div>

                  <ChevronRight
                    size={18}
                  />
                </button>
              ),
            )}
          </SearchGroup>

          <SearchGroup
            title="Familias"
            count={
              searchFamilies.length
            }
          >
            {searchFamilies.map(
              (family) => (
                <button
                  type="button"
                  className="catalog-card"
                  key={family.id}
                  onClick={() =>
                    setView({
                      type: 'family',
                      familyId:
                        family.id,
                    })
                  }
                >
                  <div className="catalog-family-code">
                    {family.code}
                  </div>

                  <div>
                    <strong>
                      {family.name}
                    </strong>

                    <span>
                      {
                        models.filter(
                          (model) =>
                            model.family_id ===
                            family.id,
                        ).length
                      } modelos
                    </span>
                  </div>

                  <ChevronRight
                    size={18}
                  />
                </button>
              ),
            )}
          </SearchGroup>

          {searchParts.length === 0 &&
            searchModels.length === 0 &&
            searchFamilies.length ===
              0 && (
              <div className="catalog-empty">
                No encontramos
                resultados.
              </div>
            )}
        </section>
      ) : (
        <section className="catalog-section">
          <span className="catalog-section-label">
            EXPLORAR
          </span>

          <h3>
            Buscar por equipo
          </h3>

          <div className="catalog-list">
            {families.map(
              (family) => (
                <button
                  type="button"
                  className="catalog-card"
                  key={family.id}
                  onClick={() =>
                    setView({
                      type: 'family',
                      familyId:
                        family.id,
                    })
                  }
                >
                  <div className="catalog-family-code">
                    {family.code}
                  </div>

                  <div>
                    <strong>
                      {family.name}
                    </strong>

                    <span>
                      {
                        models.filter(
                          (model) =>
                            model.family_id ===
                            family.id,
                        ).length
                      } modelos
                    </span>
                  </div>

                  <ChevronRight
                    size={18}
                  />
                </button>
              ),
            )}
          </div>
        </section>
      )}
    </main>
  )
}

function CatalogHeader({
  title,
  onBack,
}: {
  title: string
  onBack: () => void
}) {
  return (
    <header className="catalog-detail-header">
      <button
        type="button"
        onClick={onBack}
      >
        <ArrowLeft size={20} />
      </button>

      <div>
        <span>MPC</span>
        <h1>{title}</h1>
      </div>
    </header>
  )
}

function SearchGroup({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: React.ReactNode
}) {
  if (count === 0) {
    return null
  }

  return (
    <div className="catalog-search-group">
      <span>
        {title.toUpperCase()}
      </span>

      <h3>
        {count}{' '}
        {count === 1
          ? 'resultado'
          : 'resultados'}
      </h3>

      <div className="catalog-list">
        {children}
      </div>
    </div>
  )
}