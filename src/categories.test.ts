// Grouping the reading library. The behaviour worth pinning is that a kind
// nobody wrote code for still becomes a category -- that is the whole reason
// there is no category table.

import { describe, expect, it } from 'vitest'
import { categorise, labelFor } from './categories'
import type { TextSummary } from './api'

function text(over: Partial<TextSummary> & { slug: string; kind: string }): TextSummary {
  return {
    title: over.slug,
    title_en: null,
    author: null,
    orthography: 'nb',
    license: null,
    sentence_count: 100,
    position: 0,
    ...over,
  }
}

describe('categorise', () => {
  it('groups texts by kind and counts them', () => {
    const cats = categorise([
      text({ slug: 'a', kind: 'folktale' }),
      text({ slug: 'b', kind: 'folktale' }),
      text({ slug: 'c', kind: 'novel' }),
    ])

    expect(cats.map((c) => [c.label, c.texts.length])).toEqual([
      ['Folktales', 2],
      ['Novels', 1],
    ])
  })

  it('puts an unfamiliar kind at the end rather than dropping it', () => {
    const cats = categorise([
      text({ slug: 'p', kind: 'poetry' }),
      text({ slug: 'n', kind: 'novel' }),
      text({ slug: 'f', kind: 'folktale' }),
    ])

    // Known kinds keep their intended order; the new one lands last with a
    // label derived from the kind itself.
    expect(cats.map((c) => c.label)).toEqual(['Folktales', 'Novels', 'Poetry'])
  })

  it('leaves out a category with no texts', () => {
    const cats = categorise([text({ slug: 'a', kind: 'folktale' })])
    expect(cats).toHaveLength(1)
  })

  it('is empty for an empty library', () => {
    expect(categorise([])).toEqual([])
  })

  it('totals sentences and counts how many texts are under way', () => {
    const cats = categorise([
      text({ slug: 'a', kind: 'novel', sentence_count: 7228, position: 400 }),
      text({ slug: 'b', kind: 'novel', sentence_count: 500, position: 0 }),
    ])

    expect(cats[0].sentences).toBe(7728)
    expect(cats[0].started).toBe(1)
  })

  it('sorts texts within a category by Norwegian title', () => {
    const cats = categorise([
      text({ slug: 'c', kind: 'folktale', title: 'Åsgårdsreia' }),
      text({ slug: 'a', kind: 'folktale', title: 'Bukkene Bruse' }),
      text({ slug: 'b', kind: 'folktale', title: 'Ærlige Per' }),
    ])

    // æ ø å sort after z in Norwegian, not among the a's.
    expect(cats[0].texts.map((t) => t.title)).toEqual([
      'Bukkene Bruse',
      'Ærlige Per',
      'Åsgårdsreia',
    ])
  })
})

describe('labelFor', () => {
  it.each([
    ['folktale', 'Folktales'],
    ['novel', 'Novels'],
    ['nonfiction', 'Non-fiction'],
    ['short_story', 'Short story'],
    ['short-story', 'Short story'],
    ['poetry', 'Poetry'],
  ])('%s -> %s', (kind, label) => {
    expect(labelFor(kind)).toBe(label)
  })
})
