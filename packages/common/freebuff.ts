import { hasConsented } from './consent-state'

export const FREEBUFF_TAG_URL = 'https://freebuff.com/freebuff-tag.js'

/**
 * Conversion types Freebuff has reviewed. Custom lowercase snake_case events
 * are accepted too, so the union stays open.
 */
export type FreebuffReviewedEvent =
  | 'signup_completed'
  | 'demo_booked'
  | 'trial_started'
  | 'installation_completed'
  | 'subscription_started'

export type FreebuffEventType = FreebuffReviewedEvent | (string & {})

type FreebuffFn = {
  (...args: unknown[]): void
  q?: unknown[]
}

type FreebuffWindow = Window & { freebuff?: FreebuffFn }

const EVENT_TYPE_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/

/**
 * Freebuff's tag reads `window.freebuff` and drains `window.freebuff.q`, so
 * the queue has to exist whether or not the script has finished loading.
 * Mirrors the stub in Freebuff's own install snippet.
 */
function getFreebuffQueue(): FreebuffFn | null {
  if (typeof window === 'undefined') return null

  const target = window as FreebuffWindow
  if (!target.freebuff) {
    const queue: FreebuffFn = function (this: unknown) {
      ;(queue.q = queue.q || []).push(arguments)
    }
    target.freebuff = queue
  }

  return target.freebuff
}

/**
 * Report a conversion through Freebuff's browser tag.
 *
 * `eventId` is the idempotency key and must be stable and unique for the
 * conversion. The same value has to be sent on the server-side postback for
 * the two reports to dedupe into one.
 */
export function trackFreebuffConversion(eventType: FreebuffEventType, eventId?: string): void {
  if (!hasConsented()) return

  if (!EVENT_TYPE_PATTERN.test(eventType) || eventType.length > 64) return

  const freebuff = getFreebuffQueue()
  if (!freebuff) return

  try {
    if (eventId) {
      freebuff('conversion', eventType, { eventId })
    } else {
      freebuff('conversion', eventType)
    }
  } catch {
    // Conversion reporting must not interrupt the flow that triggered it.
  }
}
