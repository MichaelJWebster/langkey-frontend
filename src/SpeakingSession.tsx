// Pronunciation practice: hear the phrase, say it, see how it landed.
//
// Lifted out of the writing cards (ADR-037). Same parts -- the slow reference,
// the speed chooser, the microphone, the word-by-word feedback -- but with the
// phrase as the whole point rather than something to translate first. The
// phrases the server sends lean toward the sounds the learner's own record
// says are not landing (ADR-036).

import { useCallback, useEffect, useState } from 'react'
import { fetchSpeakingPractice, type SpeakingPhrase, type SpeakingSession as Session } from './api'
import RecordButton from './RecordButton'
import SpeedChips, { speedUrl, useCopySpeed } from './SpeedChips'
import { speak, stopSpeech } from './speech'

export default function SpeakingSession({ onFinish }: { onFinish: () => void }) {
  const [session, setSession] = useState<Session | null>(null)
  const [index, setIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [scale, pickSpeed] = useCopySpeed()

  useEffect(() => {
    fetchSpeakingPractice()
      .then(setSession)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
    return stopSpeech
  }, [])

  const phrase: SpeakingPhrase | undefined = session?.phrases[index]

  const play = useCallback(() => {
    if (phrase) void speak(phrase.text, speedUrl(phrase.speeds, scale, phrase.audio_url))
  }, [phrase, scale])

  // Hearing it first is the point; waiting for a click to hear it is friction.
  useEffect(() => {
    play()
  }, [play])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'r') play()
      if (e.key === 'Escape') onFinish()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [play, onFinish])

  if (error) return <p className="text-sm text-red-300">{error}</p>
  if (!session) return <p className="text-slate-400">Loading…</p>

  if (session.phrases.length === 0) {
    return (
      <p className="text-slate-300">
        Nothing to practise saying yet — review some vocabulary first, and the words you
        have met will show up here.
      </p>
    )
  }

  if (!phrase) {
    return (
      <div className="text-center">
        <p className="text-lg">Done — {session.phrases.length} phrases.</p>
        <button
          onClick={onFinish}
          className="mt-5 rounded-lg bg-teal-600 px-6 py-2.5 font-medium text-white transition hover:bg-teal-700"
        >
          Back to skills
        </button>
      </div>
    )
  }

  const worst = session.record.filter((r) => r.pattern).slice(0, 6)

  return (
    <div>
      {worst.length > 0 && (
        <div className="mb-5 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-amber-300/80">
            Sounds that keep slipping
          </p>
          <p className="mt-1 text-sm text-slate-300">
            {worst.map((r, i) => (
              <span key={r.word}>
                {i > 0 && ' · '}
                <span className="font-medium">{r.word}</span>{' '}
                <span className="tabular-nums text-slate-500">
                  {r.said}/{r.attempts}
                </span>
              </span>
            ))}
          </p>
        </div>
      )}

      {/* SkillShell already carries the way back; this is just the count. */}
      <div className="mb-4 text-right text-xs text-slate-400">
        {index + 1} / {session.phrases.length}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
        <p className="text-3xl font-semibold tracking-tight">{phrase.text}</p>
        <p className="mt-1.5 text-sm text-slate-400">{phrase.translation}</p>
        {phrase.focus.length > 0 && (
          <p className="mt-2 text-xs text-amber-300/80">
            watching: {phrase.focus.join(', ')}
          </p>
        )}

        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={play}
            aria-label={`Play: ${phrase.text}`}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-600 text-white shadow transition hover:bg-teal-700"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="ml-1 h-6 w-6">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">R to replay</p>

        <div className="mt-4">
          <SpeedChips speeds={phrase.speeds} scale={scale} onPick={pickSpeed} label="Read at" />
        </div>

        <div className="mt-6 flex flex-col items-center gap-2 border-t border-white/10 pt-6">
          <p className="text-xs text-slate-500">Now say it</p>
          <RecordButton
            key={`${phrase.item_id}-${phrase.example_id}`}
            itemId={phrase.item_id}
            exampleId={phrase.example_id}
            text={phrase.text}
            referenceUrl={speedUrl(phrase.speeds, scale, phrase.audio_url)}
          />
        </div>

        <div className="mt-8">
          <button
            onClick={() => setIndex((i) => i + 1)}
            className="rounded-lg bg-white/10 px-6 py-2.5 font-medium text-slate-100 transition hover:bg-white/15"
          >
            {index + 1 === session.phrases.length ? 'Finish' : 'Next phrase →'}
          </button>
        </div>
      </div>
    </div>
  )
}
