import { useEffect, useState, type FormEvent } from 'react'
import { clearToken, fetchHello, getToken, login, type Hello } from './api'

export default function App() {
  const [authed, setAuthed] = useState(() => getToken() !== null)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 text-slate-900 antialiased">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <header className="mb-10 text-center">
          <div className="mb-3 text-5xl">🗝️</div>
          <h1 className="text-3xl font-semibold tracking-tight">LangKey</h1>
          <p className="mt-1 text-sm text-slate-500">Your key to Norwegian</p>
        </header>
        {authed ? (
          <Dashboard onLogout={() => { clearToken(); setAuthed(false) }} />
        ) : (
          <LoginCard onLogin={() => setAuthed(true)} />
        )}
      </div>
    </div>
  )
}

function LoginCard({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('dev@langkey.dev')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(email, password)
      onLogin()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
    >
      <label className="block text-sm font-medium text-slate-700">
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
        />
      </label>
      <label className="mt-4 block text-sm font-medium text-slate-700">
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="langkey-dev"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
        />
      </label>
      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="mt-6 w-full rounded-lg bg-sky-600 py-2.5 font-medium text-white transition hover:bg-sky-700 disabled:opacity-50"
      >
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [hello, setHello] = useState<Hello | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchHello()
      .then(setHello)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load')
        if (getToken() === null) onLogout()
      })
  }, [onLogout])

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      {error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : hello ? (
        <>
          <p className="text-2xl font-medium">{hello.greeting}</p>
          <p className="mt-2 text-slate-500">
            Signed in as <span className="font-medium text-slate-700">{hello.display_name}</span>
          </p>
          <p className="mt-6 text-xs text-slate-400">
            End-to-end slice working: this greeting travelled from Postgres, through the
            LangKey API, to your browser.
          </p>
        </>
      ) : (
        <p className="text-slate-400">Loading…</p>
      )}
      <button
        onClick={onLogout}
        className="mt-6 text-sm font-medium text-sky-600 transition hover:text-sky-800"
      >
        Sign out
      </button>
    </div>
  )
}
