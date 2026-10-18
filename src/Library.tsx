// Reading for interest: novels and folktales in the original, with the English
// beside them. Well above A1, and read rather than marked.
//
// Its own section on the dashboard, under Games -- Michael: "I'd also like to
// split the Reading for Interest section out of Reading and have it as a
// section similar to Games under Games on the screen." It was the second half
// of Reading until 2026-10-18; Reading is now the A1 passages alone. Like
// Games it has no CEFR ring of its own, though the sentences read here still
// count toward the reading ring (ADR-041): reading a novel is reading.
//
// Three levels: categories -> text list -> reader.

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchTextPage,
  fetchTexts,
  saveReadingPosition,
  type TextPage,
  type TextSentence,
  type TextSummary,
} from './api'
import { categorise, type Category } from './categories'

export default function Library({ onBack }: { onBack: () => void }) {
  const [texts, setTexts] = useState<TextSummary[] | null>(null)
  const [kind, setKind] = useState<string | null>(null)
  const [open, setOpen] = useState<TextSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchTexts()
      .then(setTexts)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [])

  const categories = useMemo(() => categorise(texts ?? []), [texts])
  const current = categories.find((c) => c.kind === kind) ?? null

  // Escape goes back one level at a time: reader -> category -> out.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape' || open) return
      if (kind) setKind(null)
      else onBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack, open, kind])

  if (open) return <Reader text={open} onBack={() => setOpen(null)} />

  function back() {
    if (current) setKind(null)
    else onBack()
  }

  const sentenceCount = (texts ?? []).reduce((n, t) => n + t.sentence_count, 0)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between text-xs text-slate-400">
        <button
          onClick={back}
          title={current ? 'Back to categories (Esc)' : 'Back to dashboard (Esc)'}
          className="rounded-full px-1.5 py-0.5 font-medium transition hover:bg-white/10 hover:text-slate-200"
        >
          {current ? '← Categories' : '← Back'}
        </button>
        <span>Interleaved Norwegian–English reading</span>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
        <h1 className="text-xl font-semibold">
          📚 Reading for interest
          {current && <span className="text-slate-400"> · {current.label}</span>}
        </h1>
        {!current && texts && texts.length > 0 && (
          <p className="mt-1 text-sm text-slate-400">
            Novels and folktales in the original, with the English beside them. Well above
            A1 — read for the pleasure of it. {texts.length}{' '}
            {texts.length === 1 ? 'text' : 'texts'} · {sentenceCount.toLocaleString()}{' '}
            sentences.
          </p>
        )}
        {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
        {!texts && !error && <p className="mt-4 text-slate-400">Loading library…</p>}
        {texts && texts.length === 0 && (
          <p className="mt-4 text-slate-300">
            The library is empty — import a text with the backend scripts (find_texts,
            prepare_text, import_text).
          </p>
        )}
        {current ? (
          <TextList texts={current.texts} onOpen={setOpen} />
        ) : (
          <CategoryIndex categories={categories} onPick={setKind} />
        )}
      </div>
    </div>
  )
}

// --- Category index ----------------------------------------------------------

function CategoryIndex({
  categories,
  onPick,
}: {
  categories: Category[]
  onPick: (kind: string) => void
}) {
  if (categories.length === 0) return null
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      {categories.map((c) => (
        <button
          key={c.kind}
          onClick={() => onPick(c.kind)}
          className="rounded-xl border border-white/15 p-4 text-left transition hover:border-sky-400/50 hover:bg-white/10"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-medium text-slate-100">{c.label}</span>
            <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-300">
              {c.texts.length} {c.texts.length === 1 ? 'text' : 'texts'}
            </span>
          </div>
          {c.blurb && <p className="mt-0.5 text-sm text-slate-400">{c.blurb}</p>}
          <p className="mt-2 text-xs text-slate-500">
            {c.sentences.toLocaleString()} sentences
            {c.started > 0 && ` · ${c.started} started`}
          </p>
        </button>
      ))}
    </div>
  )
}

// --- Texts in one category ---------------------------------------------------

function TextList({
  texts,
  onOpen,
}: {
  texts: TextSummary[]
  onOpen: (t: TextSummary) => void
}) {
  return (
    <div className="mt-4 grid gap-3">
      {texts.map((t) => {
        const pct = Math.min(100, Math.round((t.position / t.sentence_count) * 100))
        return (
          <button
            key={t.slug}
            onClick={() => onOpen(t)}
            className="rounded-xl border border-white/15 p-4 text-left transition hover:border-sky-400/50 hover:bg-white/10"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium text-slate-100">{t.title}</span>
              {t.title_en && (
                <span className="shrink-0 text-sm italic text-slate-400">{t.title_en}</span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-slate-400">{t.author}</p>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
              <div className="h-1.5 w-32 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-sky-400" style={{ width: `${pct}%` }} />
              </div>
              {t.position > 0
                ? `${pct}% · continue at sentence ${t.position}`
                : `${t.sentence_count} sentences`}
            </div>
          </button>
        )
      })}
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
          className="rounded-full px-1.5 py-0.5 font-medium transition hover:bg-white/10 hover:text-slate-200"
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
              ? 'border-white/15 text-slate-400 hover:border-sky-400/50'
              : 'border-sky-400 bg-sky-400/10 text-sky-300'
          }`}
        >
          {showEnglish ? 'Hide English' : 'English hidden — tap a line to peek'}
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
        <h1 className="text-xl font-semibold">{text.title}</h1>
        {text.title_en && (
          <p className="text-sm italic text-slate-400">{text.title_en}</p>
        )}
        <p className="mt-0.5 text-sm text-slate-400">{text.author}</p>
        {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
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
                    <p className="text-lg leading-snug text-slate-100">{s.no}</p>
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
