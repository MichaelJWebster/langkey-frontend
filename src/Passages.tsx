// A1 reading and translation: a short Norwegian passage, rendered into English
// by the learner and then marked by the learner.
//
// Self-marking is the design, not a shortcut. A free translation has too many
// right answers to grade by comparison, and the alternative -- a model marking
// it -- puts a model on the request path to make a judgement the learner is
// better placed to make. What the app can do is make the judgement easy: show
// the two translations together, and ask one question with three answers.
//
// The glossary sits under the Norwegian from the start. Hiding it would turn a
// reading exercise into a vocabulary quiz, and the words in it are by
// definition ones the deck has not taught yet.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchPassages,
  postPassageAttempt,
  type Passage,
  type PassageMark,
  type PassageSession,
} from './api'

const MARKS: { mark: PassageMark; label: string; hint: string; tone: string }[] = [
  {
    mark: 'got',
    label: 'Got it',
    hint: 'Same meaning, even if the words differ',
    tone: 'border-emerald-400/60 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20',
  },
  {
    mark: 'partly',
    label: 'Partly',
    hint: 'Got the gist, missed something',
    tone: 'border-amber-400/60 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20',
  },
  {
    mark: 'missed',
    label: 'Missed it',
    hint: 'Wrong, or could not do it',
    tone: 'border-rose-400/60 bg-rose-400/10 text-rose-200 hover:bg-rose-400/20',
  },
]

export default function Passages({ onBack }: { onBack: () => void }) {
  const [session, setSession] = useState<PassageSession | null>(null)
  const [at, setAt] = useState(0)
  const [marks, setMarks] = useState<PassageMark[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setSession(null)
    setAt(0)
    setMarks([])
    fetchPassages()
      .then(setSession)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [])

  useEffect(load, [load])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack])

  const passage = session?.passages[at] ?? null
  const done = session !== null && at >= session.passages.length

  function record(mark: PassageMark, answer: string, revealed: boolean) {
    if (!passage) return
    setMarks((m) => [...m, mark])
    setAt((i) => i + 1)
    // Fire and forget: losing one mark to a flaky network should not block the
    // learner mid-session, and the next fetch re-reads the real state.
    postPassageAttempt(passage.slug, mark, answer, revealed).catch(() => undefined)
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between text-xs text-slate-400">
        <button
          onClick={onBack}
          title="Back to Reading (Esc)"
          className="rounded-full px-1.5 py-0.5 font-medium transition hover:bg-white/10 hover:text-slate-200"
        >
          ← Reading
        </button>
        {session && !done && (
          <span>
            {at + 1} of {session.passages.length}
          </span>
        )}
        {session && (
          <span>
            {session.got} of {session.total} done
          </span>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
        <h1 className="text-xl font-semibold">✍️ A1 Reading and translation</h1>
        {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
        {!session && !error && <p className="mt-4 text-slate-400">Loading passages…</p>}
        {session?.passages.length === 0 && (
          <p className="mt-4 text-slate-300">
            No passages yet — add them to{' '}
            <code className="text-slate-400">data/a1_passages_nb.jsonl</code> in the
            backend and restart.
          </p>
        )}
        {passage && <Exercise key={passage.slug} passage={passage} onMark={record} />}
        {done && session.passages.length > 0 && (
          <Summary marks={marks} onAgain={load} onBack={onBack} />
        )}
      </div>
    </div>
  )
}

// --- One passage -------------------------------------------------------------

function Exercise({
  passage,
  onMark,
}: {
  passage: Passage
  onMark: (mark: PassageMark, answer: string, revealed: boolean) => void
}) {
  const [answer, setAnswer] = useState('')
  const [revealed, setRevealed] = useState(false)
  const box = useRef<HTMLTextAreaElement>(null)

  useEffect(() => box.current?.focus(), [])

  return (
    <div className="mt-6">
      <p className="text-xs uppercase tracking-wide text-slate-500">
        {passage.level} · {passage.kind} · {passage.word_count} words
        {passage.last_mark && ` · last time: ${passage.last_mark}`}
      </p>

      <p className="mt-3 text-xl leading-relaxed text-slate-100">{passage.no}</p>

      {passage.glossary.length > 0 && (
        <dl
          aria-label="New words"
          className="mt-4 grid gap-x-6 gap-y-1 border-l-2 border-white/10 pl-4 text-sm sm:grid-cols-2"
        >
          {passage.glossary.map((g) => (
            <div key={g.form} className="flex gap-2">
              <dt className="font-medium text-sky-300">{g.form}</dt>
              <dd className="text-slate-400">
                {g.en}
                {g.lemma !== g.form && (
                  <span className="text-slate-500"> · {g.lemma}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <label className="mt-6 block text-sm text-slate-400" htmlFor="translation">
        Your translation
      </label>
      <textarea
        id="translation"
        ref={box}
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={3}
        placeholder="Write it in English…"
        className="mt-1.5 w-full rounded-lg border border-white/15 bg-slate-900/60 p-3 text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
      />

      {!revealed ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={() => setRevealed(true)}
            className="min-h-11 rounded-lg bg-sky-600 px-5 font-medium text-white transition hover:bg-sky-700"
          >
            Check
          </button>
          <span className="text-xs text-slate-500">
            Have a go first — you mark your own answer.
          </span>
        </div>
      ) : (
        <>
          <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Reference translation
            </p>
            <p className="mt-1 text-slate-200">{passage.en}</p>
          </div>
          <p className="mt-5 text-sm text-slate-400">
            How did you do? Meaning counts, not wording.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            {MARKS.map((m) => (
              <button
                key={m.mark}
                onClick={() => onMark(m.mark, answer, true)}
                title={m.hint}
                className={`min-h-11 flex-1 rounded-lg border px-4 font-medium transition sm:flex-none ${m.tone}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// --- End of session ----------------------------------------------------------

function Summary({
  marks,
  onAgain,
  onBack,
}: {
  marks: PassageMark[]
  onAgain: () => void
  onBack: () => void
}) {
  const count = (m: PassageMark) => marks.filter((x) => x === m).length
  // "Got it" is worth 1, "partly" a half: a percentage that credits a near miss
  // reads more honestly than one that calls it a failure.
  const score = marks.length
    ? Math.round(((count('got') + count('partly') * 0.5) / marks.length) * 100)
    : 0

  return (
    <div className="mt-6 text-center">
      <p className="text-4xl font-semibold text-slate-100">{score}%</p>
      <p className="mt-1 text-sm text-slate-400">
        {count('got')} got it · {count('partly')} partly · {count('missed')} missed
        {' — '}
        {marks.length} {marks.length === 1 ? 'passage' : 'passages'}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          onClick={onAgain}
          className="min-h-11 rounded-lg bg-sky-600 px-6 font-medium text-white transition hover:bg-sky-700"
        >
          Another set
        </button>
        <button
          onClick={onBack}
          className="min-h-11 rounded-lg border border-white/15 px-6 font-medium text-slate-300 transition hover:bg-white/10"
        >
          Back to Reading
        </button>
      </div>
    </div>
  )
}
