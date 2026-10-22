// A grammar word with its explanation one hover (or tap) away.
//
// Hover opens it on a mouse; on a touch screen there is no hover, so a tap
// toggles it. One bubble is open at a time. The bubble is portalled to <body>
// with fixed positioning, because the rule panel scrolls and clips, and on a
// phone it is itself a fixed sheet.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { parseTerms, TERMS } from './grammarTerms'

let closeOpen: (() => void) | null = null

const TIP_WIDTH = 300

const canHover = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches

export function Term({ k, children }: { k: string; children?: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean } | null>(null)
  const def = TERMS[k]

  const hide = useCallback(() => setPos(null), [])

  const show = useCallback(() => {
    const el = ref.current
    if (!el) return
    if (closeOpen && closeOpen !== hide) closeOpen()
    closeOpen = hide
    const r = el.getBoundingClientRect()
    const width = Math.min(TIP_WIDTH, window.innerWidth - 32)
    const left = Math.min(Math.max(16, r.left + r.width / 2 - width / 2), window.innerWidth - width - 16)
    const above = window.innerHeight - r.bottom < 170
    setPos({ left, top: above ? r.top - 8 : r.bottom + 8, above })
  }, [hide])

  // While open: a click elsewhere, any scroll, or Escape closes it. Escape is
  // caught before the section's own handler, which would otherwise walk back
  // a whole screen.
  useEffect(() => {
    if (!pos) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) hide()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        hide()
      }
    }
    document.addEventListener('pointerdown', onDown, true)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [pos, hide])

  // An unmounted term must not stay registered as the open one.
  useEffect(
    () => () => {
      if (closeOpen === hide) closeOpen = null
    },
    [hide],
  )

  if (!def) return <>{children}</>

  return (
    <span
      ref={ref}
      role="button"
      tabIndex={0}
      aria-expanded={pos !== null}
      data-term={k}
      className="cursor-help rounded-sm border-b border-dotted border-current hover:bg-white/10"
      onMouseEnter={() => canHover() && show()}
      onMouseLeave={() => canHover() && hide()}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (pos && !canHover()) hide()
        else show()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          e.stopPropagation()
          if (pos) hide()
          else show()
        }
      }}
      onFocus={(e) => e.currentTarget.matches(':focus-visible') && show()}
      onBlur={hide}
    >
      {children ?? def[0].toLowerCase()}
      {pos &&
        createPortal(
          <span
            role="tooltip"
            className="fixed z-[80] block rounded-xl border border-white/20 bg-[#1b2740] px-3 py-2.5 text-left text-[13px] font-normal normal-case leading-snug tracking-normal text-slate-300 shadow-2xl"
            style={{
              left: pos.left,
              top: pos.top,
              width: Math.min(TIP_WIDTH, window.innerWidth - 32),
              transform: pos.above ? 'translateY(-100%)' : undefined,
            }}
          >
            <b className="mb-0.5 block text-[13.5px] text-slate-100">{def[0]}</b>
            {def[1]}
            {def[2] && (
              <span
                className="mt-1.5 block text-[12.5px] text-slate-400 [&_em]:font-semibold [&_em]:not-italic [&_em]:text-teal-300"
                dangerouslySetInnerHTML={{ __html: def[2] }}
              />
            )}
          </span>,
          document.body,
        )}
    </span>
  )
}

/** Text from the content file, with its [[term]] markup made live. */
export function TermText({ text }: { text: string }) {
  return (
    <>
      {parseTerms(text).map((seg, i) =>
        'term' in seg ? (
          <Term key={i} k={seg.term}>
            {seg.label}
          </Term>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  )
}
