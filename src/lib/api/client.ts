import axios from 'axios'
import { clearSession, readStoredSession, sessionExpiredEvent } from '@/lib/auth/session-storage'

// As chamadas simuladas e futuras chamadas REST compartilham esta instância.
export const apiClient = axios.create({
  timeout: 8_000,
  headers: {
    Accept: 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const session = readStoredSession()
  if (session) config.headers.Authorization = `Bearer ${session.token}`
  return config
})

apiClient.interceptors.response.use((response) => response, (error: unknown) => {
  if (axios.isAxiosError(error) && error.response?.status === 401 && error.config?.headers.Authorization) {
    clearSession()
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(sessionExpiredEvent))
  }
  return Promise.reject(error)
})
