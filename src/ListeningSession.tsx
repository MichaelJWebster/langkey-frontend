import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchListening, postAttempt, type ListeningExercise } from './api'
import { clean, fold, wordCredit } from './matching'
import { wrongTone } from './playback'
import { hasMistake, skeleton, type Slot } from './skeleton'
import { speak, stopSpeech } from './speech'

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
          open ? 'border-teal-300/60 bg-teal-300/10 text-teal-300' : 'border-white/20 text-slate-400 hover:border-teal-300/60 hover:text-teal-300'
        }`}
      >
        i
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-10 w-72 rounded-xl border border-white/15 bg-[#101a2e] p-4 text-left shadow-lg">
          <p className="mb-2 text-xs font-medium text-slate-400">
            Typing æ ø å on a US keyboard (macOS) — it's the <b>Option (⌥)</b> key, not Command:
          </p>
          <ul className="space-y-1 font-mono text-xs text-slate-300">
            <li>å = ⌥A&ensp;·&ensp;Å = ⌥⇧A</li>
            <li>ø = ⌥O&ensp;·&ensp;Ø = ⌥⇧O</li>
            <li>æ = ⌥'&ensp;·&ensp;Æ = ⌥⇧'</li>
          </ul>
          <p className="mt-2 text-xs text-slate-400">
            Or hold a / o down for the accent picker, or click the buttons here. Writing a for å
            counts as <i>nearly right</i> — never wrong.
          </p>
          <p className="mt-2 rounded-md bg-amber-400/10 px-2 py-1 text-xs text-amber-300">
            ⚠️ Not ⌘ Command — ⌘O opens the browser's file dialog!
          </p>
          <p className="mt-2 text-xs text-slate-400">Keys: Enter check/next · R replay · H hint · Esc exit.</p>
          <p className="mt-2 text-xs text-slate-400">
            Sessions adapt: sentence speed and the recognition/transcription mix follow your
            recent results, and you can override the speed on any sentence.
          </p>
        </div>
      )}
    </span>
  )
}

// --- The sentence's shape -----------------------------------------------------

/** Underscores for what is still to come, the real word once it is right.
 *
 *  Monospace, so a blank word's underscores line up with a filled word's
 *  letters and the sentence does not shift about as it fills in. The word gap
 *  is a real space rather than a margin, so the text reads correctly to a
 *  screen reader instead of running together as one long run of underscores.
 *
 *  Wide tracking on the underscores only: it is what keeps them countable,
 *  but applied to a filled word it spaces the letters out ("D e") and the
 *  word stops looking like a word. */
function Skeleton({ slots }: { slots: Slot[] }) {
  return (
    <p
      aria-label="The sentence so far"
      className="mb-3 text-center font-mono text-lg text-slate-500"
    >
      {slots.map((slot, i) => (
        <span key={i}>
          {i > 0 ? ' ' : ''}
          <span
            className={`inline-block whitespace-nowrap ${
              slot.state === 'filled'
                ? 'text-slate-100'
                : slot.state === 'near'
                  ? 'text-amber-300'
                  : slot.state === 'wrong'
                    ? 'tracking-widest text-red-400'
                    : 'tracking-widest'
            }`}
          >
            {slot.state === 'blank' || slot.state === 'wrong' ? slot.shape : slot.word}
          </span>
        </span>
      ))}
    </p>
  )
}

/** The red light: on while a completed word is wrong, off the moment it is
 *  fixed. Derived from the input rather than stored, so there is no stale
 *  error to clear -- correcting the word is what clears it, and so does Hint,
 *  which rewrites the answer to be right. */
function MistakeLight({ on }: { on: boolean }) {
  return (
    <span role="status" aria-live="polite" className="flex items-center gap-1.5 text-xs">
      <span
        aria-hidden
        className={`h-2.5 w-2.5 rounded-full transition ${
          on ? 'bg-red-500 shadow-[0_0_6px_1px_rgba(239,68,68,0.7)]' : 'bg-white/15'
        }`}
      />
      <span className={on ? 'text-red-400' : 'sr-only'}>
        {on ? 'that word is not right' : 'no mistakes'}
      </span>
    </span>
  )
}

// --- Session -----------------------------------------------------------------

type Result = { correct: boolean; nearMiss: boolean; marks?: WordMark[]; mark?: number }

// One word of hint feedback: typed+correct = a fixed mistake (struck + fix),
// typed alone = an extra word to drop (struck), correct alone = already right.
type HintMark = { typed?: string; correct?: string }
type HintFeedback =
  | { kind: 'next'; words: string[]; added: string }
  | { kind: 'fix'; marks: HintMark[] }
  | { kind: 'complete' }

export default function ListeningSession({ onFinish }: { onFinish: () => void }) {
  const [exercises, setExercises] = useState<ListeningExercise[] | null>(null)
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [picked, setPicked] = useState<number | null>(null)
  const [hintWords, setHintWords] = useState(0) // words supplied by hints
  const [hintPresses, setHintPresses] = useState(0) // logged on the attempt
  const [hintFeedback, setHintFeedback] = useState<HintFeedback | null>(null)
  const [scale, setScale] = useState<number | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  // points = sum of graded marks (hints reduce a correct answer's mark);
  // helped = correct answers that leaned on hints.
  const [score, setScore] = useState({ right: 0, helped: 0, near: 0, total: 0, points: 0 })
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchListening()
      .then((r) => setExercises(r.exercises))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [])

  const current = exercises && index < exercises.length ? exercises[index] : null

  const play = useCallback(() => {
    if (!current) return
    if (current.kind === 'dictation') {
      const chosen = scale ?? current.suggested_scale
      const speed = current.speeds.find((s) => s.scale === chosen) ?? current.speeds[0]
      void speak(current.target, speed.url)
    } else {
      void speak(current.word, current.audio_url)
    }
  }, [current, scale])

  // Autoplay once per exercise. Deliberately keyed on `current` alone: `play`
  // changes identity whenever the chosen speed does, so including it made a
  // speed chip fire twice -- once from its own handler and once from this
  // effect re-running -- and the two clips played over each other.
  const playRef = useRef(play)
  playRef.current = play
  useEffect(() => {
    if (current) playRef.current()
    // Stop any clip still playing when the exercise changes or the session
    // closes, so audio never overlaps the next one.
    return stopSpeech
  }, [current])

  const finishExercise = useCallback(
    (res: Result, answered: string | null, mark: number) => {
      if (!current) return
      setResult({ ...res, mark })
      setScore((s) => ({
        right: s.right + (res.correct && mark >= 1 ? 1 : 0),
        helped: s.helped + (res.correct && mark < 1 ? 1 : 0),
        near: s.near + (res.nearMiss ? 1 : 0),
        total: s.total + 1,
        points: s.points + mark,
      }))
      postAttempt({
        exercise_type: current.kind === 'dictation' ? 'dictation' : 'listen_choose',
        item_id: current.item_id,
        example_id: current.kind === 'dictation' ? current.example_id : undefined,
        correct: res.correct,
        near_miss: res.nearMiss,
        hints: hintPresses,
        score: mark,
        speed:
          current.kind === 'dictation' ? scale ?? current.suggested_scale : undefined,
        answer: answered ?? undefined,
      }).catch(() => undefined)
    },
    [current, hintPresses, scale],
  )

  const next = useCallback(() => {
    setResult(null)
    setPicked(null)
    setAnswer('')
    setHintWords(0)
    setHintPresses(0)
    setHintFeedback(null)
    setScale(null)
    setIndex((i) => i + 1)
  }, [])

  const targetWords =
    current && current.kind === 'dictation' ? clean(current.target).split(' ') : []
  const fullyRevealed = hintWords >= targetWords.length && targetWords.length > 0
  const hintedWords = Math.min(hintWords, targetWords.length)

  // The shape of the sentence, recomputed from the input every render. Nothing
  // is stored, which is what makes the mistake light self-clearing.
  const shape =
    current && current.kind === 'dictation' && !result
      ? skeleton(current.target, answer)
      : null
  const mistake = shape !== null && hasMistake(shape)

  // Sound the cue on the edge only: as a word is completed wrongly, not once
  // per keystroke for as long as the mistake stands.
  const soundedRef = useRef(false)
  useEffect(() => {
    if (mistake && !soundedRef.current) wrongTone()
    soundedRef.current = mistake
  }, [mistake])

  // A hint coaches the current attempt: if what's typed is right so far, it
  // appends the next word; if not, it corrects the attempt (mistakes shown
  // struck-through in red with the fix beside them) so the next hint advances.
  const giveHint = useCallback(() => {
    if (!current || current.kind !== 'dictation' || result) return
    const typed = clean(answer).split(' ').filter(Boolean)
    const marks: HintMark[] = []
    let wrong = 0
    typed.forEach((w, i) => {
      const t = targetWords[i]
      if (t === undefined) {
        marks.push({ typed: w }) // extra word beyond the sentence
        wrong += 1
      } else if (w === t || fold(w) === fold(t)) {
        marks.push({ correct: w }) // folded å/ø/æ counts as right, as in checking
      } else {
        marks.push({ typed: w, correct: t })
        wrong += 1
      }
    })
    setHintPresses((p) => p + 1)
    if (wrong > 0) {
      const corrected = marks.flatMap((m) => (m.correct !== undefined ? [m.correct] : []))
      // Trailing space: a hinted word is one the learner has moved past, so it
      // has to count as complete and show up in the skeleton.
      setAnswer(corrected.length ? corrected.join(' ') + ' ' : '')
      setHintFeedback({ kind: 'fix', marks })
      setHintWords((h) => h + wrong)
    } else if (typed.length >= targetWords.length) {
      setHintFeedback({ kind: 'complete' })
    } else {
      const added = targetWords[typed.length]
      setAnswer([...typed, added].join(' ') + ' ')
      setHintFeedback({ kind: 'next', words: typed, added })
      setHintWords((h) => h + 1)
    }
    requestAnimationFrame(() => {
      const el = inputRef.current
      el?.focus()
      el?.setSelectionRange(el.value.length, el.value.length)
    })
  }, [current, result, answer, targetWords])

  const checkDictationAnswer = useCallback(() => {
    if (!current || current.kind !== 'dictation') return
    const res = checkDictation(current.target, answer)
    // Seeing the whole sentence via hints can't count as a correct listen.
    if (fullyRevealed) res.correct = false
    // Graded mark: per-word credit (spelling similarity for wrong words),
    // minus the words hints supplied, over the longer of the two sentences.
    const answerWords = clean(answer).split(' ').filter(Boolean)
    const credit = targetWords.reduce((sum, t, i) => sum + wordCredit(answerWords[i], t), 0)
    const denom = Math.max(targetWords.length, answerWords.length, 1)
    const mark = Math.max(0, credit - hintedWords) / denom
    finishExercise(res, answer, mark)
  }, [current, answer, finishExercise, fullyRevealed, targetWords, hintedWords])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Never react to browser shortcuts (⌘O opens a file dialog, etc.).
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Escape') return onFinish()
      if (!current) return
      if (e.key === 'r' && !(e.target instanceof HTMLInputElement)) return play()
      if (e.key === 'h' && !(e.target instanceof HTMLInputElement)) return giveHint()
      if (e.key === 'Enter') {
        e.preventDefault()
        if (result) next()
        else if (current.kind === 'dictation' && answer.trim()) checkDictationAnswer()
      }
      if (current.kind === 'listen_choose' && !result && ['1', '2', '3', '4'].includes(e.key)) {
        const i = Number(e.key) - 1
        setPicked(i)
        finishExercise(
          { correct: i === current.correct_index, nearMiss: false },
          current.options[i],
          i === current.correct_index ? 1 : 0,
        )
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, result, answer, next, play, giveHint, checkDictationAnswer, finishExercise, onFinish])

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
        <p className="text-sm text-red-300">{error}</p>
        <button onClick={onFinish} className="mt-4 text-sm font-medium text-sky-300">Back</button>
      </Card>
    )
  }
  if (!exercises) return <Card><p className="text-slate-400">Loading listening practice…</p></Card>
  if (exercises.length === 0) {
    return (
      <Card>
        <p className="text-slate-300">Study some flashcards first — listening practice uses the words you've met.</p>
        <button onClick={onFinish} className="mt-4 text-sm font-medium text-sky-300">Back</button>
      </Card>
    )
  }
  if (!current) {
    return (
      <Card>
        <div className="text-4xl">🎧</div>
        <p className="mt-3 text-xl font-medium">
          {score.right} / {score.total} correct
          {score.helped > 0 && <span className="text-sm text-slate-400"> (+{score.helped} with hints)</span>}
          {score.near > 0 && <span className="text-sm text-amber-300"> ({score.near} nearly — watch æ ø å)</span>}
        </p>
        {score.total > 0 && (
          <p className="mt-1 text-sm text-slate-400">
            Session mark: {Math.round((score.points / score.total) * 100)}%
          </p>
        )}
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
            className="rounded-full px-1.5 py-0.5 font-medium transition hover:bg-white/10 hover:text-slate-200"
          >
            ← Back
          </button>
          {index + 1} / {exercises.length}
        </span>
        <span className="flex items-center gap-2">
          <span className="rounded-full bg-white/10 px-2 py-0.5">
            {current.kind === 'dictation' ? 'type what you hear' : 'choose the meaning'}
          </span>
          <CharLegend />
        </span>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
        <button
          onClick={play}
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sky-600 text-white shadow transition hover:bg-sky-700"
          aria-label="Play audio (R)"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="ml-1 h-7 w-7"><path d="M8 5v14l11-7z" /></svg>
        </button>
        <p className="mt-2 text-center text-xs text-slate-400">R to replay</p>
        {current.kind === 'dictation' && (
          <div className="mt-2 flex justify-center gap-1.5">
            {current.speeds.map((sp, i) => {
              const active = (scale ?? current.suggested_scale) === sp.scale
              const label = ['🐢 very slow', 'slow', 'normal'][i] ?? String(sp.scale)
              return (
                <button
                  key={sp.scale}
                  onClick={() => {
                    setScale(sp.scale)
                    void speak(current.target, sp.url)
                  }}
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${
                    active
                      ? 'border-sky-400 bg-sky-400/10 text-sky-300'
                      : 'border-white/15 text-slate-400 hover:border-sky-400/50 hover:text-sky-300'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        )}

        {current.kind === 'dictation' ? (
          <div className="mt-6">
            {result ? (
              <div className="text-center">
                <p className="text-lg">
                  {result.marks!.map((m, i) => (
                    <span
                      key={i}
                      className={
                        m.state === 'ok' ? 'text-emerald-400' : m.state === 'near' ? 'text-amber-300 underline decoration-dotted' : 'text-red-400 underline'
                      }
                    >
                      {m.word}{' '}
                    </span>
                  ))}
                </p>
                <p className="mt-1 text-sm text-slate-400">{current.translation}</p>
                <p className="mt-3 text-sm font-medium">
                  {result.correct
                    ? hintedWords > 0
                      ? `🟡 ${Math.round((result.mark ?? 0) * 100)}% — right with ${hintedWords} hinted ` +
                        (hintedWords === 1 ? 'word' : 'words')
                      : result.nearMiss ? '👍 Nearly right — mind the special characters' : '✅ Correct!'
                    : fullyRevealed
                      ? '💡 Revealed — it will come around again'
                      : (result.mark ?? 0) > 0
                        ? `❌ Not quite (${Math.round(result.mark! * 100)}% credit) — your answer: ` +
                          (answer || '(empty)')
                        : '❌ Not quite — your answer: ' + (answer || '(empty)')}
                </p>
                <NextButton onClick={next} />
              </div>
            ) : (
              <>
                {shape && <Skeleton slots={shape.slots} />}
                {hintFeedback && (
                  <p className="mb-2 text-center text-lg tracking-wide">
                    {hintFeedback.kind === 'fix' ? (
                      hintFeedback.marks.map((m, i) => (
                        <span key={i} className="mr-1.5 whitespace-nowrap">
                          {m.typed !== undefined && (
                            <s className="text-red-400">{m.typed}</s>
                          )}
                          {m.typed !== undefined && m.correct !== undefined && ' '}
                          {m.correct !== undefined && (
                            <span className={m.typed !== undefined ? 'font-medium' : 'text-slate-400'}>
                              {m.correct}
                            </span>
                          )}
                        </span>
                      ))
                    ) : hintFeedback.kind === 'next' ? (
                      <>
                        {hintFeedback.words.map((w, i) => (
                          <span key={i} className="mr-1.5 text-slate-400">{w}</span>
                        ))}
                        <span className="font-medium text-sky-300">{hintFeedback.added}</span>
                      </>
                    ) : (
                      <span className="text-sm text-emerald-300">
                        Looks complete — press Check ↵
                      </span>
                    )}
                  </p>
                )}
                <input
                  ref={inputRef}
                  autoFocus
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Type the Norwegian sentence…"
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-lg text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      {SPECIAL_CHARS.map(({ char, shortcut }) => (
                        <button
                          key={char}
                          type="button"
                          onClick={() => insertChar(char)}
                          className="rounded-lg border border-white/15 px-3 py-1 text-base font-medium text-slate-200 transition hover:border-sky-400/50 hover:bg-white/10"
                        >
                          {char}
                          <span className="ml-1.5 text-[10px] text-slate-400">{shortcut}</span>
                        </button>
                      ))}
                    </div>
                    <MistakeLight on={mistake} />
                  </div>
                  <span className="flex gap-2">
                    <button
                      onClick={giveHint}
                      className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 font-medium text-amber-300 transition hover:bg-amber-400/20"
                    >
                      {hintPresses > 0 ? 'More' : 'Hint'}
                      <span className="ml-1 text-xs opacity-60">H</span>
                    </button>
                    <button
                      onClick={checkDictationAnswer}
                      disabled={!answer.trim() && !fullyRevealed}
                      className="rounded-lg bg-gradient-to-r from-teal-300 to-indigo-400 px-5 py-1.5 font-semibold text-slate-900 transition hover:opacity-90 disabled:opacity-40"
                    >
                      Check <span className="ml-1 text-xs text-slate-700/70">↵</span>
                    </button>
                  </span>
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
                let style = 'border-white/15 text-slate-200 hover:border-sky-400/50 hover:bg-white/10'
                if (result) {
                  if (i === current.correct_index) style = 'border-emerald-400/50 bg-emerald-400/10 text-emerald-300'
                  else if (i === picked) style = 'border-red-400/50 bg-red-400/10 text-red-300'
                  else style = 'border-white/5 text-slate-500'
                }
                return (
                  <button
                    key={opt}
                    disabled={!!result}
                    onClick={() => {
                      setPicked(i)
                      finishExercise(
                        { correct: i === current.correct_index, nearMiss: false },
                        opt,
                        i === current.correct_index ? 1 : 0,
                      )
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
  return <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">{children}</div>
}
