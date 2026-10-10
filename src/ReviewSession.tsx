import { useCallback, useEffect, useRef, useState } from 'react'
import {
  addAlternative,
  fetchQueue,
  postAttempt,
  submitReview,
  type Card,
  type Gloss,
  type QueueOptions,
} from './api'
import DirectionBanner from './Flags'
import { gradeAnswer, ratingFor, type AnswerMark } from './matching'
import { speak } from './speech'

const SPECIAL_CHARS: { char: string; shortcut: string }[] = [
  { char: 'æ', shortcut: "⌥'" },
  { char: 'ø', shortcut: '⌥O' },
  { char: 'å', shortcut: '⌥A' },
]

function SpeakButton({ text, audioUrl, className = '' }: { text: string; audioUrl?: string; className?: string }) {
  return (
    <button
      type="button"
      aria-label={`Speak: ${text}`}
      onClick={(e) => {
        e.stopPropagation()
        void speak(text, audioUrl)
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

function ScoringLegend() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        aria-label="How is my answer marked?"
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
            Type your answer and the card marks itself — how close you were decides when it comes
            back, so there is nothing to grade by hand.
          </p>
          <ul className="space-y-1.5 text-xs text-slate-300">
            <li><span className="font-semibold text-sky-300">Spot on, quickly</span> — jumps much further ahead.</li>
            <li><span className="font-semibold text-emerald-300">Spot on</span> — the gap roughly doubles or triples.</li>
            <li><span className="font-semibold text-amber-300">Nearly</span> — a typo or near-synonym; the gap grows only a little.</li>
            <li><span className="font-semibold text-red-300">Not quite</span> — comes back within the minute.</li>
          </ul>
          <p className="mt-2 text-xs text-slate-500">
            Alternatives and articles are accepted: for "a road, a way" either will do, with or
            without "a". Keys: Enter checks, then Enter again moves on · s speaks the Norwegian.
          </p>
        </div>
      )}
    </>
  )
}

function GlossList({ gloss }: { gloss: Gloss[] }) {
  return (
    <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
      {gloss.map((g) => (
        <li key={g.word} className="flex items-baseline gap-2">
          <span className="font-medium text-slate-200">{g.word}</span>
          <span className="min-w-0 flex-1 truncate text-slate-500">{g.translation}</span>
        </li>
      ))}
    </ul>
  )
}

const MARK_STYLE: Record<string, { label: string; className: string }> = {
  easy: { label: 'Spot on — and quick', className: 'text-sky-300' },
  exact: { label: 'Spot on', className: 'text-emerald-300' },
  close: { label: 'Nearly', className: 'text-amber-300' },
  wrong: { label: 'Not quite', className: 'text-red-300' },
  revealed: { label: 'Revealed', className: 'text-slate-400' },
  counted: { label: 'Counted as correct', className: 'text-emerald-300' },
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
  const [answer, setAnswer] = useState('')
  const [outcome, setOutcome] = useState<{
    mark: AnswerMark | null
    rating: 1 | 2 | 3 | 4
    overridden?: boolean
  } | null>(null)
  const [glossOpen, setGlossOpen] = useState(false)
  const [score, setScore] = useState({ right: 0, near: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const askedAt = useRef<number>(Date.now())
  // Cards rated Again/Hard come due again within the sitting; requeue them locally.
  const requeued = useRef<Card[]>([])
  // The marked-but-unsent review. Holding it until the learner moves on lets
  // "I was right" correct the rating before anything reaches the scheduler.
  const pending = useRef<{ card: Card; rating: 1 | 2 | 3 | 4; mark: AnswerMark | null; answer: string } | null>(null)

  const { focus, direction, mode } = options
  const loadQueue = useCallback(() => {
    setCards(null)
    setIndex(0)
    setAnswer('')
    setOutcome(null)
    setScore({ right: 0, near: 0, total: 0 })
    requeued.current = []
    fetchQueue({ focus, direction, mode })
      .then((q) => setCards(q.cards))
      .catch((e) => setError(e.message))
  }, [focus, direction, mode])

  useEffect(loadQueue, [loadQueue])

  const current = cards && index < cards.length ? cards[index] : null
  const isRecognition = current?.direction === 'recognition'
  // Recognition asks the Norwegian and wants English back; production reverses it.
  const prompt = current ? (isRecognition ? current.item.source_text : current.item.translation) : ''
  const expected = current ? (isRecognition ? current.item.translation : current.item.source_text) : ''

  useEffect(() => {
    askedAt.current = Date.now()
    setGlossOpen(false)
    inputRef.current?.focus()
  }, [index, cards])

  /** Send the held review; nothing reaches the scheduler before this. */
  const flush = useCallback(async () => {
    const held = pending.current
    if (!held) return
    pending.current = null
    try {
      const result = await submitReview(held.card.card_id, held.rating)
      if (result.requeue) requeued.current.push({ ...held.card, is_new: false })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save review')
    }
    postAttempt({
      exercise_type: 'vocab_recall',
      item_id: held.card.item.id,
      correct: held.rating >= 3,
      near_miss: held.rating === 2,
      score: held.mark ? Math.max(0, Math.min(1, held.mark.similarity)) : 0,
      answer: held.mark ? held.answer : undefined,
    }).catch(() => undefined)
  }, [])

  const advance = useCallback(() => {
    flush()
    setAnswer('')
    setOutcome(null)
    setIndex((i) => i + 1)
  }, [flush])

  // Leaving mid-card still records what was marked.
  useEffect(() => () => void flush(), [flush])

  const grade = useCallback(
    (rating: 1 | 2 | 3 | 4, mark: AnswerMark | null) => {
      if (!current || outcome) return
      pending.current = { card: current, rating, mark, answer }
      setOutcome({ mark, rating })
      setScore((s) => ({
        right: s.right + (rating >= 3 ? 1 : 0),
        near: s.near + (rating === 2 ? 1 : 0),
        total: s.total + 1,
      }))
    },
    [current, outcome, answer],
  )

  const check = useCallback(() => {
    if (!current || outcome || !answer.trim()) return
    const mark = gradeAnswer(expected, answer, !isRecognition, current.alternatives)
    grade(ratingFor(mark, Date.now() - askedAt.current), mark)
  }, [current, outcome, answer, expected, isRecognition, grade])

  const reveal = useCallback(() => {
    if (!current || outcome) return
    grade(1, null)
  }, [current, outcome, grade])

  /** "I was right": count this answer, and accept it on this card from now on. */
  const override = useCallback(() => {
    if (!current || !outcome || outcome.overridden || !answer.trim()) return
    const rating = 3 as const
    if (pending.current) pending.current = { ...pending.current, rating }
    setOutcome({ ...outcome, rating, overridden: true })
    setScore((s) => ({
      right: s.right + 1,
      near: s.near - (outcome.rating === 2 ? 1 : 0),
      total: s.total,
    }))
    addAlternative(current.card_id, answer.trim()).catch(() => undefined)
  }, [current, outcome, answer])

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
      if (e.key === 'Enter') {
        e.preventDefault()
        if (outcome) advance()
        else check()
      } else if (e.key === 'Escape') {
        onFinish()
      } else if (e.key === 's' && !(e.target instanceof HTMLInputElement)) {
        void speak(current.item.source_text, current.item.copy_audio_url)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, outcome, check, advance, onFinish])

  function insertChar(ch: string) {
    const el = inputRef.current
    const start = el?.selectionStart ?? answer.length
    const end = el?.selectionEnd ?? start
    setAnswer((v) => v.slice(0, start) + ch + v.slice(end))
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + 1, start + 1)
    })
  }

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
          {score.total > 0 ? `Deck complete — ${score.right} / ${score.total} spot on` : 'Nothing due right now'}
        </p>
        <p className="mt-1 text-sm text-slate-400">
          {score.total > 0
            ? score.near > 0
              ? `Kjempebra! ${score.near} nearly right — those come back sooner.`
              : 'Kjempebra! Grab another deck when you are ready.'
            : emptyMessage}
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

  // One glossary for the whole card: the examples often share words.
  const glossary: Gloss[] = []
  const seen = new Set<string>()
  for (const ex of current.item.examples) {
    for (const g of ex.gloss) {
      if (!seen.has(g.word)) {
        seen.add(g.word)
        glossary.push(g)
      }
    }
  }

  const markKey = !outcome
    ? null
    : outcome.overridden
      ? 'counted'
      : outcome.mark === null
        ? 'revealed'
        : outcome.rating === 4
          ? 'easy'
          : outcome.mark.verdict
  const markStyle = markKey ? MARK_STYLE[markKey] : null
  // Offer the override only where the checker may have been too harsh: a typed
  // answer it didn't accept, not a card that was simply revealed.
  const canOverride =
    !!outcome && !outcome.overridden && outcome.mark !== null && outcome.mark.verdict !== 'exact'

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
          <ScoringLegend />
        </span>
        {current.is_new && (
          <span className="rounded-full bg-sky-400/15 px-2 py-0.5 font-medium text-sky-300">new</span>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
        <DirectionBanner direction={current.direction} />

        <div className="mt-6 flex items-center justify-center gap-2">
          <p className="text-3xl font-semibold tracking-tight">{prompt}</p>
          {isRecognition && (
            <>
              <SpeakButton
                text={current.item.source_text}
                audioUrl={current.item.copy_audio_url}
              />
            </>
          )}
        </div>
        {current.item.pos && (
          <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{current.item.pos}</p>
        )}

        {!outcome ? (
          <div className="mt-6">
            <input
              ref={inputRef}
              autoFocus
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={isRecognition ? 'Type the English…' : 'Type the Norwegian…'}
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-center text-lg text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-teal-300/60 focus:ring-2 focus:ring-teal-300/20"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="flex gap-1.5">
                {!isRecognition &&
                  SPECIAL_CHARS.map(({ char, shortcut }) => (
                    <button
                      key={char}
                      type="button"
                      onClick={() => insertChar(char)}
                      className="rounded-lg border border-white/15 px-3 py-1 text-base font-medium text-slate-200 transition hover:border-teal-300/50 hover:bg-white/10"
                    >
                      {char}
                      <span className="ml-1.5 text-[10px] text-slate-500">{shortcut}</span>
                    </button>
                  ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={reveal}
                  className="rounded-lg border border-white/15 px-4 py-1.5 text-sm font-medium text-slate-400 transition hover:bg-white/10 hover:text-slate-200"
                >
                  I don't know
                </button>
                <button
                  onClick={check}
                  disabled={!answer.trim()}
                  className="rounded-lg bg-gradient-to-r from-teal-300 to-indigo-400 px-5 py-1.5 font-semibold text-slate-900 transition hover:opacity-90 disabled:opacity-40"
                >
                  Check <span className="ml-1 text-xs text-slate-700/70">↵</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 border-t border-white/10 pt-6">
            <p className={`text-sm font-semibold ${markStyle?.className}`}>
              {markStyle?.label}
              {!outcome.overridden && outcome.mark && outcome.mark.verdict !== 'exact' && (
                <span className="ml-2 font-normal text-slate-400">
                  {Math.round(outcome.mark.similarity * 100)}% match
                </span>
              )}
            </p>
            {outcome.mark && outcome.mark.verdict !== 'exact' && (
              <p className="mt-1 text-sm text-slate-500">
                you wrote <span className="text-slate-300">{answer}</span>
                {outcome.overridden && ' — accepted on this card from now on'}
              </p>
            )}
            {canOverride && (
              <button
                onClick={override}
                className="mt-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-400/20"
              >
                I was right — count it
              </button>
            )}

            <div className="mt-3 flex items-center justify-center gap-2">
              <p className="text-2xl text-slate-200">{expected}</p>
              {!isRecognition && (
                <>
                  <SpeakButton
                    text={current.item.source_text}
                    audioUrl={current.item.copy_audio_url}
                  />
                </>
              )}
            </div>

            <ul className="mt-5 space-y-3 text-left">
              {current.item.examples.map((ex) => (
                <li key={ex.sentence} className="flex items-start gap-1.5">
                  <SpeakButton
                    text={ex.sentence}
                    audioUrl={ex.copy_audio_url}
                    className="mt-0.5 shrink-0"
                  />
                  <div>
                    <p className="text-slate-300">{ex.sentence}</p>
                    <p className="text-sm text-slate-500">{ex.translation}</p>
                  </div>
                </li>
              ))}
            </ul>

            {glossary.length > 0 && (
              <>
                {/* Desktop: always visible under the examples. */}
                <div className="mt-5 hidden border-t border-white/10 pt-4 text-left md:block">
                  <p className="mb-2 text-[11px] font-semibold tracking-[.08em] text-slate-500">
                    WORDS IN THESE EXAMPLES YOU HAVEN'T LEARNED YET
                  </p>
                  <GlossList gloss={glossary} />
                </div>

                {/* Phone: a toggle so the card stays short. */}
                <div className="mt-4 text-left md:hidden">
                  <button
                    onClick={() => setGlossOpen((o) => !o)}
                    aria-expanded={glossOpen}
                    className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-teal-300 transition hover:bg-white/10"
                  >
                    {glossOpen ? 'Hide' : 'Show'} new words in these examples ({glossary.length})
                  </button>
                  {glossOpen && (
                    <div className="mt-2 rounded-lg border border-white/10 bg-white/5 p-3">
                      <GlossList gloss={glossary} />
                    </div>
                  )}
                </div>
              </>
            )}

            <button
              onClick={advance}
              className="mt-6 w-full rounded-lg bg-gradient-to-r from-teal-300 to-indigo-400 py-3 font-semibold text-slate-900 transition hover:opacity-90"
            >
              Next <span className="ml-1 text-xs text-slate-700/70">↵</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
