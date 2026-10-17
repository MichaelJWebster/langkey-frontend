// Record a take and play it straight back against the Piper reference.
// M3 step 1: no speech models, just your voice next to the model's.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchRecordings,
  recordingBlob,
  transcribeRecording,
  uploadRecording,
  type Transcript,
} from './api'
import {
  canRecord,
  describeMicError,
  releaseTake,
  startRecording,
  type ActiveRecording,
  type Take,
} from './recording'
import { play, stop as stopPlaying } from './playback'
import WordFeedback from './WordFeedback'
import { speak, stopSpeech } from './speech'

type Status = 'idle' | 'arming' | 'recording' | 'saving' | 'error'

export default function RecordButton({
  itemId,
  exampleId = null,
  text,
  referenceUrl,
  scale = null,
  className = '',
}: {
  itemId: number
  exampleId?: number | null
  /** Spoken text, for the browser-TTS fallback when there is no Piper clip. */
  text: string
  referenceUrl?: string
  /** The reference speed on screen, so a word can be cut from that clip. */
  scale?: number | null
  className?: string
}) {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [take, setTake] = useState<Take | null>(null)
  // A take saved in an earlier session, loaded lazily so you can compare
  // against yesterday's attempt rather than only the current one.
  const [saved, setSaved] = useState<{ id: string; blob: Blob } | null>(null)
  // Null while nothing has been checked, and stays null when no speech
  // backend is running -- the feature is absent rather than broken.
  const [transcript, setTranscript] = useState<Transcript | null>(null)
  const [checking, setChecking] = useState(false)
  const active = useRef<ActiveRecording | null>(null)

  const stopPlayback = useCallback(() => {
    stopPlaying()
    stopSpeech()
  }, [])

  // Starting a new card must not leave a take, a blob URL, or a live
  // microphone behind.
  useEffect(() => {
    return () => {
      active.current?.cancel()
      active.current = null
      stopPlayback()
    }
  }, [itemId, exampleId, stopPlayback])

  useEffect(() => {
    setTake((previous) => {
      releaseTake(previous)
      return null
    })
    setSaved(null)
    setTranscript(null)
    setChecking(false)
    setStatus('idle')
    setError(null)
  }, [itemId, exampleId])

  // Load the most recent earlier take, if there is one.
  useEffect(() => {
    let cancelled = false
    fetchRecordings(itemId, exampleId)
      .then(async (list) => {
        if (cancelled || list.length === 0) return
        const blob = await recordingBlob(list[0].id)
        if (!cancelled) setSaved({ id: list[0].id, blob })
      })
      .catch(() => {
        /* An earlier take is a nicety; failing to find one is not an error. */
      })
    return () => {
      cancelled = true
    }
  }, [itemId, exampleId])

  // Levelled against the reference by playback.ts: a quiet take played back at
  // its recorded level next to a Piper clip is hard to compare at all.
  const playTake = useCallback(
    (blob: Blob, key: string) => {
      stopPlayback()
      void play(blob, key).catch(() => undefined)
    },
    [stopPlayback],
  )

  async function toggle() {
    setError(null)
    if (status === 'recording') {
      const recording = active.current
      active.current = null
      setStatus('saving')
      try {
        const fresh = await recording!.stop()
        setTake((previous) => {
          releaseTake(previous)
          return fresh
        })
        // Hear it immediately; the upload happens behind that.
        playTake(fresh.blob, fresh.url)
        const stored = await uploadRecording({
          itemId,
          exampleId,
          blob: fresh.blob,
          mimeType: fresh.mimeType,
          durationMs: fresh.durationMs,
        })
        setStatus('idle')
        // Checking is a bonus on top of a saved take: it runs after the take
        // is safe, and a failure here never loses the recording.
        setChecking(true)
        try {
          setTranscript(await transcribeRecording(stored.id))
        } catch {
          setTranscript(null)
        } finally {
          setChecking(false)
        }
      } catch (e) {
        // The take is still playable locally even if storing it failed.
        setStatus('error')
        setError(e instanceof Error ? e.message : 'Could not save the recording')
      }
      return
    }

    stopPlayback()
    setStatus('arming')
    try {
      active.current = await startRecording()
      setStatus('recording')
    } catch (e) {
      setStatus('error')
      setError(describeMicError(e))
    }
  }

  if (!canRecord()) return null

  const current = take
    ? { blob: take.blob, key: take.url }
    : saved
      ? { blob: saved.blob, key: saved.id }
      : null
  const recording = status === 'recording'

  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          void toggle()
        }}
        disabled={status === 'saving' || status === 'arming'}
        aria-label={recording ? `Stop recording: ${text}` : `Record yourself saying: ${text}`}
        title={recording ? 'Stop recording' : 'Record yourself'}
        className={`inline-flex items-center justify-center rounded-full p-1.5 transition disabled:opacity-50 ${
          recording
            ? 'animate-pulse bg-rose-500/20 text-rose-300'
            : 'text-slate-400 hover:bg-white/10 hover:text-rose-300'
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          {recording ? (
            <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" />
          ) : (
            <>
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0" />
              <path d="M12 18v4" />
            </>
          )}
        </svg>
      </button>

      {current && !recording && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              playTake(current.blob, current.key)
            }}
            className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-slate-300 transition hover:bg-white/10"
          >
            ▸ You
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              stopPlayback()
              void speak(text, referenceUrl)
            }}
            className="rounded-full border border-teal-400/25 bg-teal-400/10 px-2 py-0.5 text-[11px] font-medium text-teal-300 transition hover:bg-teal-400/20"
          >
            ▸ Slow reference
          </button>
        </>
      )}

      {status === 'arming' && (
        <span className="text-[11px] text-slate-500">opening mic…</span>
      )}
      {recording && <span className="text-[11px] text-rose-300">speak now</span>}
      {status === 'saving' && <span className="text-[11px] text-slate-500">saving…</span>}
      {checking && <span className="text-[11px] text-slate-500">checking…</span>}
      {error && <span className="text-[11px] text-rose-300">{error}</span>}
      {transcript && (
        <span className="w-full basis-full">
          <WordFeedback
            transcript={transcript}
            take={current ? { blob: current.blob, key: current.key } : null}
            scale={scale}
          />
        </span>
      )}
    </span>
  )
}
