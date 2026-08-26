import {
  useState,
} from 'react'

import {
  PackageSearch,
  Settings,
} from 'lucide-react'

import AdminGate from './components/AdminGate'
import AdminPage from './pages/AdminPage'
import CatalogPage from './pages/CatalogPage'

type Mode =
  | 'catalog'
  | 'admin'

function App() {
  const [mode, setMode] =
    useState<Mode>('catalog')

  return (
    <div className="main-shell">
      <nav className="main-tabs">
        <button
          type="button"
          className={
            mode === 'catalog'
              ? 'active'
              : ''
          }
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
  )
}

export default App