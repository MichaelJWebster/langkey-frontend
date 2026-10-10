// @vitest-environment jsdom
//
// The vocabulary screen's job is to tell the truth about progress. Michael's
// complaint was that a category heading described a deck of unrelated words
// (ADR-038), so these cover the two claims the screen now makes: the overall
// bar counts each word once, and a category card reports its own slice.

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

vi.mock('./ReviewSession', () => ({
  default: ({ options }: { options: Record<string, unknown> }) => (
    <div data-testid="session">{JSON.stringify(options)}</div>
  ),
}))

import { VocabularyScreen } from './Dashboard'
import type { Categories, CardBreakdown } from './api'

afterEach(cleanup)

const CATEGORIES: Categories = {
  categories: [
    {
      category: 'essentials',
      label: 'Everyday essentials',
      blurb: 'the commonest words',
      total: 100,
      remaining: 60,
      established: 30,
    },
    {
      category: 'food',
      label: 'Food & drink',
      blurb: 'eating and drinking',
      total: 50,
      remaining: 50,
      established: 0,
    },
  ],
  // Deliberately below the sum of the two above: words sit in both.
  overall: {
    category: 'all',
    label: 'All words',
    blurb: '',
    total: 120,
    remaining: 80,
    established: 30,
  },
}

const BREAKDOWN: CardBreakdown = {
  unseen: 80,
  learning: 8,
  relearning: 2,
  established: 30,
}

const EMPTY: CardBreakdown = { unseen: 120, learning: 0, relearning: 0, established: 0 }

it('reports whole-deck progress counting each word once', () => {
  render(
    <VocabularyScreen categories={CATEGORIES} breakdown={BREAKDOWN} onBack={() => {}} />,
  )
  // 30 of 120 — not 30 of 150, which is what summing the categories would give.
  expect(screen.getByText(/30 OF 120 WORDS ESTABLISHED/i)).toBeTruthy()
  expect(screen.getByText(/10 in progress · 80 not met yet/)).toBeTruthy()
})

it('shows each category its own slice of progress', () => {
  render(
    <VocabularyScreen categories={CATEGORIES} breakdown={BREAKDOWN} onBack={() => {}} />,
  )
  expect(screen.getByText('Everyday essentials')).toBeTruthy()
  expect(screen.getByText('30/100')).toBeTruthy()
  expect(screen.getByText('Food & drink')).toBeTruthy()
  expect(screen.getByText('0/50')).toBeTruthy()
})

it('starts a category deck restricted to that category', () => {
  render(
    <VocabularyScreen categories={CATEGORIES} breakdown={BREAKDOWN} onBack={() => {}} />,
  )
  fireEvent.click(screen.getByText('Food & drink').closest('button')!)
  expect(JSON.parse(screen.getByTestId('session').textContent!)).toEqual({ category: 'food' })
})

it('starts the repetition deck with no new cards and a bigger limit', () => {
  render(
    <VocabularyScreen categories={CATEGORIES} breakdown={BREAKDOWN} onBack={() => {}} />,
  )
  fireEvent.click(screen.getByText(/Keep it all alive/).closest('button')!)
  expect(JSON.parse(screen.getByTestId('session').textContent!)).toEqual({
    mode: 'repeat',
    limit: 40,
  })
})

it('disables repetition until something has been met', () => {
  render(<VocabularyScreen categories={CATEGORIES} breakdown={EMPTY} onBack={() => {}} />)
  const button = screen.getByText(/Keep it all alive/).closest('button')!
  expect(button.disabled).toBe(true)
  expect(screen.getByText(/nothing met yet/)).toBeTruthy()
})

it('renders without category data rather than blanking the screen', () => {
  render(<VocabularyScreen categories={null} breakdown={BREAKDOWN} onBack={() => {}} />)
  expect(screen.getByText(/By frequency/)).toBeTruthy()
})
