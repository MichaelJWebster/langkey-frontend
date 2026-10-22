// The rule diagram above the exercises.
//
// Michael: *"a diagrammatic or graphical representation of the grammar rules to
// be pinned to the top of the page and exercises under it. Keep in mind the
// mobile layout, and you can make it able to be slid onto and off the screen to
// have a quick look at the grammar diagram before sliding off the screen to go
// back to the exercises on mobile."*
//
// Desktop: the full diagram sits in the sticky header, with Hide/Show (the
// choice is remembered). Phone: the header carries only a compact strip of the
// rule, and the full diagram is a sheet that slides in from the right -- tap
// the strip or the edge tab, or swipe in from the right edge -- and is swiped,
// tapped or Escaped away again.
//
// The sheet is position:fixed inside a sticky header. That works only while no
// ancestor has a transform or backdrop-filter, which would become the sheet's
// containing block and trap it inside the header.

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import type { Rule } from './grammarRules'

const COLLAPSED_KEY = 'langkey.grammar.ruleCollapsed'

function useMediaQuery(query: string): boolean {
  const get = () => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches
  const [matches, setMatches] = useState(get)
  useEffect(() => {
    const mq = window.matchMedia?.(query)
    if (!mq) return
    const on = () => setMatches(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return matches
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

/** "See the rule": which row to show, and a counter so asking twice re-runs. */
export interface Seek {
  ref: string
  n: number
}

export default function RuleSheet({
  rule,
  seek,
  header,
}: {
  rule: Rule
  seek: Seek | null
  /** Title and progress, shown above the rule in the sticky header. */
  header: ReactNode
}) {
  const phone = useMediaQuery('(max-width: 767px)')
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [sheetOpen, setOpen] = useState(false)
  // Leaving phone width closes the sheet; it has no meaning on a desktop.
  const open = sheetOpen && phone
  const panel = useRef<HTMLElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const backdrop = useRef<HTMLDivElement>(null)

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, c ? '0' : '1')
      } catch {
        // Private mode: the choice just isn't remembered.
      }
      return !c
    })
  }

  // The page underneath must not scroll while the sheet covers it.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // Escape closes the sheet before anything else hears it.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])

  // "See the rule": bring the diagram into view and flash the row.
  useEffect(() => {
    if (!seek) return
    if (phone) setOpen(true)
    else {
      setCollapsed(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    const id = requestAnimationFrame(() => {
      const box = body.current
      if (!box) return
      const rows = box.querySelectorAll<HTMLElement>(`[data-row="${seek.ref}"]`)
      if (!rows.length) return
      const top = box.scrollTop + rows[0].getBoundingClientRect().top - box.getBoundingClientRect().top - 24
      box.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
      rows.forEach((el) => {
        el.classList.remove('rule-flash')
        void el.offsetWidth
        el.classList.add('rule-flash')
      })
    })
    return () => cancelAnimationFrame(id)
  }, [seek, phone])

  // --- Dragging the sheet --------------------------------------------------------
  const drag = useRef<{
    mode: 'open' | 'close'
    x0: number
    y0: number
    t0: number
    dx: number
    active: boolean
    id: number
    el: Element
  } | null>(null)
  const suppressClick = useRef(false)

  const setOffset = (off: number | null) => {
    const p = panel.current
    const b = backdrop.current
    if (!p || !b) return
    // Inline styles, so the finger is followed without the class's easing and
    // clearing them hands back to the open/closed classes.
    if (off === null) {
      p.style.transform = ''
      p.style.transition = ''
      b.style.opacity = ''
      b.style.transition = ''
      return
    }
    p.style.transition = 'none'
    b.style.transition = 'none'
    p.style.transform = `translateX(${off}px)`
    b.style.opacity = String(1 - off / p.offsetWidth)
  }

  const onDown = (mode: 'open' | 'close') => (e: ReactPointerEvent) => {
    if (!phone) return
    if (mode === 'close' && (e.target as Element).closest('button, input, [data-term]')) return
    drag.current = {
      mode,
      x0: e.clientX,
      y0: e.clientY,
      t0: performance.now(),
      dx: 0,
      active: false,
      id: e.pointerId,
      el: e.currentTarget,
    }
  }

  const finish = useCallback((d: NonNullable<typeof drag.current>) => {
    const p = panel.current
    setOffset(null)
    if (!p) return
    const W = p.offsetWidth
    const v = d.dx / Math.max(1, performance.now() - d.t0)
    if (d.mode === 'open') setOpen(-d.dx > W * 0.25 || v < -0.4)
    else setOpen(!(d.dx > W * 0.25 || v > 0.4))
  }, [])

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current
      const p = panel.current
      if (!d || !p || e.pointerId !== d.id) return
      const dx = e.clientX - d.x0
      const dy = e.clientY - d.y0
      if (!d.active) {
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
          d.active = true
          backdrop.current?.classList.add('!opacity-100', '!pointer-events-auto')
          try {
            d.el.setPointerCapture(d.id)
          } catch {
            // Already released; the drag still works without capture.
          }
        } else if (Math.abs(dy) > 10) {
          drag.current = null
          return
        } else return
      }
      d.dx = dx
      const W = p.offsetWidth
      setOffset(d.mode === 'open' ? Math.min(W, Math.max(0, W + dx)) : Math.min(W, Math.max(0, dx)))
    }
    const up = (e: PointerEvent) => {
      const d = drag.current
      if (!d || e.pointerId !== d.id) return
      drag.current = null
      if (!d.active) return
      suppressClick.current = true
      setTimeout(() => (suppressClick.current = false), 0)
      backdrop.current?.classList.remove('!opacity-100', '!pointer-events-auto')
      finish(d)
    }
    const cancel = () => {
      const d = drag.current
      drag.current = null
      if (!d?.active) return
      backdrop.current?.classList.remove('!opacity-100', '!pointer-events-auto')
      setOffset(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
    }
  }, [finish])

  const panelClass = phone
    ? `fixed inset-y-0 right-0 z-40 flex w-[min(92vw,440px)] flex-col rounded-l-[18px] border border-r-0 border-white/10 bg-[#0f1829] shadow-[-24px_0_60px_rgba(0,0,0,.5)] transition-transform duration-300 ease-out motion-reduce:transition-none ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`
    : 'mt-3 rounded-2xl border border-white/10 bg-[#0f1829]'

  return (
    <div className="sticky top-0 z-20 -mx-4 border-b border-white/10 bg-[#0b1220]/95 px-4 pb-3 pt-2.5 md:-mx-3 md:px-3">
      {header}

      {phone && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-controls="grammar-rule"
          className="mt-2.5 block w-full rounded-xl border border-white/10 bg-[#0f1829] p-2 text-left"
        >
          <span className="mb-1.5 flex items-center justify-between px-0.5 text-[11.5px] text-slate-400">
            <span>The rule</span>
            <b className="font-semibold text-teal-300">Full rule ⟵</b>
          </span>
          {rule.mini}
        </button>
      )}

      <aside
        ref={panel}
        id="grammar-rule"
        aria-label="Grammar rule"
        aria-modal={open ? true : undefined}
        className={panelClass}
        style={phone ? { touchAction: 'pan-y', paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' } : undefined}
        onPointerDown={open ? onDown('close') : undefined}
      >
        {phone && <span aria-hidden className="absolute left-1.5 top-1/2 -mt-[22px] h-11 w-1 rounded bg-white/20" />}
        <div className={`flex items-center gap-2.5 px-3.5 py-3 ${collapsed && !phone ? '' : 'border-b border-white/10'}`}>
          <span className="shrink-0 text-[11px] uppercase tracking-wider text-teal-300">Rule</span>
          <span className="min-w-0 flex-1 text-[15px] font-semibold [text-wrap:balance]">{rule.headline}</span>
          {phone ? (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300"
            >
              Close ⟶
            </button>
          ) : (
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-expanded={!collapsed}
              className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300 transition hover:border-white/25 hover:text-slate-100"
            >
              {collapsed ? 'Show' : 'Hide'}
            </button>
          )}
        </div>
        {(phone || !collapsed) && (
          <div
            ref={body}
            className={`overflow-auto overscroll-contain p-3.5 [color-scheme:dark] ${phone ? 'flex-1' : 'max-h-[44vh]'}`}
          >
            {rule.body}
          </div>
        )}
      </aside>

      {phone && (
        <>
          <div
            ref={backdrop}
            onClick={() => !suppressClick.current && setOpen(false)}
            className={`fixed inset-0 z-30 bg-[#020610]/60 transition-opacity duration-300 ${
              open ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          />
          <div
            aria-hidden
            onPointerDown={onDown('open')}
            className="fixed inset-y-0 right-0 z-[24] w-3.5"
            style={{ touchAction: 'none' }}
          />
          {!open && (
            <button
              type="button"
              aria-controls="grammar-rule"
              onPointerDown={onDown('open')}
              onClick={() => !suppressClick.current && setOpen(true)}
              className="fixed right-0 top-[62%] z-[25] rotate-180 rounded-r-[10px] bg-gradient-to-b from-teal-300 to-indigo-400 px-[7px] py-3.5 text-xs font-bold uppercase tracking-wider text-[#0b1220] shadow-[-6px_0_18px_rgba(0,0,0,.35)] [writing-mode:vertical-rl]"
              style={{ touchAction: 'none' }}
            >
              Rule
            </button>
          )}
        </>
      )}
    </div>
  )
}
