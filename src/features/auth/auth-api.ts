import type { AuthResponse, LoginInput, MarketplaceSession, RegisterInput } from '@/contracts/account'
import type { CartResponse } from '@/contracts/cart'
import { apiClient } from '@/lib/api/client'
import { clearSession, readStoredSession, saveSession } from '@/lib/auth/session-storage'

export async function fetchSession(): Promise<MarketplaceSession | null> {
  if (!readStoredSession()) return null
  try {
    const response = await apiClient.get<{ session: MarketplaceSession }>('/api/session')
    return response.data.session
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'response' in error && (error as { response?: { status?: number } }).response?.status === 401) {
      clearSession()
      return null
    }
    throw error
  }
}

export async function login(input: LoginInput): Promise<{ session: MarketplaceSession; cart: CartResponse }> {
  const response = await apiClient.post<AuthResponse>('/api/auth/login', input)
  saveSession(response.data.session)
  try {
    await apiClient.post('/api/cart/merge-guest')
    const cart = await apiClient.get<CartResponse>('/api/cart')
    return { session: response.data.session, cart: cart.data }
  }
  catch (error) { clearSession(); throw error }
}

export async function register(input: RegisterInput): Promise<{ session: MarketplaceSession; cart: CartResponse }> {
  const response = await apiClient.post<AuthResponse>('/api/auth/register', input)
  saveSession(response.data.session)
  try {
    await apiClient.post('/api/cart/merge-guest')
    const cart = await apiClient.get<CartResponse>('/api/cart')
    return { session: response.data.session, cart: cart.data }
  }
  catch (error) { clearSession(); throw error }
}

export async function logout(): Promise<void> {
  try { await apiClient.post('/api/auth/logout') } finally { clearSession() }
}
