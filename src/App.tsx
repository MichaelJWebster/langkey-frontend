import AudioAlert from './AudioAlert'
import VolumeControl from './VolumeControl'
import { useState, type FormEvent } from 'react'
import { clearToken, getToken, login } from './api'
import Dashboard from './Dashboard'

// Aurora washes behind everything; plain classes can't express these radials.
const AURORA_BG = {
  background:
    'radial-gradient(900px 420px at 75% -10%, rgba(45,212,191,.14), transparent 60%),' +
    'radial-gradient(800px 420px at 20% -14%, rgba(129,140,248,.16), transparent 60%),' +
    '#0b1220',
}

export default function App() {
  const [authed, setAuthed] = useState(() => getToken() !== null)

  return (
    <div className="min-h-screen text-slate-100 antialiased" style={AURORA_BG}>
      <AudioAlert />
      <div className="mx-auto flex min-h-screen w-full flex-col justify-center px-4 py-10 md:w-2/3 md:px-0">
        <header className="relative mb-8 text-center">
          {authed && (
            <div className="mb-3 flex justify-end sm:absolute sm:right-0 sm:top-0 sm:mb-0">
              <VolumeControl />
            </div>
          )}
          <div className="mb-2 text-5xl">🗝️</div>
          <h1 className="bg-gradient-to-r from-teal-300 via-indigo-300 to-pink-300 bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
            LangKey
          </h1>
          <p className="mt-1 text-sm text-slate-400">Your key to Norwegian</p>
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

  const inputClasses =
    'mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-base text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-teal-300/60 focus:ring-2 focus:ring-teal-300/20'

  return (
    <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-white/5 p-8">
      <label className="block text-sm font-medium text-slate-300">
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={inputClasses}
        />
      </label>
      <label className="mt-4 block text-sm font-medium text-slate-300">
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="langkey-dev"
          className={inputClasses}
        />
      </label>
      {error && (
        <p className="mt-3 rounded-lg bg-red-400/10 px-3 py-2 text-sm text-red-300">{error}</p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="mt-6 w-full rounded-lg bg-gradient-to-r from-teal-300 to-indigo-400 py-2.5 font-semibold text-slate-900 transition hover:opacity-90 disabled:opacity-50"
      >
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
