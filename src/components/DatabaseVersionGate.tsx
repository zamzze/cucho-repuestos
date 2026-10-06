import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  AlertTriangle,
  Download,
  RefreshCw,
  RotateCcw,
} from 'lucide-react'
import {
  discardLocalDatabaseAndUseOfficial,
  getLocalDatabaseBackup,
  getLocalDatabaseVersionConflict,
  type LocalDatabaseVersionConflict,
} from '../db/sqlite'

export default function DatabaseVersionGate({
  children,
}: {
  children: ReactNode
}) {
  const [checking, setChecking] =
    useState(true)
  const [conflict, setConflict] =
    useState<LocalDatabaseVersionConflict | null>(null)
  const [cancelled, setCancelled] =
    useState(false)
  const [error, setError] =
    useState<string | null>(null)

  const check = useCallback(async () => {
    setChecking(true)
    setError(null)
    try {
      setConflict(
        await getLocalDatabaseVersionConflict(),
      )
      setCancelled(false)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'No se pudo comprobar la base local.',
      )
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void check()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [check])

  async function downloadBackup() {
    try {
      const backup =
        await getLocalDatabaseBackup()
      const blob = new Blob(
        [backup.data],
        { type: 'application/x-sqlite3' },
      )
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download =
        `mpc-local-backup-v${backup.catalogVersion}.db`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'No se pudo descargar el respaldo.',
      )
    }
  }

  async function discardAndContinue() {
    setChecking(true)
    setError(null)
    try {
      await discardLocalDatabaseAndUseOfficial()
      setConflict(null)
      setCancelled(false)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'No se pudo cargar la base oficial.',
      )
    } finally {
      setChecking(false)
    }
  }

  if (checking) {
    return (
      <main className="database-upgrade-page" role="status">
        <RefreshCw className="spin" size={28} />
        Comprobando catálogo local...
      </main>
    )
  }

  if (error) {
    return (
      <main className="database-upgrade-page">
        <section className="database-upgrade-card" role="alert">
          <AlertTriangle size={34} />
          <h1>No se pudo comprobar la base local</h1>
          <p>{error}</p>
          <button type="button" onClick={() => void check()}>
            <RefreshCw size={18} /> Reintentar
          </button>
        </section>
      </main>
    )
  }

  if (conflict && !cancelled) {
    return (
      <main className="database-upgrade-page">
        <section className="database-upgrade-card" role="alert">
          <AlertTriangle size={38} />
          <span>MIGRACIÓN DE CATÁLOGO</span>
          <h1>Hay cambios locales de una versión anterior</h1>
          <p>
            Tu copia local v{conflict.localVersion} tiene cambios
            pendientes. La nueva base oficial es v{conflict.officialVersion}.
            No se reemplazará nada sin tu decisión.
          </p>
          <div className="database-upgrade-actions">
            <button type="button" onClick={() => void downloadBackup()}>
              <Download size={18} /> Descargar respaldo
            </button>
            <button
              type="button"
              className="danger"
              onClick={() => void discardAndContinue()}
            >
              <RotateCcw size={18} /> Descartar y usar nueva base
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setCancelled(true)}
            >
              Cancelar
            </button>
          </div>
        </section>
      </main>
    )
  }

  if (conflict && cancelled) {
    return (
      <main className="database-upgrade-page">
        <section className="database-upgrade-card">
          <h1>Actualización cancelada</h1>
          <p>
            Tu base local permanece intacta. Para usar la aplicación,
            revisa nuevamente las opciones de respaldo o descarte.
          </p>
          <button type="button" onClick={() => setCancelled(false)}>
            Revisar opciones
          </button>
        </section>
      </main>
    )
  }

  return <>{children}</>
}
