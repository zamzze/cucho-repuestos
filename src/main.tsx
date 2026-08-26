import {
  StrictMode,
} from 'react'

import {
  createRoot,
} from 'react-dom/client'

import './index.css'

import App from './App'

import {
  initDatabase,
} from './db/sqlite'

async function bootstrap() {
  const db =
    await initDatabase()

  const result =
    db.exec(`
      SELECT
        COUNT(*)
      FROM parts
    `)

  console.log(
    'MPC SQLite:',
    result[0]?.values[0]?.[0],
    'repuestos',
  )

  createRoot(
    document.getElementById(
      'root',
    )!,
  ).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

bootstrap().catch(
  (error) => {
    console.error(
      'Error iniciando MPC:',
      error,
    )
  },
)