import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchListening, postAttempt, type ListeningExercise } from './api'
import { speak } from './speech'

// --- Norwegian text checking (diacritic-tolerant) ---------------------------

function clean(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,!?…"'«»:;()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function fold(s: string): string {
  return s.replaceAll('å', 'a').replaceAll('ø', 'o').replaceAll('æ', 'ae')
}

type WordMark = { word: string; state: 'ok' | 'near' | 'wrong' }

function checkDictation(target: string, answer: string): {
  correct: boolean
  nearMiss: boolean
  marks: WordMark[]
} {
  const t = clean(target)
  const a = clean(answer)
  const targetWords = t.split(' ')
  const answerWords = a.split(' ')
  const marks: WordMark[] = targetWords.map((word, i) => {
    const got = answerWords[i]
    if (got === word) return { word, state: 'ok' }
    if (got !== undefined && fold(got) === fold(word)) return { word, state: 'near' }
    return { word, state: 'wrong' }
  })
  const correct = marks.every((m) => m.state !== 'wrong') && answerWords.length === targetWords.length
  const nearMiss = correct && marks.some((m) => m.state === 'near')
  return { correct, nearMiss, marks }
}

// --- Special characters: buttons that also teach the Option shortcuts -------

const SPECIAL_CHARS: { char: string; shortcut: string }[] = [
  { char: 'æ', shortcut: "⌥'" },
  { char: 'ø', shortcut: '⌥O' },
  { char: 'å', shortcut: '⌥A' },
]

function CharLegend() {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative">
      <button
        type="button"
        aria-label="How to type Norwegian characters"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-semibold transition ${
          open ? 'border-sky-400 bg-sky-50 text-sky-600' : 'border-slate-300 text-slate-400 hover:border-sky-400 hover:text-sky-600'
        }`}
      >
        i
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-10 w-72 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-lg">
          <p className="mb-2 text-xs font-medium text-slate-500">
            Typing æ ø å on a US keyboard (macOS) — it's the <b>Option (⌥)</b> key, not Command:
          </p>
          <ul className="space-y-1 font-mono text-xs text-slate-600">
            <li>å = ⌥A&ensp;·&ensp;Å = ⌥⇧A</li>
            <li>ø = ⌥O&ensp;·&ensp;Ø = ⌥⇧O</li>
            <li>æ = ⌥'&ensp;·&ensp;Æ = ⌥⇧'</li>
          </ul>
          <p className="mt-2 text-xs text-slate-400">
            Or hold a / o down for the accent picker, or click the buttons here. Writing a for å
            counts as <i>nearly right</i> — never wrong.
          </p>
          <p className="mt-2 text-xs text-slate-400">Keys: Enter check/next · R replay · Esc exit.</p>
        </div>
      )}
    </span>
  )
}

// --- Session -----------------------------------------------------------------

type Result = { correct: boolean; nearMiss: boolean; marks?: WordMark[] }

export default function ListeningSession({ onFinish }: { onFinish: () => void }) {
  const [exercises, setExercises] = useState<ListeningExercise[] | null>(null)
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [picked, setPicked] = useState<number | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [score, setScore] = useState({ right: 0, near: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchListening()
      .then((r) => setExercises(r.exercises))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [])

  const current = exercises && index < exercises.length ? exercises[index] : null

  const play = useCallback(() => {
    if (current) speak(current.kind === 'dictation' ? current.target : current.word, current.audio_url)
  }, [current])

  // Try to start each clip automatically; fall back to the play button when
  // the browser wants a fresh gesture.
  useEffect(() => {
    if (current) play()
  }, [current, play])

  const finishExercise = useCallback(
    (res: Result, answered: string | null) => {
      if (!current) return
      setResult(res)
      setScore((s) => ({
        right: s.right + (res.correct ? 1 : 0),
        near: s.near + (res.nearMiss ? 1 : 0),
        total: s.total + 1,
      }))
      postAttempt({
        exercise_type: current.kind === 'dictation' ? 'dictation' : 'listen_choose',
        item_id: current.item_id,
        example_id: current.kind === 'dictation' ? current.example_id : undefined,
        correct: res.correct,
        near_miss: res.nearMiss,
        answer: answered ?? undefined,
      }).catch(() => undefined)
    },
    [current],
  )

  const next = useCallback(() => {
    setResult(null)
    setPicked(null)
    setAnswer('')
    setIndex((i) => i + 1)
  }, [])

  const checkDictationAnswer = useCallback(() => {
    if (!current || current.kind !== 'dictation') return
    finishExercise(checkDictation(current.target, answer), answer)
  }, [current, answer, finishExercise])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') return onFinish()
      if (!current) return
      if (e.key === 'r' && !(e.target instanceof HTMLInputElement)) return play()
      if (e.key === 'Enter') {
        e.preventDefault()
        if (result) next()
        else if (current.kind === 'dictation' && answer.trim()) checkDictationAnswer()
      }
      if (current.kind === 'listen_choose' && !result && ['1', '2', '3', '4'].includes(e.key)) {
        const i = Number(e.key) - 1
        setPicked(i)
        finishExercise({ correct: i === current.correct_index, nearMiss: false }, current.options[i])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, result, answer, next, play, checkDictationAnswer, finishExercise, onFinish])

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
      <Card>
        <p className="text-sm text-red-700">{error}</p>
        <button onClick={onFinish} className="mt-4 text-sm font-medium text-sky-600">Back</button>
      </Card>
    )
  }
  if (!exercises) return <Card><p className="text-slate-400">Loading listening practice…</p></Card>
  if (exercises.length === 0) {
    return (
      <Card>
        <p className="text-slate-600">Study some flashcards first — listening practice uses the words you've met.</p>
        <button onClick={onFinish} className="mt-4 text-sm font-medium text-sky-600">Back</button>
      </Card>
    )
  }
  if (!current) {
    return (
      <Card>
        <div className="text-4xl">🎧</div>
        <p className="mt-3 text-xl font-medium">
          {score.right} / {score.total} correct
          {score.near > 0 && <span className="text-sm text-amber-600"> ({score.near} nearly — watch æ ø å)</span>}
        </p>
        <button
          onClick={onFinish}
          className="mt-6 rounded-lg bg-sky-600 px-6 py-2.5 font-medium text-white transition hover:bg-sky-700"
        >
          Back to dashboard
        </button>
      </Card>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between text-xs text-slate-400">
        <span className="flex items-center gap-2">
          <button
            onClick={onFinish}
            title="Back to dashboard (Esc)"
            className="rounded-full px-1.5 py-0.5 font-medium transition hover:bg-slate-100 hover:text-slate-600"
          >
            ← Back
          </button>
          {index + 1} / {exercises.length}
        </span>
        <span className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2 py-0.5">
            {current.kind === 'dictation' ? 'type what you hear' : 'choose the meaning'}
          </span>
          <CharLegend />
        </span>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <button
          onClick={play}
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sky-600 text-white shadow transition hover:bg-sky-700"
          aria-label="Play audio (R)"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="ml-1 h-7 w-7"><path d="M8 5v14l11-7z" /></svg>
        </button>
        <p className="mt-2 text-center text-xs text-slate-400">R to replay</p>

        {current.kind === 'dictation' ? (
          <div className="mt-6">
            {result ? (
              <div className="text-center">
                <p className="text-lg">
                  {result.marks!.map((m, i) => (
                    <span
                      key={i}
                      className={
                        m.state === 'ok' ? 'text-emerald-700' : m.state === 'near' ? 'text-amber-600 underline decoration-dotted' : 'text-red-600 underline'
                      }
                    >
                      {m.word}{' '}
                    </span>
                  ))}
                </p>
                <p className="mt-1 text-sm text-slate-400">{current.translation}</p>
                <p className="mt-3 text-sm font-medium">
                  {result.correct
                    ? result.nearMiss ? '👍 Nearly right — mind the special characters' : '✅ Correct!'
                    : '❌ Not quite — your answer: ' + (answer || '(empty)')}
                </p>
                <NextButton onClick={next} />
              </div>
            ) : (
              <>
                <input
                  ref={inputRef}
                  autoFocus
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Type the Norwegian sentence…"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-lg outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex gap-1.5">
                    {SPECIAL_CHARS.map(({ char, shortcut }) => (
                      <button
                        key={char}
                        type="button"
                        onClick={() => insertChar(char)}
                        className="rounded-lg border border-slate-200 px-3 py-1 text-base font-medium text-slate-700 transition hover:border-sky-300 hover:bg-sky-50"
                      >
                        {char}
                        <span className="ml-1.5 text-[10px] text-slate-400">{shortcut}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={checkDictationAnswer}
                    disabled={!answer.trim()}
                    className="rounded-lg bg-slate-900 px-5 py-1.5 font-medium text-white transition hover:bg-slate-700 disabled:opacity-40"
                  >
                    Check <span className="ml-1 text-xs text-slate-400">↵</span>
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="mt-6">
            {result && (
              <p className="mb-3 text-center text-xl font-medium">
                {current.word}
                <span className="ml-2 text-sm font-normal text-slate-400">
                  {result.correct ? '✅' : '❌'}
                </span>
              </p>
            )}
            <div className="grid gap-2">
              {current.options.map((opt, i) => {
                let style = 'border-slate-200 text-slate-700 hover:border-sky-300 hover:bg-sky-50'
                if (result) {
                  if (i === current.correct_index) style = 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  else if (i === picked) style = 'border-red-300 bg-red-50 text-red-700'
                  else style = 'border-slate-100 text-slate-400'
                }
                return (
                  <button
                    key={opt}
                    disabled={!!result}
                    onClick={() => {
                      setPicked(i)
                      finishExercise({ correct: i === current.correct_index, nearMiss: false }, opt)
                    }}
                    className={`rounded-lg border px-4 py-2.5 text-left transition ${style}`}
                  >
                    <span className="mr-2 text-xs text-slate-400">{i + 1}</span>
                    {opt}
                  </button>
                )
              })}
            </div>
            {result && <div className="text-center"><NextButton onClick={next} /></div>}
          </div>
        )}
      </div>
    </div>
  )
}

function NextButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-4 rounded-lg bg-sky-600 px-6 py-2 font-medium text-white transition hover:bg-sky-700"
    >
      Next <span className="ml-1 text-xs text-sky-200">↵</span>
    </button>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">{children}</div>
}
