import { useCallback, useEffect, useState } from 'react'
import { fetchProgress, getToken, type Progress } from './api'
import ReviewSession from './ReviewSession'

export default function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [progress, setProgress] = useState<Progress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [inSession, setInSession] = useState(false)

  const refresh = useCallback(() => {
    fetchProgress()
      .then(setProgress)
      .catch((e) => {
        // request() clears the token on 401; bounce back to the login page.
        if (getToken() === null) onLogout()
        else setError(e instanceof Error ? e.message : 'Failed to load')
      })
  }, [onLogout])

  useEffect(refresh, [refresh])

  if (inSession) {
    return (
      <ReviewSession
        onFinish={() => {
          setInSession(false)
          refresh()
        }}
      />
    )
  }

  const todo = progress ? progress.due_now + progress.new_remaining_today : 0

  return (
    <div>
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        {error ? (
          <p className="text-center text-sm text-red-700">{error}</p>
        ) : !progress ? (
          <p className="text-center text-slate-400">Loading…</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4 text-center">
              <Stat value={progress.streak_days} label="day streak" accent={progress.streak_days > 0} />
              <Stat value={progress.cards_established} label="words established" />
              <Stat value={progress.reviewed_today} label="reviews today" />
            </div>

            <button
              onClick={() => setInSession(true)}
              disabled={todo === 0}
              className="mt-8 w-full rounded-lg bg-sky-600 py-3.5 text-lg font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {todo > 0 ? `Study now — ${progress.due_now} due, ${progress.new_remaining_today} new` : 'All done for now 🎉'}
            </button>

            <p className="mt-4 text-center text-xs text-slate-400">
              {progress.cards_learning} learning · {progress.cards_established} established ·{' '}
              {progress.total_items} words in course
            </p>
          </>
        )}
      </div>

      <div className="mt-4 text-center">
        <button onClick={onLogout} className="text-sm font-medium text-slate-400 transition hover:text-slate-600">
          Sign out
        </button>
      </div>
    </div>
  )
}

function Stat({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div>
      <div className={`text-3xl font-semibold ${accent ? 'text-sky-600' : 'text-slate-900'}`}>
        {accent ? `🔥 ${value}` : value}
      </div>
      <div className="mt-1 text-xs text-slate-500">{label}</div>
    </div>
  )
}
