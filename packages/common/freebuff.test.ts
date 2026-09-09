// @vitest-environment jsdom
/// <reference types="vitest/jsdom" />
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { hasConsented } from './consent-state'
import { trackFreebuffConversion } from './freebuff'

vi.hoisted(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false })
})

vi.mock('./consent-state', () => ({ hasConsented: vi.fn(() => true) }))

const mockHasConsented = vi.mocked(hasConsented)

function queuedCalls() {
  return ((window as any).freebuff?.q ?? []) as IArguments[]
}

beforeEach(() => {
  delete (window as any).freebuff
  mockHasConsented.mockReturnValue(true)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('trackFreebuffConversion', () => {
  it('queues the conversion with the event id as the idempotency key', () => {
    trackFreebuffConversion('signup_completed', 'user-1')

    expect(Array.from(queuedCalls()[0])).toEqual([
      'conversion',
      'signup_completed',
      { eventId: 'user-1' },
    ])
  })

  it('omits the payload when no event id is available', () => {
    trackFreebuffConversion('trial_started')

    expect(Array.from(queuedCalls()[0])).toEqual(['conversion', 'trial_started'])
  })

  it('reports nothing without consent', () => {
    mockHasConsented.mockReturnValue(false)

    trackFreebuffConversion('signup_completed', 'user-1')

    expect((window as any).freebuff).toBeUndefined()
  })

  it('reuses the tag when it has already loaded', () => {
    const loadedTag = vi.fn()
    ;(window as any).freebuff = loadedTag

    trackFreebuffConversion('subscription_started', 'order-1')

    expect(loadedTag).toHaveBeenCalledWith('conversion', 'subscription_started', {
      eventId: 'order-1',
    })
  })

  it('accepts a custom snake_case event type', () => {
    trackFreebuffConversion('proposal_sent', 'lead-1')

    expect(queuedCalls()).toHaveLength(1)
  })

  it.each(['Signup_Completed', 'signup completed', 'signup-completed', '_signup', 'signup__x', ''])(
    'rejects the malformed event type %s',
    (eventType) => {
      trackFreebuffConversion(eventType, 'user-1')

      expect((window as any).freebuff).toBeUndefined()
    }
  )

  it('rejects an event type longer than 64 characters', () => {
    trackFreebuffConversion('a'.repeat(65), 'user-1')

    expect((window as any).freebuff).toBeUndefined()
  })

  it('does not throw when the loaded tag throws', () => {
    ;(window as any).freebuff = vi.fn(() => {
      throw new Error('tag blocked')
    })

    expect(() => trackFreebuffConversion('signup_completed', 'user-1')).not.toThrow()
  })

  it('does not touch browser globals during server rendering', () => {
    vi.stubGlobal('window', undefined)

    expect(() => trackFreebuffConversion('signup_completed', 'user-1')).not.toThrow()
  })
})
