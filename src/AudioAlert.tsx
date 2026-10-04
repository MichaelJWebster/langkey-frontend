// A clip that will not play used to be papered over with a browser voice.
// Now it says so, here, until something plays or the learner dismisses it.

import { useEffect, useState } from 'react'
import { clearAudioFailure, onAudioFailure, type AudioFailure } from './speech'

export default function AudioAlert() {
  const [failure, setFailure] = useState<AudioFailure | null>(null)

  useEffect(() => onAudioFailure(setFailure), [])

  if (!failure) return null

  const outage = failure.status === 503 || failure.status === 0

  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-3"
    >
      <div className="flex max-w-2xl items-start gap-3 rounded-xl border border-rose-400/30 bg-rose-950/90 px-4 py-3 shadow-lg backdrop-blur">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="mt-0.5 h-5 w-5 shrink-0 text-rose-300"
        >
          <path d="M12 9v4M12 17h.01" />
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        </svg>
        <div className="min-w-0">
          <p className="text-sm font-medium text-rose-200">{failure.message}</p>
          <p className="mt-0.5 text-xs text-rose-300/70">
            {outage
              ? 'Audio is not being substituted — check that object storage is running.'
              : 'Generate the missing clips before practising listening with this card.'}
          </p>
        </div>
        <button
          type="button"
          onClick={clearAudioFailure}
          aria-label="Dismiss"
          className="ml-auto shrink-0 rounded-full p-1 text-rose-300/60 transition hover:bg-white/10 hover:text-rose-200"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
