import { useCallback, useEffect, useState } from 'react'
import {
  fetchTextPage,
  fetchTexts,
  saveReadingPosition,
  type TextPage,
  type TextSentence,
  type TextSummary,
} from './api'

// --- Library list ------------------------------------------------------------

export default function Reading({ onBack }: { onBack: () => void }) {
  const [texts, setTexts] = useState<TextSummary[] | null>(null)
  const [open, setOpen] = useState<TextSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchTexts()
      .then(setTexts)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !open) onBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack, open])

  if (open) return <Reader text={open} onBack={() => setOpen(null)} />

  return (
    <div>
      <div className="mb-4 flex items-center justify-between text-xs text-slate-400">
        <button
          onClick={onBack}
          title="Back to dashboard (Esc)"
          className="rounded-full px-1.5 py-0.5 font-medium transition hover:bg-slate-100 hover:text-slate-600"
        >
          ← Back
        </button>
        <span>Interleaved Norwegian–English reading</span>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold">📖 Reading</h1>
        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
        {!texts && !error && <p className="mt-4 text-slate-400">Loading library…</p>}
        {texts && texts.length === 0 && (
          <p className="mt-4 text-slate-600">
            The library is empty — import a text with the backend scripts (find_texts,
            prepare_text, import_text).
          </p>
        )}
        <div className="mt-4 grid gap-3">
          {texts?.map((t) => {
            const pct = Math.min(100, Math.round((t.position / t.sentence_count) * 100))
            return (
              <button
                key={t.slug}
                onClick={() => setOpen(t)}
                className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-sky-300 hover:bg-sky-50"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium text-slate-900">{t.title}</span>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                    {t.kind}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-slate-500">{t.author}</p>
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                  <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full bg-sky-500" style={{ width: `${pct}%` }} />
                  </div>
                  {t.position > 0
                    ? `${pct}% · continue at sentence ${t.position}`
                    : `${t.sentence_count} sentences`}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// --- Reader ------------------------------------------------------------------

function Reader({ text, onBack }: { text: TextSummary; onBack: () => void }) {
  const [page, setPage] = useState<TextPage | null>(null)
  const [showEnglish, setShowEnglish] = useState(true)
  const [revealed, setRevealed] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    (fromSeq: number) => {
      setPage(null)
      setRevealed(new Set())
      fetchTextPage(text.slug, fromSeq)
        .then((p) => {
          setPage(p)
          window.scrollTo(0, 0)
        })
        .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
    },
    [text.slug],
  )

  useEffect(() => load(Math.max(1, text.position)), [load, text.position])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack])

  function nextPage() {
    if (!page) return
    saveReadingPosition(text.slug, page.to_seq).catch(() => undefined)
    load(page.to_seq + 1)
  }

  const hasMore = page ? page.to_seq < page.sentence_count : false

  // group into paragraphs for rendering
  const paragraphs: TextSentence[][] = []
  for (const s of page?.sentences ?? []) {
    const last = paragraphs[paragraphs.length - 1]
    if (last && last[0].paragraph === s.paragraph) last.push(s)
    else paragraphs.push([s])
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between text-xs text-slate-400">
        <button
          onClick={onBack}
          title="Back to library (Esc)"
          className="rounded-full px-1.5 py-0.5 font-medium transition hover:bg-slate-100 hover:text-slate-600"
        >
          ← Library
        </button>
        <span>
          {page && `${page.from_seq}–${page.to_seq} of ${page.sentence_count}`}
        </span>
        <button
          onClick={() => {
            setShowEnglish((v) => !v)
            setRevealed(new Set())
          }}
          className={`rounded-full border px-2.5 py-0.5 font-medium transition ${
            showEnglish
              ? 'border-slate-200 text-slate-500 hover:border-sky-300'
              : 'border-sky-500 bg-sky-50 text-sky-700'
          }`}
        >
          {showEnglish ? 'Hide English' : 'English hidden — tap a line to peek'}
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold">{text.title}</h1>
        <p className="mt-0.5 text-sm text-slate-400">{text.author}</p>
        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
        {!page && !error && <p className="mt-4 text-slate-400">Loading…</p>}

        <div className="mt-6 space-y-5">
          {paragraphs.map((para) => (
            <div key={para[0].seq} className="space-y-2.5">
              {para.map((s) => {
                const visible = showEnglish || revealed.has(s.seq)
                return (
                  <div
                    key={s.seq}
                    onClick={() =>
                      !showEnglish &&
                      setRevealed((r) => {
                        const next = new Set(r)
                        if (next.has(s.seq)) next.delete(s.seq)
                        else next.add(s.seq)
                        return next
                      })
                    }
                    className={showEnglish ? '' : 'cursor-pointer'}
                  >
                    <p className="text-lg leading-snug text-slate-900">{s.no}</p>
                    <p
                      className={`text-sm leading-snug transition ${
                        visible ? 'text-slate-400' : 'select-none text-transparent'
                      }`}
                    >
                      {s.en}
                    </p>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {page && (
          <div className="mt-8 text-center">
            {hasMore ? (
              <button
                onClick={nextPage}
                className="rounded-lg bg-sky-600 px-6 py-2.5 font-medium text-white transition hover:bg-sky-700"
              >
                Continue →
              </button>
            ) : (
              <p className="text-sm text-slate-400">— The end —</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
