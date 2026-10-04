// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AudioAlert from './AudioAlert'
import { clearAudioFailure, speak } from './speech'

function respond(status: number) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(status === 200 ? new Blob(['x']) : null, { status })),
  )
}

beforeEach(() => {
  clearAudioFailure()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('AudioAlert', () => {
  it('shows nothing while audio is working', () => {
    render(<AudioAlert />)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('surfaces an outage rather than letting it pass silently', async () => {
    respond(503)
    render(<AudioAlert />)
    await speak('hvorfor', '/api/v1/audio/nb/x.wav')

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Audio storage is unavailable')
    // The learner is told no substitute voice was used in its place.
    expect(alert.textContent).toContain('not being substituted')
  })

  it('distinguishes an ungenerated clip from an outage', async () => {
    respond(404)
    render(<AudioAlert />)
    await speak('hvorfor', '/api/v1/audio/nb/x.wav')

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('has not been generated yet')
  })

  it('logs every failure for diagnosis', async () => {
    respond(503)
    render(<AudioAlert />)
    await speak('hvorfor', '/api/v1/audio/nb/x.wav')
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[audio]'))
  })

  it('can be dismissed', async () => {
    respond(503)
    render(<AudioAlert />)
    await speak('hvorfor', '/api/v1/audio/nb/x.wav')
    await screen.findByRole('alert')

    screen.getByLabelText('Dismiss').click()
    await vi.waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })
})

describe('speak', () => {
  it('never falls back to the browser voice', async () => {
    respond(503)
    const synth = vi.fn()
    vi.stubGlobal('speechSynthesis', { speak: synth, cancel: vi.fn(), getVoices: () => [] })

    await speak('hvorfor', '/api/v1/audio/nb/x.wav')

    // Substituting a voice is what hid a stopped object store for a session.
    expect(synth).not.toHaveBeenCalled()
  })
})
