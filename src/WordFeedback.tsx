// What the model heard, word by word.
//
// Never a score. A transcript can lose a word for reasons that have nothing to
// do with the speaker, so a single take only ever shows what happened; the
// running tally beside a word is what turns that into something worth acting
// on (ADR-036).
//
// Tap a word to hear it: the reference's word and your own, each cut from the
// sentence as actually spoken, on their own or together in opposite ears
// (ADR-043). The reference word comes out of the clip at the speed you were
// listening at, because a word inside a sentence is not pronounced the way it
// is on its own -- which is the whole reason this is not a per-word clip.

import { useEffect, useRef, useState } from 'react'
import { fetchClipWords, type ClipWords, type Transcript, type WordMark, type WordRecord } from './api'
import { canPlaySegments, playSegments, type Segment } from './playback'
import { fetchClip } from './speech'

const STYLE: Record<WordMark['verdict'], string> = {
  said: 'text-emerald-300',
  slipped: 'text-amber-300 underline decoration-amber-400/50 decoration-dotted underline-offset-4',
  missed: 'text-rose-300 line-through decoration-rose-400/50',
}

/** The learner's take, as something a word can be cut out of. */
export interface TakeClip {
  blob: Blob
  key: string
}

interface Reference {
  key: string
  target: string
  scale: number
  words: ClipWords
  blob: Blob
}

export default function WordFeedback({
  transcript,
  take = null,
  scale = null,
}: {
  transcript: Transcript
  /** The take this transcript is of. Without it there is nothing to compare. */
  take?: TakeClip | null
  /** The reference speed on screen, which decides which clip to cut from. */
  scale?: number | null
}) {
  const byWord = new Map<string, WordRecord>(transcript.history.map((h) => [h.word, h]))
  const bare = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
  const patterns = transcript.history.filter((h) => h.pattern)
  const heard = transcript.text.trim()

  const comparable = take !== null && scale !== null && canPlaySegments()
  // The selection belongs to one transcript: a new take starts with nothing
  // selected, without an effect to reset it.
  const [picked, setPicked] = useState<{ of: Transcript; index: number } | null>(null)
  const selected = picked && picked.of === transcript ? picked.index : null
  const setSelected = (index: number | null) =>
    setPicked(index === null ? null : { of: transcript, index })

  const [reference, setReference] = useState<Reference | null>(null)
  const [failed, setFailed] = useState<string | null>(null) // the key that failed
  const inFlight = useRef<string | null>(null)

  // The reference is fetched the first time a word is tapped, not when the
  // panel appears: most takes are never compared word by word, and the
  // alignment on the server is computed on first ask. Keyed by sentence and
  // speed, because each speed is a different clip with different timings.
  const key = selected !== null && comparable ? `${scale}|${transcript.target}` : null
  const referenceReady = reference !== null && reference.key === key
  const referenceFailed = key !== null && failed === key
  const referenceLoading = key !== null && !referenceReady && !referenceFailed
  const target = transcript.target

  useEffect(() => {
    if (key === null || scale === null || referenceReady || referenceFailed) return
    if (inFlight.current === key) return
    inFlight.current = key
    let cancelled = false
    ;(async () => {
      try {
        const words = await fetchClipWords(target, scale)
        const blob = await fetchClip(words.url)
        if (cancelled) return
        if (!blob) throw new Error('no clip')
        setReference({ key, target, scale, words, blob })
      } catch {
        if (!cancelled) setFailed(key)
      } finally {
        if (inFlight.current === key) inFlight.current = null
      }
    })()
    return () => {
      cancelled = true
      // StrictMode runs an effect twice on mount; the second run must be
      // free to fetch again rather than wait on a result that was discarded.
      if (inFlight.current === key) inFlight.current = null
    }
  }, [key, scale, target, referenceReady, referenceFailed])

  const mark = selected === null ? null : transcript.words[selected]
  // The clip's words and the marks are both one per word of the target, in
  // order; a mismatch means the two were tokenised differently and nothing
  // should be cut on the strength of it.
  const referenceSpan =
    referenceReady && reference.words.words.length === transcript.words.length && selected !== null
      ? reference.words.words[selected]
      : null
  const takeSpan = mark?.take ?? null

  const referenceSegment = (pan = 0): Segment | null =>
    referenceReady && referenceSpan
      ? { blob: reference.blob, key: reference.words.url, start: referenceSpan.start, end: referenceSpan.end, pan }
      : null
  const takeSegment = (pan = 0): Segment | null =>
    take && takeSpan ? { blob: take.blob, key: take.key, start: takeSpan.start, end: takeSpan.end, pan } : null

  function hear(...segments: (Segment | null)[]) {
    const real = segments.filter((s): s is Segment => s !== null)
    if (real.length === 0) return
    void playSegments(real).catch(() => undefined)
  }

  const takeReason = !transcript.aligned
    ? 'your take could not be placed word by word'
    : mark?.verdict === 'missed' && !takeSpan
      ? 'nothing of yours was heard here'
      : null
  const referenceReason =
    referenceFailed
      ? 'the reference could not be loaded'
      : referenceReady && !referenceSpan
        ? 'this word could not be placed in the reference'
        : null

  return (
    <div className="mt-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left">
      <p className="text-[10px] font-semibold uppercase tracking-[.08em] text-slate-500">
        What the model heard
      </p>

      <p className="mt-1.5 leading-relaxed">
        {transcript.words.map((w, i) => {
          const record = byWord.get(bare(w.word))
          const enough = record && record.attempts >= transcript.attempts_for_pattern
          const isSelected = selected === i
          const label = (
            <span className={STYLE[w.verdict]} title={w.heard ? `heard “${w.heard}”` : undefined}>
              {w.word}
            </span>
          )
          return (
            <span key={`${w.word}-${i}`} className="mr-1.5 inline-block">
              {comparable ? (
                <button
                  type="button"
                  onClick={() => setSelected(isSelected ? null : i)}
                  aria-pressed={isSelected}
                  title="Hear this word"
                  className={`rounded px-0.5 transition hover:bg-white/10 ${
                    isSelected ? 'bg-white/10 ring-1 ring-teal-400/50' : ''
                  }`}
                >
                  {label}
                </button>
              ) : (
                label
              )}
              {w.heard && w.verdict !== 'said' && (
                <span className="ml-1 text-xs text-slate-500">→ {w.heard}</span>
              )}
              {enough && (
                <span
                  className={`ml-1 text-[10px] tabular-nums ${
                    record.pattern ? 'text-amber-400/80' : 'text-slate-600'
                  }`}
                  title={`${record.said} of ${record.attempts} attempts came through`}
                >
                  {record.said}/{record.attempts}
                </span>
              )}
            </span>
          )
        })}
      </p>

      {comparable && mark && (
        <div
          className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-white/10 pt-2 text-[11px]"
          data-testid="word-compare"
        >
          <span className="mr-1 font-medium text-slate-300">{mark.word}</span>
          <button
            type="button"
            onClick={() => hear(referenceSegment())}
            disabled={!referenceSegment()}
            title={referenceReason ?? 'The reference, this word only'}
            className="rounded-full border border-teal-400/25 bg-teal-400/10 px-2 py-0.5 font-medium text-teal-300 transition hover:bg-teal-400/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ▸ Reference
          </button>
          <button
            type="button"
            onClick={() => hear(takeSegment())}
            disabled={!takeSegment()}
            title={takeReason ?? 'Your take, this word only'}
            className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-medium text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ▸ You
          </button>
          <button
            type="button"
            onClick={() => hear(referenceSegment(-1), takeSegment(1))}
            disabled={!referenceSegment() || !takeSegment()}
            title={
              referenceReason ?? takeReason ?? 'Both at once: reference in the left ear, you in the right'
            }
            className="rounded-full border border-fuchsia-400/25 bg-fuchsia-400/10 px-2 py-0.5 font-medium text-fuchsia-300 transition hover:bg-fuchsia-400/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ▸ Both
          </button>
          <span className="text-slate-500">
            {referenceLoading
              ? 'loading the reference…'
              : (referenceReason ?? takeReason ?? 'Both: reference left, you right')}
          </span>
        </div>
      )}

      {heard && heard.toLowerCase() !== transcript.target.toLowerCase() && (
        <p className="mt-1.5 text-xs italic text-slate-500">“{heard}”</p>
      )}

      {patterns.length > 0 && (
        <p className="mt-2 border-t border-white/10 pt-2 text-xs text-amber-300/90">
          Worth practising:{' '}
          {patterns.map((p, i) => (
            <span key={p.word}>
              {i > 0 && ', '}
              <span className="font-medium">{p.word}</span>{' '}
              <span className="tabular-nums text-amber-400/60">
                {p.said}/{p.attempts}
              </span>
            </span>
          ))}
        </p>
      )}

      <p className="mt-2 text-[10px] text-slate-600">
        A guide, not a grade — the model mishears for its own reasons too. The counts are
        what to trust.{comparable ? ' Tap a word to hear it, yours and the reference.' : ''}
      </p>
    </div>
  )
}
