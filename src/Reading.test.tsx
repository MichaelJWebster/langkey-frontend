// @vitest-environment jsdom
//
// The reading library now opens on categories rather than a flat list, so the
// navigation has three levels: index -> category -> reader. These cover the
// way down and back, and that an English title is shown beside the Norwegian
// one wherever the learner meets it.

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TextSummary } from './api'

const MYSTERIER: TextSummary = {
  slug: 'mysterier',
  title: 'Mysterier',
  title_en: 'Mysteries',
  author: 'Knut Hamsun',
  kind: 'novel',
  orthography: 'dano-1904',
  license: 'public domain',
  sentence_count: 7228,
  position: 0,
}

const BUKKENE: TextSummary = {
  ...MYSTERIER,
  slug: 'bukkene-bruse',
  title: 'De tre Bukkene Bruse',
  title_en: 'The Three Billy Goats Gruff',
  author: 'Asbjørnsen & Moe',
  kind: 'folktale',
  sentence_count: 40,
}

// No English title: the gates rejected it, so only the Norwegian is known.
const UNTITLED: TextSummary = {
  ...BUKKENE,
  slug: 'kveita',
  title: 'Kveita',
  title_en: null,
  author: 'Regine Normann',
}

vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  fetchTexts: async () => [MYSTERIER, BUKKENE, UNTITLED],
  fetchTextPage: async () => ({
    slug: 'mysterier',
    title: 'Mysterier',
    title_en: 'Mysteries',
    author: 'Knut Hamsun',
    from_seq: 1,
    to_seq: 1,
    sentence_count: 7228,
    sentences: [{ seq: 1, paragraph: 1, no: 'Det var i den Tid', en: 'It was at the time' }],
  }),
  saveReadingPosition: async () => ({ seq: 1 }),
}))

import Reading from './Reading'

afterEach(cleanup)

describe('reading library', () => {
  it('opens on categories with a count of texts in each', async () => {
    render(<Reading onBack={() => {}} />)

    await waitFor(() => expect(screen.getByText('Folktales')).toBeTruthy())
    expect(screen.getByText('Novels')).toBeTruthy()
    expect(screen.getByText('2 texts')).toBeTruthy() // two folktales
    expect(screen.getByText('1 text')).toBeTruthy() // one novel, singular

    // No individual text is listed until a category is chosen.
    expect(screen.queryByText('Mysterier')).toBeNull()
  })

  it('shows the English title beside the Norwegian one in a category', async () => {
    render(<Reading onBack={() => {}} />)
    await waitFor(() => expect(screen.getByText('Novels')).toBeTruthy())

    screen.getByText('Novels').click()

    await waitFor(() => expect(screen.getByText('Mysterier')).toBeTruthy())
    expect(screen.getByText('Mysteries')).toBeTruthy()
  })

  it('shows the Norwegian title alone when there is no translation', async () => {
    render(<Reading onBack={() => {}} />)
    await waitFor(() => expect(screen.getByText('Folktales')).toBeTruthy())

    screen.getByText('Folktales').click()

    await waitFor(() => expect(screen.getByText('Kveita')).toBeTruthy())
    expect(screen.getByText('The Three Billy Goats Gruff')).toBeTruthy()
    // Nothing invented for the one the gates rejected.
    expect(screen.queryByText('null')).toBeNull()
  })

  it('goes back from a category to the index, not out of reading', async () => {
    const onBack = vi.fn()
    render(<Reading onBack={onBack} />)
    await waitFor(() => expect(screen.getByText('Novels')).toBeTruthy())

    screen.getByText('Novels').click()
    await waitFor(() => expect(screen.getByText('Mysterier')).toBeTruthy())

    screen.getByText('← Categories').click()

    await waitFor(() => expect(screen.getByText('Folktales')).toBeTruthy())
    expect(onBack).not.toHaveBeenCalled()
  })

  it('leaves reading only from the category index', async () => {
    const onBack = vi.fn()
    render(<Reading onBack={onBack} />)
    await waitFor(() => expect(screen.getByText('Folktales')).toBeTruthy())

    screen.getByText('← Back').click()

    expect(onBack).toHaveBeenCalled()
  })

  it('opens a text into the reader', async () => {
    render(<Reading onBack={() => {}} />)
    await waitFor(() => expect(screen.getByText('Novels')).toBeTruthy())
    screen.getByText('Novels').click()
    await waitFor(() => expect(screen.getByText('Mysterier')).toBeTruthy())

    screen.getByText('Mysterier').click()

    await waitFor(() => expect(screen.getByText('Det var i den Tid')).toBeTruthy())
    // The reader keeps both titles in its header.
    expect(screen.getByText('Mysteries')).toBeTruthy()
  })
})
