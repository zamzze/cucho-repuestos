import {
  useState,
} from 'react'

import {
  PackageSearch,
  Settings,
} from 'lucide-react'

import AdminGate from './components/AdminGate'
import DatabaseVersionGate from './components/DatabaseVersionGate'
import AdminPage from './pages/AdminPage'
import CatalogPage from './pages/CatalogPage'

type Mode =
  | 'catalog'
  | 'admin'

function App() {
  const [mode, setMode] =
    useState<Mode>('catalog')

  return (
    <DatabaseVersionGate>
    <div className="main-shell">
      <nav className="main-tabs">
        <button
          type="button"
          className={
            mode === 'catalog'
              ? 'active'
              : ''
          }
          aria-pressed={mode === 'catalog'}
          onClick={() =>
            setMode('catalog')
          }
        >
          <PackageSearch
            size={18}
          />

          Catálogo
        </button>

        <button
          type="button"
          className={
            mode === 'admin'
              ? 'active'
              : ''
          }
          aria-pressed={mode === 'admin'}
          onClick={() =>
            setMode('admin')
          }
        >
          <Settings size={18} />

          Administrar
        </button>
      </nav>

      {mode === 'catalog' ? (
        <CatalogPage />
      ) : (
        <AdminGate>
          <AdminPage />
        </AdminGate>
      )}
    </div>
    </DatabaseVersionGate>
  )
}

export default App
