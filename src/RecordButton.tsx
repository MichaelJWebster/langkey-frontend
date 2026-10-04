// Record a take and play it straight back against the Piper reference.
// M3 step 1: no speech models, just your voice next to the model's.

import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchRecordings, recordingObjectUrl, uploadRecording } from './api'
import {
  canRecord,
  describeMicError,
  releaseTake,
  startRecording,
  type ActiveRecording,
  type Take,
} from './recording'
import { speak, stopSpeech } from './speech'

type Status = 'idle' | 'recording' | 'saving' | 'error'

export default function RecordButton({
  itemId,
  exampleId = null,
  text,
  referenceUrl,
  className = '',
}: {
  itemId: number
  exampleId?: number | null
  /** Spoken text, for the browser-TTS fallback when there is no Piper clip. */
  text: string
  referenceUrl?: string
  className?: string
}) {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [take, setTake] = useState<Take | null>(null)
  // A take saved in an earlier session, loaded lazily so you can compare
  // against yesterday's attempt rather than only the current one.
  const [savedUrl, setSavedUrl] = useState<string | null>(null)
  const active = useRef<ActiveRecording | null>(null)
  const player = useRef<HTMLAudioElement | null>(null)

  const stopPlayback = useCallback(() => {
    player.current?.pause()
    player.current = null
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
    setSavedUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous)
      return null
    })
    setStatus('idle')
    setError(null)
  }, [itemId, exampleId])

  // Load the most recent earlier take, if there is one.
  useEffect(() => {
    let cancelled = false
    let created: string | null = null
    fetchRecordings(itemId, exampleId)
      .then(async (list) => {
        if (cancelled || list.length === 0) return
        created = await recordingObjectUrl(list[0].id)
        if (cancelled) {
          URL.revokeObjectURL(created)
          return
        }
        setSavedUrl(created)
      })
      .catch(() => {
        /* An earlier take is a nicety; failing to find one is not an error. */
      })
    return () => {
      cancelled = true
    }
  }, [itemId, exampleId])

  const playUrl = useCallback(
    (url: string) => {
      stopPlayback()
      const audio = new Audio(url)
      player.current = audio
      audio.play().catch(() => {
        if (player.current === audio) player.current = null
      })
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
        playUrl(fresh.url) // hear it immediately; the upload happens behind that
        await uploadRecording({
          itemId,
          exampleId,
          blob: fresh.blob,
          mimeType: fresh.mimeType,
          durationMs: fresh.durationMs,
        })
        setStatus('idle')
      } catch (e) {
        // The take is still playable locally even if storing it failed.
        setStatus('error')
        setError(e instanceof Error ? e.message : 'Could not save the recording')
      }
      return
    }

    stopPlayback()
    try {
      active.current = await startRecording()
      setStatus('recording')
    } catch (e) {
      setStatus('error')
      setError(describeMicError(e))
    }
  }

  if (!canRecord()) return null

  const current = take?.url ?? savedUrl
  const recording = status === 'recording'

  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          void toggle()
        }}
        disabled={status === 'saving'}
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
              playUrl(current)
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
            ▸ Reference
          </button>
        </>
      )}

      {status === 'saving' && <span className="text-[11px] text-slate-500">saving…</span>}
      {error && <span className="text-[11px] text-rose-300">{error}</span>}
    </span>
  )
}
