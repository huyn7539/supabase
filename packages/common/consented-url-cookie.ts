const COOKIE_NAME = 'bfcid'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30

function getParameterValue(url: string): string | null {
  try {
    const values = new URL(url).searchParams.getAll(COOKIE_NAME)
    if (values.length !== 1) return null

    const value = values[0]
    // Check that the opaque parameter can be stored unchanged in a cookie.
    const isValid =
      value.startsWith('bfc_') &&
      value.length > 4 &&
      value.length <= 600 &&
      !/[^A-Za-z0-9._-]/.test(value)
    return isValid ? value : null
  } catch {
    return null
  }
}

function getCookieOptions(): string {
  const { hostname, protocol } = window.location
  const isSupabaseDomain = hostname === 'supabase.com' || hostname.endsWith('.supabase.com')

  return `Path=/; SameSite=Lax${isSupabaseDomain ? '; Domain=supabase.com' : ''}${protocol === 'https:' ? '; Secure' : ''}`
}

export function clearConsentedUrlCookie(): void {
  if (typeof document === 'undefined') return

  try {
    document.cookie = `${COOKIE_NAME}=; Max-Age=0; ${getCookieOptions()}`
    // Also remove any host-only copy created on this host.
    document.cookie = `${COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`
  } catch {
    // Cookie restrictions must not prevent a consent update.
  }
}

/** Retain a URL parameter in memory until consent permits writing a cookie. */
export function createConsentedUrlCookieSync() {
  let pendingValue: string | null = null
  let hasPreviouslyAccepted = false

  return (hasAccepted: boolean): void => {
    if (typeof window === 'undefined') return

    pendingValue = getParameterValue(window.location.href) ?? pendingValue

    if (!hasAccepted) {
      if (hasPreviouslyAccepted) {
        clearConsentedUrlCookie()
        pendingValue = null
      }
      hasPreviouslyAccepted = false
      return
    }

    hasPreviouslyAccepted = true
    if (!pendingValue) return

    try {
      const cookie = `${COOKIE_NAME}=${pendingValue}`
      const hasSameValue = document.cookie.split(';').some((part) => part.trim() === cookie)

      // Ordinary navigation must not extend the original cookie lifetime.
      if (!hasSameValue) {
        document.cookie = `${cookie}; Max-Age=${COOKIE_MAX_AGE}; ${getCookieOptions()}`
      }
    } catch {
      // Cookie restrictions must not prevent the existing script from loading.
    }

    pendingValue = null
  }
}
