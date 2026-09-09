// @vitest-environment jsdom
/// <reference types="vitest/jsdom" />
import { afterEach, describe, expect, it, vi } from 'vitest'

import { clearConsentedUrlCookie, createConsentedUrlCookieSync } from './consented-url-cookie'

const COOKIE_VALUE = 'bfc_test_1.Opaque_Value.signature'
const SECOND_COOKIE_VALUE = 'bfc_test_1.Second_Value.signature'

function openPage(url = `https://supabase.com/?bfcid=${COOKIE_VALUE}`) {
  jsdom.reconfigure({ url })
  return jsdom
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  jsdom.cookieJar.removeAllCookiesSync()
})

describe('consented URL cookie', () => {
  it('keeps the URL parameter in memory until consent, including after SPA navigation', () => {
    const page = openPage()
    const sync = createConsentedUrlCookieSync()

    sync(false)
    expect(document.cookie).toBe('')
    window.history.replaceState(null, '', '/next-page')
    sync(false)
    expect(document.cookie).toBe('')

    sync(true)
    expect(page.cookieJar.getCookieStringSync('https://subdomain.supabase.com/endpoint')).toBe(
      `bfcid=${COOKIE_VALUE}`
    )
  })

  it('makes the unchanged cookie value available across subdomains and paths', () => {
    const page = openPage()
    createConsentedUrlCookieSync()(true)

    const cookies = page.cookieJar.getCookiesSync('https://subdomain.supabase.com/endpoint')
    expect(cookies).toHaveLength(1)
    expect(cookies[0]).toMatchObject({
      key: 'bfcid',
      value: COOKIE_VALUE,
      domain: 'supabase.com',
      path: '/',
      secure: true,
      sameSite: 'lax',
      maxAge: 2_592_000,
    })
    expect(page.cookieJar.getCookieStringSync('https://supabase.com/next-page')).toBe(
      `bfcid=${COOKIE_VALUE}`
    )
    expect(page.cookieJar.getCookieStringSync('https://example.com/')).toBe('')
    expect(page.cookieJar.getCookieStringSync('http://subdomain.supabase.com/endpoint')).toBe('')
  })

  it('preserves the cookie on later visits without refreshing its lifetime', () => {
    const page = openPage()
    createConsentedUrlCookieSync()(true)
    const writeCookie = vi.spyOn(document, 'cookie', 'set')

    createConsentedUrlCookieSync()(true)
    window.history.replaceState(null, '', '/next-page')
    createConsentedUrlCookieSync()(true)

    expect(writeCookie).not.toHaveBeenCalled()
    expect(page.cookieJar.getCookieStringSync('https://subdomain.supabase.com/')).toBe(
      `bfcid=${COOKIE_VALUE}`
    )
  })

  it('replaces the cookie when a new consented URL parameter arrives', () => {
    openPage()
    createConsentedUrlCookieSync()(true)
    window.history.replaceState(null, '', `/?bfcid=${SECOND_COOKIE_VALUE}`)
    createConsentedUrlCookieSync()(true)
    expect(document.cookie).toBe(`bfcid=${SECOND_COOKIE_VALUE}`)
  })

  it('does not erase a returning visitor’s cookie while consent initializes', () => {
    openPage()
    createConsentedUrlCookieSync()(true)
    window.history.replaceState(null, '', '/next-page')
    const sync = createConsentedUrlCookieSync()

    sync(false)
    sync(true)
    expect(document.cookie).toBe(`bfcid=${COOKIE_VALUE}`)
  })

  it('clears the cookie on withdrawal without clearing unrelated cookies', () => {
    const page = openPage()
    const sync = createConsentedUrlCookieSync()
    sync(true)
    document.cookie = 'unrelated=keep; Path=/'
    window.history.replaceState(null, '', '/next-page')

    sync(false)
    expect(document.cookie).toBe('unrelated=keep')
    expect(page.cookieJar.getCookieStringSync('https://subdomain.supabase.com/')).toBe('')
    sync(true)
    expect(document.cookie).toBe('unrelated=keep')
  })

  it('clears host-only and shared cookies for an explicit denial', () => {
    const page = openPage()
    createConsentedUrlCookieSync()(true)
    document.cookie = `bfcid=${SECOND_COOKIE_VALUE}; Path=/`

    clearConsentedUrlCookie()
    expect(document.cookie).toBe('')
    expect(page.cookieJar.getCookieStringSync('https://subdomain.supabase.com/')).toBe('')
  })

  it.each([
    '',
    '?bfcid=',
    '?bfcid=bfc_',
    '?bfcid=invalid-value',
    '?bfcid=bfc_unsafe%3Bvalue',
    '?bfcid=bfc_unsafe%0A',
    '?bfcid=bfc_unsafe%0D',
    '?bfcid=bfc_unsafe+value',
    `?bfcid=bfc_${'a'.repeat(597)}`,
    `?bfcid=${COOKIE_VALUE}&bfcid=${SECOND_COOKIE_VALUE}`,
  ])('does not store missing, ambiguous or unsafe values: %s', (query) => {
    openPage(`https://supabase.com/${query}`)
    createConsentedUrlCookieSync()(true)
    expect(document.cookie).toBe('')
  })

  it('preserves the full 600-character identifier without truncation', () => {
    const cookieValue = `bfc_${'a'.repeat(596)}`
    openPage(`https://supabase.com/?bfcid=${cookieValue}`)
    createConsentedUrlCookieSync()(true)
    expect(document.cookie).toBe(`bfcid=${cookieValue}`)
  })

  it.each(['http://localhost:3000', 'https://preview.example.com', 'https://supabase.com.example'])(
    'uses host-only storage on a development or preview origin: %s',
    (origin) => {
      const page = openPage(`${origin}/?bfcid=${COOKIE_VALUE}`)
      createConsentedUrlCookieSync()(true)
      expect(document.cookie).toBe(`bfcid=${COOKIE_VALUE}`)
      expect(page.cookieJar.getCookiesSync(origin)[0].hostOnly).toBe(true)
      expect(page.cookieJar.getCookieStringSync('https://subdomain.supabase.com/')).toBe('')
    }
  )

  it('does not throw during cookie setup or consent changes when storage is blocked', () => {
    openPage()
    vi.spyOn(document, 'cookie', 'get').mockImplementation(() => {
      throw new Error('Cookie access blocked')
    })
    vi.spyOn(document, 'cookie', 'set').mockImplementation(() => {
      throw new Error('Cookie access blocked')
    })

    const sync = createConsentedUrlCookieSync()
    expect(() => sync(true)).not.toThrow()
    expect(() => sync(false)).not.toThrow()
    expect(() => clearConsentedUrlCookie()).not.toThrow()
  })

  it('does not access browser globals during server rendering', () => {
    vi.stubGlobal('window', undefined)
    vi.stubGlobal('document', undefined)
    expect(() => createConsentedUrlCookieSync()(true)).not.toThrow()
    expect(() => clearConsentedUrlCookie()).not.toThrow()
  })
})
