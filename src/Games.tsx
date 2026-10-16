// Games: gamified practice, kept apart from the measured skills.
//
// Three levels, the same shape as Reading: subsections -> sets -> play. There
// is one subsection (Flashcards) and one set (Question words) for now, and the
// structure exists because Michael said there would be several.
//
// A subsection is named after the game kind the backend stores on each set, so
// adding a kind to the content file adds a subsection here with no code
// change — the same bargain the reading library makes with its `kind`.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchGames, postGameRound, type GameSet } from './api'
import { deal, labelOf, type Card } from './matching-game'

const SUBSECTIONS: { game: string; label: string; blurb: string }[] = [
  {
    game: 'matching',
    label: 'Flashcards',
    blurb: 'Match each English word to its Norwegian equivalent',
  },
]

const labelForGame = (game: string) =>
  SUBSECTIONS.find((s) => s.game === game)?.label ??
  game.charAt(0).toUpperCase() + game.slice(1)

export default function Games({ onBack }: { onBack: () => void }) {
  const [sets, setSets] = useState<GameSet[] | null>(null)
  const [game, setGame] = useState<string | null>(null)
  const [open, setOpen] = useState<GameSet | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    fetchGames()
      .then((r) => setSets(r.sets))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [])

  useEffect(load, [load])

  // Escape walks back one level at a time, as everywhere else.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (open) setOpen(null)
      else if (game) setGame(null)
      else onBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack, open, game])

  const kinds = useMemo(() => {
    const seen = new Map<string, GameSet[]>()
    for (const s of sets ?? []) {
      const list = seen.get(s.game)
      if (list) list.push(s)
      else seen.set(s.game, [s])
    }
    return seen
  }, [sets])

  function back() {
    if (open) setOpen(null)
    else if (game) setGame(null)
    else onBack()
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between text-xs text-slate-400">
        <button
          onClick={back}
          title="Back (Esc)"
          className="rounded-full px-1.5 py-0.5 font-medium transition hover:bg-white/10 hover:text-slate-200"
        >
          {open ? '← Sets' : game ? '← Games' : '← Back'}
        </button>
        <span>Play with what you are learning</span>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
        <h1 className="text-xl font-semibold">
          🎲 Games
          {game && <span className="text-slate-400"> · {labelForGame(game)}</span>}
          {open && <span className="text-slate-400"> · {open.title}</span>}
        </h1>
        {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
        {!sets && !error && <p className="mt-4 text-slate-400">Loading…</p>}

        {sets && !game && !open && (
          <SubsectionIndex kinds={kinds} onPick={setGame} />
        )}

        {sets && game && !open && (
          <SetList sets={kinds.get(game) ?? []} onOpen={setOpen} />
        )}

        {open && (
          <Matching
            key={open.slug}
            set={open}
            onDone={load}
            onLeave={() => setOpen(null)}
          />
        )}
      </div>
    </div>
  )
}

// --- The subsections ---------------------------------------------------------

function SubsectionIndex({
  kinds,
  onPick,
}: {
  kinds: Map<string, GameSet[]>
  onPick: (game: string) => void
}) {
  if (kinds.size === 0) {
    return (
      <p className="mt-4 text-slate-300">
        No games yet — add a set to{' '}
        <code className="text-slate-400">data/games_nb.jsonl</code> in the backend.
      </p>
    )
  }
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      {[...kinds.entries()].map(([game, sets]) => (
        <button
          key={game}
          onClick={() => onPick(game)}
          className="rounded-xl border border-white/15 p-4 text-left transition hover:border-fuchsia-400/50 hover:bg-white/10"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-medium text-slate-100">{labelForGame(game)}</span>
            <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-300">
              {sets.length} {sets.length === 1 ? 'set' : 'sets'}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-slate-400">
            {SUBSECTIONS.find((s) => s.game === game)?.blurb ?? ''}
          </p>
        </button>
      ))}
    </div>
  )
}

// --- The sets in one subsection ----------------------------------------------

function SetList({
  sets,
  onOpen,
}: {
  sets: GameSet[]
  onOpen: (s: GameSet) => void
}) {
  return (
    <div className="mt-4 grid gap-3">
      {sets.map((s) => (
        <button
          key={s.slug}
          onClick={() => onOpen(s)}
          className="rounded-xl border border-white/15 p-4 text-left transition hover:border-fuchsia-400/50 hover:bg-white/10"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-medium text-slate-100">{s.title}</span>
            <span className="shrink-0 text-xs text-slate-400">
              {s.pairs.length} pairs
            </span>
          </div>
          <p className="mt-0.5 text-sm text-slate-400">{s.description}</p>
          <p className="mt-2 text-xs text-slate-500">
            {s.best ? (
              <>
                Best:{' '}
                <span className="text-emerald-300">
                  {s.pairs.length - s.best.mistakes >= s.pairs.length
                    ? 'no mistakes'
                    : `${s.best.mistakes} ${s.best.mistakes === 1 ? 'mistake' : 'mistakes'}`}
                </span>
                {' · '}
                {formatSeconds(s.best.seconds)} · played {s.played}{' '}
                {s.played === 1 ? 'time' : 'times'}
              </>
            ) : (
              'not played yet'
            )}
          </p>
        </button>
      ))}
    </div>
  )
}

function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const m = Math.floor(seconds / 60)
  return `${m}m ${String(Math.round(seconds - m * 60)).padStart(2, '0')}s`
}

// --- The round ---------------------------------------------------------------

export function Matching({
  set,
  onDone,
  onLeave,
}: {
  set: GameSet
  onDone: () => void
  onLeave: () => void
}) {
  const [board, setBoard] = useState(() => deal(set.pairs))
  const [picked, setPicked] = useState<Card | null>(null)
  const [matched, setMatched] = useState<Set<number>>(new Set())
  const [wrong, setWrong] = useState<number[]>([])
  const [mistakes, setMistakes] = useState(0)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const posted = useRef(false)

  const done = matched.size === set.pairs.length

  // The clock starts on the first pick, not on arrival: time spent reading the
  // board before committing is not time lost.
  useEffect(() => {
    if (startedAt === null || done) return
    const id = window.setInterval(
      () => setElapsed((Date.now() - startedAt) / 1000),
      200,
    )
    return () => window.clearInterval(id)
  }, [startedAt, done])

  useEffect(() => {
    if (!done || posted.current) return
    posted.current = true
    // Fire and forget: a flaky network must not cost him the round he just
    // finished, and the next fetch re-reads the real best.
    postGameRound(set.slug, mistakes, Math.max(0.1, elapsed))
      .then(onDone)
      .catch(() => undefined)
  }, [done, mistakes, elapsed, set.slug, onDone])

  function pick(card: Card) {
    if (done || matched.has(card.key)) return
    if (startedAt === null) setStartedAt(Date.now())

    if (picked === null || picked.side === card.side) {
      // Nothing chosen yet, or switching to another card on the same side.
      setPicked(card)
      return
    }
    if (picked.key === card.key) {
      setMatched((m) => new Set(m).add(card.key))
      setPicked(null)
      return
    }
    // Wrong: flash both, count it once, and clear so the next tap starts over.
    setMistakes((n) => n + 1)
    setWrong([picked.key, card.key])
    setPicked(null)
    window.setTimeout(() => setWrong([]), 450)
  }

  function again() {
    posted.current = false
    setBoard(deal(set.pairs))
    setPicked(null)
    setMatched(new Set())
    setWrong([])
    setMistakes(0)
    setStartedAt(null)
    setElapsed(0)
  }

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-slate-400">
        <p>{set.description}</p>
        <p className="tabular-nums">
          {matched.size}/{set.pairs.length} matched · {mistakes}{' '}
          {mistakes === 1 ? 'mistake' : 'mistakes'} · {formatSeconds(elapsed)}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-5">
        <Column
          heading="English"
          cards={board.left}
          picked={picked}
          matched={matched}
          wrong={wrong}
          onPick={pick}
        />
        <Column
          heading="Norsk"
          cards={board.right}
          picked={picked}
          matched={matched}
          wrong={wrong}
          onPick={pick}
        />
      </div>

      {done && (
        <div className="mt-6 text-center">
          <p className="text-2xl font-semibold text-slate-100">
            {mistakes === 0 ? 'Perfect — no mistakes' : `${mistakes} ${mistakes === 1 ? 'mistake' : 'mistakes'}`}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            {set.pairs.length} pairs in {formatSeconds(elapsed)}
            {set.best && (
              <>
                {' · '}
                best so far: {set.best.mistakes}{' '}
                {set.best.mistakes === 1 ? 'mistake' : 'mistakes'},{' '}
                {formatSeconds(set.best.seconds)}
              </>
            )}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button
              onClick={again}
              className="min-h-11 rounded-lg bg-fuchsia-600 px-6 font-medium text-white transition hover:bg-fuchsia-700"
            >
              Play again
            </button>
            <button
              onClick={onLeave}
              className="min-h-11 rounded-lg border border-white/15 px-6 font-medium text-slate-300 transition hover:bg-white/10"
            >
              Back to sets
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Column({
  heading,
  cards,
  picked,
  matched,
  wrong,
  onPick,
}: {
  heading: string
  cards: Card[]
  picked: Card | null
  matched: Set<number>
  wrong: number[]
  onPick: (card: Card) => void
}) {
  return (
    <div>
      <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">{heading}</p>
      <ul className="grid gap-2">
        {cards.map((card) => {
          const isMatched = matched.has(card.key)
          const isPicked = picked?.key === card.key && picked.side === card.side
          const isWrong = wrong.includes(card.key)
          return (
            <li key={`${card.side}-${card.key}`}>
              <button
                onClick={() => onPick(card)}
                disabled={isMatched}
                aria-pressed={isPicked}
                className={`w-full rounded-xl border px-3 py-3 text-center font-medium transition ${
                  isMatched
                    ? 'cursor-default border-emerald-400/30 bg-emerald-400/10 text-emerald-300/60'
                    : isWrong
                      ? 'border-rose-400/70 bg-rose-400/15 text-rose-200'
                      : isPicked
                        ? 'border-fuchsia-400 bg-fuchsia-400/15 text-fuchsia-100'
                        : 'border-white/15 bg-white/5 text-slate-100 hover:border-white/35 hover:bg-white/10'
                }`}
              >
                {labelOf(card)}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
