import { useCallback, useEffect, useState } from 'react'
import { fetchProgress, fetchTopics, getToken, type Progress, type Topic } from './api'
import Glossary from './Glossary'
import ListeningSession from './ListeningSession'
import Reading from './Reading'
import ReviewSession from './ReviewSession'

const FOCUS_KEY = 'langkey.focus'

function getStoredFocus(): string | null {
  try {
    return localStorage.getItem(FOCUS_KEY)
  } catch {
    return null
  }
}

export default function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [progress, setProgress] = useState<Progress | null>(null)
  const [topics, setTopics] = useState<Topic[]>([])
  const [focus, setFocus] = useState<string | null>(getStoredFocus)
  const [error, setError] = useState<string | null>(null)
  const [inSession, setInSession] = useState(false)
  const [inGlossary, setInGlossary] = useState(false)
  const [inListening, setInListening] = useState(false)
  const [inReading, setInReading] = useState(false)

  const refresh = useCallback(() => {
    Promise.all([fetchProgress(), fetchTopics()])
      .then(([p, t]) => {
        setProgress(p)
        setTopics(t)
      })
      .catch((e) => {
        // request() clears the token on 401; bounce back to the login page.
        if (getToken() === null) onLogout()
        else setError(e instanceof Error ? e.message : 'Failed to load')
      })
  }, [onLogout])

  useEffect(refresh, [refresh])

  function chooseFocus(topic: string | null) {
    setFocus(topic)
    try {
      if (topic) localStorage.setItem(FOCUS_KEY, topic)
      else localStorage.removeItem(FOCUS_KEY)
    } catch {
      // localStorage unavailable — focus just won't persist.
    }
  }

  if (inGlossary) {
    return <Glossary onBack={() => setInGlossary(false)} />
  }

  if (inReading) {
    return <Reading onBack={() => setInReading(false)} />
  }

  if (inListening) {
    return (
      <ListeningSession
        onFinish={() => {
          setInListening(false)
          refresh()
        }}
      />
    )
  }

  if (inSession) {
    return (
      <ReviewSession
        focus={focus}
        onFinish={() => {
          setInSession(false)
          refresh()
        }}
      />
    )
  }

  const todo = progress ? progress.due_now + progress.new_available : 0
  const focusTopic = topics.find((t) => t.topic === focus)

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

            <div className="mt-6">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                Focus for new words
              </p>
              <div className="flex flex-wrap gap-1.5">
                <FocusChip
                  label="No focus — by frequency"
                  active={focus === null}
                  onClick={() => chooseFocus(null)}
                />
                {topics
                  .filter((t) => t.remaining > 0)
                  .map((t) => (
                    <FocusChip
                      key={t.topic}
                      label={`${t.label} (${t.remaining})`}
                      active={focus === t.topic}
                      onClick={() => chooseFocus(t.topic)}
                    />
                  ))}
              </div>
            </div>

            <button
              onClick={() => setInSession(true)}
              disabled={todo === 0}
              className="mt-6 w-full rounded-lg bg-sky-600 py-3.5 text-lg font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {todo > 0
                ? `Study now — ${progress.due_now} due${
                    focusTopic ? ` · new: ${focusTopic.label.toLowerCase()}` : ' · new words ready'
                  }`
                : 'All done for now 🎉'}
            </button>

            <button
              onClick={() => setInListening(true)}
              disabled={progress.cards_learning + progress.cards_established === 0}
              className="mt-2 w-full rounded-lg border border-sky-200 py-2.5 font-medium text-sky-700 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              🎧 Listening practice
            </button>

            <button
              onClick={() => setInReading(true)}
              className="mt-2 w-full rounded-lg border border-sky-200 py-2.5 font-medium text-sky-700 transition hover:bg-sky-50"
            >
              📖 Reading
            </button>

            <p className="mt-4 text-center text-xs text-slate-400">
              {progress.cards_learning} learning · {progress.cards_established} established ·{' '}
              {progress.total_items} words in course
            </p>
          </>
        )}
      </div>

      <div className="mt-4 flex items-center justify-center gap-6 text-center">
        <button onClick={() => setInGlossary(true)} className="text-sm font-medium text-sky-600 transition hover:text-sky-800">
          Glossary
        </button>
        <button onClick={onLogout} className="text-sm font-medium text-slate-400 transition hover:text-slate-600">
          Sign out
        </button>
      </div>
    </div>
  )
}

function FocusChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        active
          ? 'border-sky-500 bg-sky-50 text-sky-700'
          : 'border-slate-200 text-slate-500 hover:border-sky-300 hover:text-sky-600'
      }`}
    >
      {label}
    </button>
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
