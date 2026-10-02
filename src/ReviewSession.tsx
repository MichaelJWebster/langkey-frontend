import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchQueue, submitReview, type Card, type QueueOptions } from './api'
import { canSpeak, speak } from './speech'

type Rating = 1 | 2 | 3 | 4

const RATINGS: { rating: Rating; label: string; key: string; classes: string }[] = [
  { rating: 1, label: 'Again', key: '1', classes: 'border-red-400/30 bg-red-400/10 text-red-300 hover:bg-red-400/20' },
  { rating: 2, label: 'Hard', key: '2', classes: 'border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20' },
  { rating: 3, label: 'Good', key: '3', classes: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20' },
  { rating: 4, label: 'Easy', key: '4', classes: 'border-sky-400/30 bg-sky-400/10 text-sky-300 hover:bg-sky-400/20' },
]

function SpeakButton({ text, audioUrl, className = '' }: { text: string; audioUrl?: string; className?: string }) {
  if (!canSpeak()) return null
  return (
    <button
      type="button"
      aria-label={`Speak: ${text}`}
      onClick={(e) => {
        e.stopPropagation()
        speak(text, audioUrl)
      }}
      className={`inline-flex items-center justify-center rounded-full p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-teal-300 ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M11 5 6 9H2v6h4l5 4V5z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        <path d="M18.6 5.4a9 9 0 0 1 0 13.2" />
      </svg>
    </button>
  )
}

const RATING_GUIDE: { label: string; color: string; text: string }[] = [
  { label: 'Again', color: 'text-red-300', text: "Couldn't recall it. Comes back in about a minute, and the schedule restarts short." },
  { label: 'Hard', color: 'text-amber-300', text: 'Recalled, but slowly or shakily. The next gap grows only a little.' },
  { label: 'Good', color: 'text-emerald-300', text: 'Recalled with normal effort. The standard choice — the gap roughly doubles or triples.' },
  { label: 'Easy', color: 'text-sky-300', text: 'Instant and effortless. Jumps much further ahead — use sparingly.' },
]

function RatingLegend() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        aria-label="How do the rating buttons work?"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-semibold transition ${
          open ? 'border-teal-300/60 bg-teal-300/10 text-teal-300' : 'border-white/20 text-slate-400 hover:border-teal-300/60 hover:text-teal-300'
        }`}
      >
        i
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-7 z-10 rounded-xl border border-white/15 bg-[#101a2e] p-4 text-left shadow-lg">
          <p className="mb-2 text-xs font-medium text-slate-400">
            Decide your answer before revealing, then grade honestly — each button tells the
            scheduler when to show the card next.
          </p>
          <ul className="space-y-1.5 text-xs text-slate-300">
            {RATING_GUIDE.map((r) => (
              <li key={r.label}>
                <span className={`font-semibold ${r.color}`}>{r.label}</span> — {r.text}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">
            Keys: space reveals · 1–4 grade · s speaks the Norwegian.
          </p>
        </div>
      )}
    </>
  )
}

export default function ReviewSession({
  options = {},
  onFinish,
}: {
  options?: QueueOptions
  onFinish: () => void
}) {
  const [cards, setCards] = useState<Card[] | null>(null)
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [done, setDone] = useState(0)
  const [error, setError] = useState<string | null>(null)
  // Cards rated Again/Hard come due again within the sitting; requeue them locally.
  const requeued = useRef<Card[]>([])

  const { focus, direction, mode } = options
  const loadQueue = useCallback(() => {
    setCards(null)
    setIndex(0)
    setRevealed(false)
    setDone(0)
    requeued.current = []
    fetchQueue({ focus, direction, mode })
      .then((q) => setCards(q.cards))
      .catch((e) => setError(e.message))
  }, [focus, direction, mode])

  useEffect(loadQueue, [loadQueue])

  const current = cards && index < cards.length ? cards[index] : null

  const advance = useCallback(() => {
    setRevealed(false)
    setIndex((i) => i + 1)
  }, [])

  const rate = useCallback(
    async (rating: Rating) => {
      if (!current) return
      setDone((d) => d + 1)
      advance()
      try {
        const result = await submitReview(current.card_id, rating)
        if (result.requeue) {
          requeued.current.push({ ...current, is_new: false })
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save review')
      }
    },
    [current, advance],
  )

  // When the main queue is exhausted, drain locally requeued learning cards.
  useEffect(() => {
    if (cards && index >= cards.length && requeued.current.length > 0) {
      setCards([...cards, ...requeued.current])
      requeued.current = []
    }
  }, [cards, index])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Never react to browser shortcuts (⌘O opens a file dialog, etc.).
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (!current) return
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault()
        setRevealed(true)
      } else if (revealed && ['1', '2', '3', '4'].includes(e.key)) {
        rate(Number(e.key) as Rating)
      } else if (e.key === 'Escape') {
        onFinish()
      } else if (e.key === 's') {
        // Speak the Norwegian side: front for recognition, back once revealed
        // for production.
        if (current.direction === 'recognition' || revealed) speak(current.item.source_text, current.item.audio_url)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, revealed, rate, onFinish])

  if (error) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
        <p className="text-sm text-red-300">{error}</p>
        <button onClick={onFinish} className="mt-4 text-sm font-medium text-teal-300">
          Back
        </button>
      </div>
    )
  }

  if (!cards) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-slate-400">
        Loading session…
      </div>
    )
  }

  if (!current) {
    const emptyMessage =
      mode === 'tricky'
        ? 'No tricky words waiting — everything you have met is on schedule.'
        : direction === 'production'
          ? 'No production cards yet — words unlock here once recognition graduates.'
          : 'Come back later, or tomorrow for new words.'
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
        <div className="text-4xl">🎉</div>
        <p className="mt-3 text-xl font-medium">
          {done > 0 ? `Deck complete — ${done} cards reviewed` : 'Nothing due right now'}
        </p>
        <p className="mt-1 text-sm text-slate-400">
          {done > 0 ? 'Kjempebra! Grab another deck when you are ready.' : emptyMessage}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={loadQueue}
            className="rounded-lg bg-gradient-to-r from-teal-300 to-indigo-400 px-6 py-2.5 font-semibold text-slate-900 transition hover:opacity-90"
          >
            Another deck
          </button>
          <button
            onClick={onFinish}
            className="rounded-lg border border-white/15 px-6 py-2.5 font-medium text-slate-300 transition hover:border-white/30 hover:text-slate-100"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  const isRecognition = current.direction === 'recognition'
  const front = isRecognition ? current.item.source_text : current.item.translation
  const back = isRecognition ? current.item.translation : current.item.source_text

  return (
    <div>
      <div className="relative mb-4 flex items-center justify-between text-xs text-slate-400">
        <span className="flex items-center gap-2">
          <button
            onClick={onFinish}
            aria-label="End this deck"
            title="End this deck (Esc)"
            className="rounded-full px-1.5 py-0.5 font-medium transition hover:bg-white/10 hover:text-slate-200"
          >
            ← End deck
          </button>
          {index + 1} / {cards.length}
          <RatingLegend />
        </span>
        <span className="flex items-center gap-2">
          {current.is_new && (
            <span className="rounded-full bg-sky-400/15 px-2 py-0.5 font-medium text-sky-300">new</span>
          )}
          <span className="rounded-full bg-white/10 px-2 py-0.5">
            {isRecognition ? 'norsk → english' : 'english → norsk'}
          </span>
        </span>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
        <div className="flex items-center justify-center gap-2">
          <p className="text-3xl font-semibold tracking-tight">{front}</p>
          {isRecognition && <SpeakButton text={current.item.source_text} audioUrl={current.item.audio_url} />}
        </div>
        {current.item.pos && (
          <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{current.item.pos}</p>
        )}

        {revealed ? (
          <div className="mt-6 border-t border-white/10 pt-6">
            <div className="flex items-center justify-center gap-2">
              <p className="text-2xl text-slate-200">{back}</p>
              {!isRecognition && <SpeakButton text={current.item.source_text} audioUrl={current.item.audio_url} />}
            </div>
            <ul className="mt-5 space-y-3 text-left">
              {current.item.examples.map((ex) => (
                <li key={ex.sentence} className="flex items-start gap-1.5">
                  <SpeakButton text={ex.sentence} audioUrl={ex.audio_url} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="text-slate-300">{ex.sentence}</p>
                    <p className="text-sm text-slate-500">{ex.translation}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <button
            onClick={() => setRevealed(true)}
            className="mt-8 w-full rounded-lg bg-gradient-to-r from-teal-300 to-indigo-400 py-3 font-semibold text-slate-900 transition hover:opacity-90"
          >
            Show answer
            <span className="ml-2 text-xs text-slate-700/70">space</span>
          </button>
        )}
      </div>

      {revealed && (
        <div className="mt-4 grid grid-cols-4 gap-2">
          {RATINGS.map(({ rating, label, key, classes }) => (
            <button
              key={rating}
              onClick={() => rate(rating)}
              className={`rounded-lg border py-3 text-sm font-medium transition ${classes}`}
            >
              {label}
              <span className="mt-0.5 block text-[10px] opacity-60">{key}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
