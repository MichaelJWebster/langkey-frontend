// Master volume for everything the app plays. Lives in the header so it is
// reachable from every screen, and remembers where it was left.

import { useEffect, useState } from 'react'
import { DEFAULT_VOLUME, getVolume, onVolumeChange, setVolume } from './playback'

export default function VolumeControl() {
  const [volume, setLocal] = useState(getVolume)
  // Muting keeps the old level so unmuting returns to it rather than to 1.
  const [beforeMute, setBeforeMute] = useState<number | null>(null)

  useEffect(() => onVolumeChange(setLocal), [])

  const muted = volume === 0
  const percent = Math.round(volume * 100)

  function toggleMute() {
    if (muted) {
      setVolume(beforeMute ?? DEFAULT_VOLUME)
      setBeforeMute(null)
    } else {
      setBeforeMute(volume)
      setVolume(0)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? 'Unmute' : 'Mute'}
        title={muted ? 'Unmute' : 'Mute'}
        className="rounded-full p-1 text-slate-400 transition hover:bg-white/10 hover:text-slate-200"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <path d="M11 5 6 9H2v6h4l5 4z" />
          {muted ? (
            <>
              <path d="m22 9-6 6" />
              <path d="m16 9 6 6" />
            </>
          ) : (
            <>
              <path d="M15.5 8.5a5 5 0 0 1 0 7" />
              <path d="M18.5 5.5a9 9 0 0 1 0 13" />
            </>
          )}
        </svg>
      </button>
      <input
        id="master-volume"
        type="range"
        min={0}
        max={100}
        step={1}
        value={percent}
        onChange={(e) => {
          setBeforeMute(null)
          setVolume(Number(e.target.value) / 100)
        }}
        aria-label="Volume"
        aria-valuetext={`${percent} percent`}
        className="h-1 w-24 cursor-pointer appearance-none rounded-full bg-white/15 accent-teal-400"
      />
      <span className="w-8 text-right text-[11px] tabular-nums text-slate-500">{percent}%</span>
    </div>
  )
}
