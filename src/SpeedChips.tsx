// Choose how slowly the reference is read.
//
// Labels rather than numbers: length_scale 3.4 means nothing to a learner,
// and the measured rate behind it (2.63 syl/s, against Michael's own 3.96) is
// what the words stand in for. Slowest first, matching PRONUNCIATION_SCALES
// on the server (ADR-033).

import { useState } from 'react'
import type { CopySpeed } from './api'

/** One set of names for the speed ladder, shared by pronunciation and
 *  dictation since they offer the same five speeds (ADR-046). */
export const LABELS: Record<string, string> = {
  '4': 'slowest',
  '3.4': 'very slow',
  '2.8': 'slow',
  '2.2': 'easier',
  '1.6': 'natural',
}

/** The name of a speed, or the number itself for one off the ladder. */
export const speedLabel = (scale: number): string => LABELS[String(scale)] ?? String(scale)
const KEY = 'langkey.copySpeed'
export const DEFAULT_SCALE = 3.4

export function loadSpeed(): number | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw === null ? null : Number(raw)
  } catch {
    return null // private window, or site data blocked
  }
}

function saveSpeed(scale: number) {
  try {
    localStorage.setItem(KEY, String(scale))
  } catch {
    /* the choice just does not survive the session */
  }
}

/** The chosen rung's clip for this text, falling back to the server default. */
export function speedUrl(speeds: CopySpeed[], scale: number | null, fallback: string): string {
  if (scale === null) return fallback
  return speeds.find((s) => s.scale === scale)?.url ?? fallback
}

/** The remembered choice, and a setter that remembers it. */
export function useCopySpeed(): [number | null, (scale: number) => void] {
  const [scale, setScale] = useState<number | null>(loadSpeed)
  return [
    scale,
    (next: number) => {
      setScale(next)
      saveSpeed(next)
    },
  ]
}

export default function SpeedChips({
  speeds,
  scale,
  onPick,
  label = 'Copy at',
}: {
  speeds: CopySpeed[]
  scale: number | null
  onPick: (scale: number) => void
  label?: string
}) {
  if (speeds.length === 0) return null
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      <span className="mr-0.5 text-[11px] text-slate-500">{label}</span>
      {speeds.map((sp) => {
        const active = scale === null ? sp.scale === DEFAULT_SCALE : scale === sp.scale
        return (
          <button
            key={sp.scale}
            type="button"
            onClick={() => onPick(sp.scale)}
            aria-pressed={active}
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${
              active
                ? 'border-teal-400 bg-teal-400/10 text-teal-300'
                : 'border-white/15 text-slate-400 hover:border-teal-400/50 hover:text-teal-300'
            }`}
          >
            {LABELS[String(sp.scale)] ?? String(sp.scale)}
          </button>
        )
      })}
    </div>
  )
}
