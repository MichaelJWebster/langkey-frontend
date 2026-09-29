import { useState, type FormEvent } from 'react'
import { clearToken, getToken, login } from './api'
import Dashboard from './Dashboard'

export default function App() {
  const [authed, setAuthed] = useState(() => getToken() !== null)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 text-slate-900 antialiased">
      <div className="mx-auto flex min-h-screen w-full flex-col justify-center px-6 py-12 md:w-2/3 md:px-0">
        <header className="mb-10 text-center">
          <div className="mb-3 text-5xl">🗝️</div>
          <h1 className="text-3xl font-semibold tracking-tight">LangKey</h1>
          <p className="mt-1 text-sm text-slate-500">Your key to Norwegian</p>
        </header>
        {authed ? (
          <Dashboard onLogout={() => { clearToken(); setAuthed(false) }} />
        ) : (
          <div className="mx-auto w-full max-w-md">
            <LoginCard onLogin={() => setAuthed(true)} />
          </div>
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
