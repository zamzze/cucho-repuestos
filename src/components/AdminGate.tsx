import {
  useState,
  type ReactNode,
} from 'react'

import {
  AlertTriangle,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react'

interface AdminGateProps {
  children: ReactNode
}

/*
  IMPORTANTE:

  Reemplaza el texto de abajo por el SHA-256
  que generaste desde PowerShell.

  NO pongas aquí la contraseña original.
*/
const ADMIN_PASSWORD_HASH =
  '5c21c7fa1fefb3df4f64ebdbdf66a081aa23263aaa7d533921eac93b3ecadad9'

async function sha256(
  value: string,
) {
  const data =
    new TextEncoder().encode(value)

  const hashBuffer =
    await crypto.subtle.digest(
      'SHA-256',
      data,
    )

  return Array.from(
    new Uint8Array(hashBuffer),
  )
    .map((byte) =>
      byte
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
}

export default function AdminGate({
  children,
}: AdminGateProps) {
  const [password, setPassword] =
    useState('')

  const [authenticated, setAuthenticated] =
    useState(false)

  const [confirmed, setConfirmed] =
    useState(false)

  const [error, setError] =
    useState('')

  async function handleLogin(
    event: React.FormEvent,
  ) {
    event.preventDefault()

    setError('')

    const hash =
      await sha256(password)

    if (
      hash !== ADMIN_PASSWORD_HASH
    ) {
      setError(
        'Contraseña incorrecta.',
      )

      return
    }

    setPassword('')
    setAuthenticated(true)
  }

  if (!authenticated) {
    return (
      <main className="gate-page">
        <section className="gate-card">
          <div className="gate-icon">
            <LockKeyhole size={28} />
          </div>

          <span className="gate-eyebrow">
            MPC ADMIN
          </span>

          <h2>
            Acceso de administración
          </h2>

          <p>
            Esta sección permite modificar
            familias, modelos,
            compatibilidades y estados de
            los componentes.
          </p>

          <form
            onSubmit={handleLogin}
            className="gate-form"
          >
            <label>
              Contraseña

              <input
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value,
                  )
                }
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </label>

            {error && (
              <div className="gate-error" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!password}
            >
              <ShieldCheck size={18} />
              Acceder
            </button>
          </form>
        </section>
      </main>
    )
  }

  if (!confirmed) {
    return (
      <main className="gate-page">
        <section className="gate-card warning-card">
          <div className="gate-icon warning">
            <AlertTriangle size={29} />
          </div>

          <span className="gate-eyebrow">
            MODO EDICIÓN
          </span>

          <h2>
            Vas a modificar registros
          </h2>

          <p>
            Los cambios se guardarán en
            la base SQLite local almacenada
            en este dispositivo.
          </p>

          <p>
            Al terminar debes descargar la
            base actualizada para conservar
            y posteriormente publicar los
            cambios.
          </p>

          <div className="gate-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setAuthenticated(false)
                setConfirmed(false)
              }}
            >
              Cancelar
            </button>

            <button
              type="button"
              className="danger-confirm"
              onClick={() =>
                setConfirmed(true)
              }
            >
              Entiendo, continuar
            </button>
          </div>
        </section>
      </main>
    )
  }

  return <>{children}</>
}
