import type { MarketplaceSession } from '@/contracts/account'

export const sessionStorageKey = 'jungle-market.session.v1'
export const sessionExpiredEvent = 'jungle-market:session-expired'

export function readStoredSession(): MarketplaceSession | null {
  try {
    const session = JSON.parse(localStorage.getItem(sessionStorageKey) ?? 'null') as MarketplaceSession | null
    return session?.token && session.user?.id ? session : null
  } catch { return null }
}

export function saveSession(session: MarketplaceSession) {
  localStorage.setItem(sessionStorageKey, JSON.stringify(session))
}

export function clearSession() {
  localStorage.removeItem(sessionStorageKey)
}
