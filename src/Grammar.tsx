// Grammar practice: topics -> rules -> rounds of ten exercises.
//
// Michael: *"Could we perhaps have different sections within V2 word order? So
// I click on a section ... and it takes me to exercises for that particular
// grammar rule"*, and *"one exercise at a time, completing it gets to the next
// exercise. 10 exercises before we ask if the user wants to continue, or go
// back to the grammar exercises menu page."*
//
// A topic with several units (V2 word order) opens a menu of them, each card
// carrying its own diagram. A topic with one unit goes straight to practice.
// The rule for whatever is being practised sits above the exercise (RuleSheet).
//
// Answers are marked here, as dictation's are: a grammar answer is
// near-unique, so the exercise carries its accepted answers and the result is
// posted for the record.

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import {
  fetchGrammar,
  fetchGrammarRound,
  postGrammarAttempt,
  type GrammarExercise,
  type GrammarRound,
  type GrammarTopic,
  type GrammarUnit,
} from './api'
import { checkGrammar, normalise, type GrammarVerdict } from './grammar-check'
import { RULES, V2_INTRO } from './grammarRules'
import RuleSheet, { type Seek } from './RuleSheet'
import { TermText } from './Term'

type View =
  | { page: 'menu' }
  | { page: 'topic'; topic: string }
  | { page: 'practice'; topic: string; unit: string }

const ROUND = 10

export default function Grammar({ onBack }: { onBack: () => void }) {
  const [topics, setTopics] = useState<GrammarTopic[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>({ page: 'menu' })

  const load = useCallback(() => {
    fetchGrammar()
      .then((r) => setTopics(r.topics))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [])
  useEffect(load, [load])

  const topic = view.page === 'menu' ? null : (topics?.find((t) => t.slug === view.topic) ?? null)

  // Up one level. A one-unit topic has no menu of its own to return to.
  const up = useCallback(() => {
    if (view.page === 'practice' && topic && topic.units.length > 1) {
      setView({ page: 'topic', topic: view.topic })
    } else if (view.page !== 'menu') setView({ page: 'menu' })
    else onBack()
    load()
    window.scrollTo({ top: 0 })
  }, [view, topic, onBack, load])

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Escape inside an answer box means "leave", not "clear the box".
      up()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [up])

  const open = (t: GrammarTopic) => {
    setView(t.units.length > 1 ? { page: 'topic', topic: t.slug } : { page: 'practice', topic: t.slug, unit: t.units[0].slug })
    window.scrollTo({ top: 0 })
  }

  const backLabel =
    view.page === 'menu' ? '← Back' : view.page === 'practice' && topic && topic.units.length > 1 ? `← ${topic.title}` : '← Grammar'

  return (
    <div>
      <div className="mb-4 flex items-center justify-between text-xs text-slate-400">
        <button
          onClick={up}
          title="Back (Esc)"
          className="rounded-full px-1.5 py-0.5 font-medium transition hover:bg-white/10 hover:text-slate-200"
        >
          {backLabel}
        </button>
        <span>One rule at a time</span>
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}
      {!topics && !error && <p className="text-slate-400">Loading…</p>}

      {topics && view.page === 'menu' && <TopicMenu topics={topics} onOpen={open} />}

      {topic && view.page === 'topic' && (
        <UnitMenu
          topic={topic}
          onOpen={(u) => {
            setView({ page: 'practice', topic: topic.slug, unit: u.slug })
            window.scrollTo({ top: 0 })
          }}
        />
      )}

      {topic && view.page === 'practice' && (
        <Practice
          key={`${view.topic}/${view.unit}`}
          topic={topic}
          unit={view.unit}
          onLeave={up}
          leaveLabel={topic.units.length > 1 ? `Back to ${topic.title}` : 'Back to grammar topics'}
        />
      )}
    </div>
  )
}

// --- Menus ----------------------------------------------------------------------

function Stat({ unit }: { unit: Pick<GrammarUnit, 'seen' | 'right' | 'total'> }) {
  return unit.seen ? (
    <span>
      <b className="font-semibold text-teal-300">{unit.right}</b> of {unit.seen} right
    </span>
  ) : (
    <span>{unit.total} exercises</span>
  )
}

const cardClass =
  'flex cursor-pointer flex-col gap-2.5 rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-teal-300/45 hover:bg-white/10'

/** Cards are divs rather than buttons so the grammar terms inside them stay
 *  tappable: a button cannot contain another interactive element. */
function cardProps(onOpen: () => void) {
  return {
    role: 'button',
    tabIndex: 0,
    onClick: (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-term]')) onOpen()
    },
    onKeyDown: (e: KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
        e.preventDefault()
        onOpen()
      }
    },
  }
}

function TopicMenu({ topics, onOpen }: { topics: GrammarTopic[]; onOpen: (t: GrammarTopic) => void }) {
  if (topics.length === 0) {
    return (
      <p className="text-slate-300">
        No grammar yet — add topics to <code className="text-slate-400">data/grammar_nb.json</code> in
        the backend.
      </p>
    )
  }
  return (
    <>
      <h1 className="text-2xl font-semibold">Grammar practice</h1>
      <p className="mb-5 mt-1 max-w-prose text-sm text-slate-400">
        Pick a topic. Each one shows a picture of the rule above the exercises, which come one at a
        time, ten to a round.
      </p>
      <div className="grid gap-3 lg:grid-cols-2">
        {topics.map((t) => {
          const many = t.units.length > 1
          return (
            <div key={t.slug} className={cardClass} {...cardProps(() => onOpen(t))}>
              <h2 className="text-base font-semibold">{t.title}</h2>
              <p className="text-[13.5px] text-slate-400">{t.blurb}</p>
              <div className="mt-auto flex items-center justify-between gap-2 text-[12.5px] text-slate-400">
                {many ? (
                  <span className="rounded-full border border-white/20 px-2 py-px text-[11px] text-slate-300">
                    {t.units.filter((u) => !u.review).length} rules
                    {t.units.some((u) => u.review) && ' + review'}
                  </span>
                ) : (
                  <Stat unit={t.units[0]} />
                )}
                <span className="font-semibold text-teal-300">{many ? 'Open' : 'Practise'} →</span>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

function UnitMenu({ topic, onOpen }: { topic: GrammarTopic; onOpen: (u: GrammarUnit) => void }) {
  // Rules are numbered in teaching order; the review is starred, not counted.
  const steps = new Map(topic.units.filter((u) => !u.review).map((u, i) => [u.slug, i + 1]))
  return (
    <>
      <h1 className="text-2xl font-semibold">{topic.title}</h1>
      <p className="mb-5 mt-1 max-w-prose text-sm text-slate-400">
        {topic.slug === 'v2' ? V2_INTRO : topic.blurb}
      </p>
      <div className="grid gap-3">
        {topic.units.map((u) => {
          const rule = RULES[`${topic.slug}/${u.slug}`]
          return (
            <div key={u.slug} className={cardClass} {...cardProps(() => onOpen(u))}>
              <div className="flex items-baseline gap-2.5">
                <span className="shrink-0 text-xs tabular-nums text-slate-500">{u.review ? '★' : steps.get(u.slug)}</span>
                <h2 className="flex-1 text-base font-semibold">{u.title}</h2>
              </div>
              <p className="text-[13.5px] text-slate-400">{u.blurb}</p>
              {rule?.card}
              <div className="flex items-center justify-between gap-2 text-[12.5px] text-slate-400">
                <Stat unit={u} />
                <span className="font-semibold text-teal-300">Practise →</span>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

// --- Practice -------------------------------------------------------------------

function Practice({
  topic,
  unit,
  onLeave,
  leaveLabel,
}: {
  topic: GrammarTopic
  unit: string
  onLeave: () => void
  leaveLabel: string
}) {
  const [round, setRound] = useState<GrammarRound | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [at, setAt] = useState(0)
  const [outcomes, setOutcomes] = useState<boolean[]>([])
  const [seek, setSeek] = useState<Seek | null>(null)
  const [roundNo, setRoundNo] = useState(0)

  // Each round is shuffled server-side, so two fetches in flight (StrictMode
  // runs the effect twice) return different rounds. Only the latest counts;
  // otherwise the first card could keep state from the other round's first.
  const latest = useRef(0)
  const start = useCallback(() => {
    const id = ++latest.current
    setRound(null)
    setAt(0)
    setOutcomes([])
    setSeek(null)
    fetchGrammarRound(topic.slug, unit)
      .then((r) => {
        if (id !== latest.current) return
        setRound(r)
        setRoundNo((n) => n + 1)
      })
      .catch((e) => id === latest.current && setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [topic.slug, unit])
  useEffect(start, [start])

  const key = `${topic.slug}/${unit}`
  const rule = RULES[key] ?? {
    headline: topic.title,
    body: <p className="text-sm text-slate-400">No diagram for this rule yet.</p>,
    mini: <div className="text-sm">{topic.title}</div>,
  }
  const title = topic.units.length > 1 ? (topic.units.find((u) => u.slug === unit)?.title ?? topic.title) : topic.title
  const size = round?.exercises.length ?? ROUND
  const done = round !== null && at >= size

  const header = (
    <>
      <div className="flex items-center gap-2.5">
        <span className="min-w-0 flex-1 text-[15px] font-semibold">{title}</span>
        <span className="shrink-0 text-[12.5px] tabular-nums text-slate-400">
          {Math.min(at + 1, size)} of {size}
        </span>
      </div>
      <div className="mt-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }} aria-hidden>
        {Array.from({ length: size }, (_, i) => (
          <i
            key={i}
            className={`h-1 rounded ${
              outcomes[i] === true
                ? 'bg-emerald-300'
                : outcomes[i] === false
                  ? 'bg-rose-300'
                  : i === at && !done
                    ? 'bg-teal-300'
                    : 'bg-white/10'
            }`}
          />
        ))}
      </div>
    </>
  )

  return (
    <>
      <RuleSheet rule={rule} seek={seek} header={header} />
      <div className="mt-[18px]">
        {error && <p className="text-sm text-red-300">{error}</p>}
        {!round && !error && <p className="text-slate-400">Loading…</p>}
        {round && round.exercises.length === 0 && <p className="text-slate-300">This rule has no exercises yet.</p>}
        {round && !done && round.exercises[at] && (
          <ExerciseCard
            key={`${roundNo}-${at}`}
            ex={round.exercises[at]}
            last={at === size - 1}
            onAnswered={(ok) => setOutcomes((o) => [...o.slice(0, at), ok])}
            onNext={() => {
              setAt((n) => n + 1)
              window.scrollTo({ top: 0 })
            }}
            onSeeRule={(ref) => setSeek((s) => ({ ref, n: (s?.n ?? 0) + 1 }))}
            refFor={(ex) => ex.ref ?? (unit === ex.unit ? 'p' : ex.unit)}
          />
        )}
        {round && done && (
          <RoundDone
            round={round}
            outcomes={outcomes}
            onMore={() => {
              start()
              window.scrollTo({ top: 0 })
            }}
            onLeave={onLeave}
            leaveLabel={leaveLabel}
          />
        )}
      </div>
    </>
  )
}

const KIND_LABEL: Record<GrammarExercise['kind'], string> = {
  transform: 'Transform',
  build: 'Build',
  fill: 'Fill in',
  choose: 'Choose',
  fix: 'Spot and fix',
}

function Prompt({ ex }: { ex: GrammarExercise }) {
  if (!ex.prompt) return null
  const [before, after] = ex.prompt.split('___')
  return (
    <p className="mb-3.5 break-words text-xl font-medium">
      {before}
      {after !== undefined && (
        <>
          <span className="font-semibold text-teal-300">___</span>
          {after}
        </>
      )}
      {ex.hint && <span className="text-sm font-normal text-slate-400"> {ex.hint}</span>}
      {ex.cue && (
        <>
          <span className="text-sm font-normal text-slate-400"> → </span>
          <span className="font-semibold text-teal-300">{ex.cue}</span>
        </>
      )}
    </p>
  )
}

function ExerciseCard({
  ex,
  last,
  onAnswered,
  onNext,
  onSeeRule,
  refFor,
}: {
  ex: GrammarExercise
  last: boolean
  onAnswered: (correct: boolean) => void
  onNext: () => void
  onSeeRule: (ref: string) => void
  refFor: (ex: GrammarExercise) => string
}) {
  const [result, setResult] = useState<{ verdict: GrammarVerdict; given: string } | null>(null)
  const next = useRef<HTMLButtonElement>(null)

  const answer = (given: string) => {
    if (result) return
    const verdict = checkGrammar(given, ex.answers)
    setResult({ verdict, given })
    onAnswered(verdict === 'ok')
    // The record is not on the learner's path: a failed post is logged and the
    // round carries on.
    postGrammarAttempt(ex.slug, verdict === 'ok', given).catch((e) => console.error('grammar attempt', e))
  }

  useEffect(() => {
    if (!result) return
    // After the Enter that submitted the answer has finished, so it does not
    // also press Next.
    const id = setTimeout(() => {
      next.current?.focus({ preventScroll: true })
      next.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }, 0)
    return () => clearTimeout(id)
  }, [result])

  const expect = ex.answers[0]
  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 p-[18px]">
      <div className="mb-2 text-[11px] uppercase tracking-wider text-indigo-300">{KIND_LABEL[ex.kind]}</div>
      <p className="mb-2 text-sm text-slate-400">
        <TermText text={ex.instr} />
      </p>
      <Prompt ex={ex} />

      {ex.kind === 'choose' && <Choices ex={ex} picked={result?.given ?? null} onPick={answer} />}
      {ex.kind === 'build' && <Build ex={ex} locked={result !== null} onSubmit={answer} />}
      {(ex.kind === 'transform' || ex.kind === 'fix' || ex.kind === 'fill') && (
        <Typed initial={ex.kind === 'fix' ? (ex.prompt ?? '') : ''} locked={result !== null} onSubmit={answer} />
      )}

      {result && (
        <>
          {result.verdict === 'ok' ? (
            <div className="mt-3.5 rounded-[10px] border border-emerald-300/35 bg-emerald-300/10 px-3 py-2.5 text-sm text-emerald-300">
              Right.
              {ex.answers.length > 1 && normalise(result.given) !== normalise(expect) && (
                <>
                  {' '}
                  Also good: <span className="font-semibold text-slate-100">{expect}</span>
                </>
              )}
              <span className="mt-1 block text-[13px] text-slate-300">{ex.why}</span>
            </div>
          ) : (
            <div className="mt-3.5 rounded-[10px] border border-rose-300/35 bg-rose-300/[.08] px-3 py-2.5 text-sm text-rose-300">
              {result.verdict === 'letters' ? 'Check æ, ø and å. ' : 'Not quite. '}
              Answer: <span className="font-semibold text-slate-100">{expect}</span>
              <span className="mt-1 block text-[13px] text-slate-300">{ex.why}</span>
              <button
                type="button"
                onClick={() => onSeeRule(refFor(ex))}
                className="mt-2 text-[13px] text-teal-300 underline underline-offset-[3px]"
              >
                See the rule
              </button>
            </div>
          )}
          <div className="mt-3.5 flex justify-end">
            <button ref={next} type="button" onClick={onNext} className={primary}>
              {last ? 'See results' : 'Next →'}
            </button>
          </div>
        </>
      )}
    </article>
  )
}

const primary =
  'rounded-[10px] bg-gradient-to-r from-teal-300 to-indigo-400 px-[18px] py-2.5 font-semibold text-slate-900 transition hover:opacity-90 disabled:cursor-default disabled:opacity-45'

function Choices({ ex, picked, onPick }: { ex: GrammarExercise; picked: string | null; onPick: (o: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {(ex.options ?? []).map((o) => {
        const right = picked !== null && ex.answers.includes(o)
        const wrong = picked === o && !ex.answers.includes(o)
        return (
          <button
            key={o}
            type="button"
            disabled={picked !== null}
            onClick={() => onPick(o)}
            className={`rounded-[10px] border px-4 py-2 text-[15px] transition ${
              right
                ? 'border-emerald-300/60 bg-emerald-300/10 text-emerald-300'
                : wrong
                  ? 'border-rose-300/60 bg-rose-300/10 text-rose-300'
                  : 'border-white/20 bg-white/5 enabled:hover:border-teal-300'
            }`}
          >
            {o}
          </button>
        )
      })}
    </div>
  )
}

function Build({ ex, locked, onSubmit }: { ex: GrammarExercise; locked: boolean; onSubmit: (s: string) => void }) {
  // Tiles by index, so two identical words stay two tiles.
  const tiles = ex.tiles ?? []
  const [built, setBuilt] = useState<number[]>([])
  const left = tiles.map((_, i) => i).filter((i) => !built.includes(i))
  const tile =
    'rounded-lg border border-white/20 bg-white/[.08] px-[11px] py-1.5 text-[15px] transition enabled:hover:border-teal-300'
  return (
    <>
      <div className="mb-2 flex min-h-[42px] flex-wrap gap-1.5 rounded-[10px] border border-dashed border-white/20 p-1.5">
        {built.length === 0 && <span className="self-center pl-1 text-[13px] text-slate-500">Tap the words in order</span>}
        {built.map((i) => (
          <button key={i} type="button" disabled={locked} className={tile} onClick={() => setBuilt((b) => b.filter((x) => x !== i))}>
            {tiles[i]}
          </button>
        ))}
      </div>
      <div className="flex min-h-[42px] flex-wrap gap-1.5">
        {left.map((i) => (
          <button key={i} type="button" disabled={locked} className={tile} onClick={() => setBuilt((b) => [...b, i])}>
            {tiles[i]}
          </button>
        ))}
      </div>
      <div className="mt-2.5">
        <button
          type="button"
          disabled={locked || left.length > 0}
          onClick={() => onSubmit(built.map((i) => tiles[i]).join(' '))}
          className={primary}
        >
          Check
        </button>
      </div>
    </>
  )
}

function Typed({ initial, locked, onSubmit }: { initial: string; locked: boolean; onSubmit: (s: string) => void }) {
  const [value, setValue] = useState(initial)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Straight into the box on a desktop; on a phone that would throw the
    // keyboard up over the rule strip before the question has been read.
    if (window.matchMedia?.('(min-width: 768px)').matches) input.current?.focus({ preventScroll: true })
  }, [])

  const insert = (ch: string) => {
    const el = input.current
    if (!el || locked) return
    const a = el.selectionStart ?? value.length
    const z = el.selectionEnd ?? a
    const v = value.slice(0, a) + ch + value.slice(z)
    setValue(v)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(a + 1, a + 1)
    })
  }

  const submit = () => {
    if (!locked && value.trim()) onSubmit(value)
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <input
          ref={input}
          type="text"
          value={value}
          readOnly={locked}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label="Your answer"
          className="min-w-0 flex-[1_1_220px] rounded-[10px] border border-white/20 bg-black/25 px-3 py-2.5 text-base outline-none focus:border-teal-300"
        />
        <button type="button" disabled={locked || !value.trim()} onClick={submit} className={primary}>
          Check
        </button>
      </div>
      <div className="mt-2 flex gap-1.5">
        {['æ', 'ø', 'å'].map((ch) => (
          <button
            key={ch}
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insert(ch)}
            className="h-[30px] w-[34px] rounded-lg border border-white/10 bg-white/5 text-[15px] hover:border-white/25"
          >
            {ch}
          </button>
        ))}
      </div>
    </>
  )
}

function RoundDone({
  round,
  outcomes,
  onMore,
  onLeave,
  leaveLabel,
}: {
  round: GrammarRound
  outcomes: boolean[]
  onMore: () => void
  onLeave: () => void
  leaveLabel: string
}) {
  const size = round.exercises.length
  const right = outcomes.filter(Boolean).length
  const missed = round.exercises.filter((_, i) => outcomes[i] === false)
  const more = useRef<HTMLButtonElement>(null)
  useEffect(() => more.current?.focus({ preventScroll: true }), [])
  const message =
    right === size ? 'All right.' : right >= size * 0.7 ? 'Good round.' : 'Worth another go: the ones you missed come first next time.'
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h2 className="text-lg font-semibold">Round complete</h2>
      <div className="text-[34px] font-bold tabular-nums tracking-tight">
        {right}
        <span className="text-lg font-medium text-slate-400"> / {size} right</span>
      </div>
      <p className="mt-1 text-sm text-slate-400">{message}</p>
      {missed.length > 0 && (
        <ul className="mt-3.5 grid gap-1.5">
          {missed.map((ex, i) => (
            <li key={`${ex.slug}-${i}`} className="rounded-[10px] border border-white/10 px-2.5 py-2 text-[13.5px] text-slate-400">
              {ex.prompt && <>{ex.prompt} → </>}
              <b className="font-semibold text-slate-100">{ex.answers[0]}</b>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-[18px] flex flex-wrap gap-2">
        <button ref={more} type="button" onClick={onMore} className={primary}>
          Practise {size} more
        </button>
        <button
          type="button"
          onClick={onLeave}
          className="rounded-[10px] border border-white/20 px-4 py-2.5 text-sm text-slate-300 transition hover:border-teal-300 hover:text-slate-100"
        >
          {leaveLabel}
        </button>
      </div>
    </div>
  )
}
