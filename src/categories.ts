// Grouping the reading library into broad categories.
//
// A category is just a text's `kind`, which the import pipeline sets from
// prepare_text's --kind. There is deliberately no category table: a new kind
// becomes a new category the moment the first text using it is imported, with
// a label derived from the kind itself, so adding one costs an import and no
// code. KINDS only overrides the labels and ordering we care about.

import type { TextSummary } from './api'

/** Display name and order for the kinds we have. Anything else still shows. */
const KNOWN: { kind: string; label: string; blurb: string }[] = [
  { kind: 'folktale', label: 'Folktales', blurb: 'Short tales — the gentlest way in' },
  { kind: 'novel', label: 'Novels', blurb: 'Full-length fiction, in chapters' },
  { kind: 'nonfiction', label: 'Non-fiction', blurb: 'Essays, history, memoir' },
  { kind: 'article', label: 'Articles', blurb: 'Short contemporary pieces' },
]

const ORDER = new Map(KNOWN.map((k, i) => [k.kind, i]))
const BY_KIND = new Map(KNOWN.map((k) => [k.kind, k]))

/** "short story" / "short_story" / "shortStory" -> "Short story". */
export function labelFor(kind: string): string {
  const known = BY_KIND.get(kind)
  if (known) return known.label
  const words = kind.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export interface Category {
  kind: string
  label: string
  blurb: string | null
  texts: TextSummary[]
  /** Texts the learner has opened at least once. */
  started: number
  sentences: number
}

export function categorise(texts: TextSummary[]): Category[] {
  const groups = new Map<string, TextSummary[]>()
  for (const t of texts) {
    const list = groups.get(t.kind)
    if (list) list.push(t)
    else groups.set(t.kind, [t])
  }

  return [...groups.entries()]
    .map(([kind, group]) => ({
      kind,
      label: labelFor(kind),
      blurb: BY_KIND.get(kind)?.blurb ?? null,
      texts: [...group].sort((a, b) => a.title.localeCompare(b.title, 'nb')),
      started: group.filter((t) => t.position > 0).length,
      sentences: group.reduce((n, t) => n + t.sentence_count, 0),
    }))
    .sort((a, b) => {
      // Known kinds first in their listed order, then anything new by name, so
      // an unfamiliar kind lands at the end rather than jumbling the top.
      const ai = ORDER.get(a.kind) ?? Number.MAX_SAFE_INTEGER
      const bi = ORDER.get(b.kind) ?? Number.MAX_SAFE_INTEGER
      return ai !== bi ? ai - bi : a.label.localeCompare(b.label)
    })
}
