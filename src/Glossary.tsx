import { useEffect, useMemo, useState } from 'react'
import { fetchGlossary, type GlossaryEntry } from './api'
import { speak } from './speech'

const STATUS_STYLE: Record<string, string> = {
  established: 'bg-emerald-400/15 text-emerald-300',
  learning: 'bg-amber-400/15 text-amber-300',
  seen: 'bg-white/10 text-slate-400',
}

const STATUS_LABEL: Record<string, string> = {
  established: 'established',
  learning: 'learning',
  seen: 'seen in examples',
}

export default function Glossary({ onBack }: { onBack: () => void }) {
  const [entries, setEntries] = useState<GlossaryEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetchGlossary()
      .then(setEntries)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [])

  const filtered = useMemo(() => {
    if (!entries) return []
    const q = query.trim().toLowerCase()
    if (!q) return entries
    return entries.filter(
      (e) => e.word.toLowerCase().includes(q) || e.translation.toLowerCase().includes(q),
    )
  }, [entries, query])

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Glossary{' '}
          {entries && <span className="text-sm font-normal text-slate-500">({entries.length} words met)</span>}
        </h2>
        <button onClick={onBack} className="text-sm font-medium text-teal-300 hover:text-teal-200">
          ← Back
        </button>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search Norwegian or English…"
        className="mb-4 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-base text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-teal-300/60 focus:ring-2 focus:ring-teal-300/20"
      />

      <div className="rounded-2xl border border-white/10 bg-white/5">
        {error ? (
          <p className="p-6 text-center text-sm text-red-300">{error}</p>
        ) : !entries ? (
          <p className="p-6 text-center text-slate-400">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-400">
            {entries.length === 0
              ? 'Words appear here as you meet them in study sessions.'
              : 'No matches.'}
          </p>
        ) : (
          <ul className="divide-y divide-white/10">
            {filtered.map((e) => (
              <li key={e.word + e.translation} className="flex items-center gap-3 px-4 py-2.5">
                <button
                  type="button"
                  aria-label={`Speak: ${e.word}`}
                  onClick={() => speak(e.word, e.audio_url)}
                  className="shrink-0 rounded-full p-1 text-slate-400 transition hover:bg-white/10 hover:text-teal-300"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <path d="M11 5 6 9H2v6h4l5 4V5z" />
                    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                  </svg>
                </button>
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{e.word}</span>
                  <span className="ml-2 text-sm text-slate-400">{e.translation}</span>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[e.status]}`}>
                  {STATUS_LABEL[e.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
