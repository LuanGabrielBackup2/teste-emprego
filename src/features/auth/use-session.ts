import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { clearSession } from '@/lib/auth/session-storage'
import { fetchSession, logout } from './auth-api'
import { sessionExpiredEvent } from '@/lib/auth/session-storage'

export const sessionQueryKey = ['session'] as const

export function useSession(validateOnMount = false) {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: sessionQueryKey, queryFn: fetchSession, retry: false, staleTime: Infinity, refetchOnMount: validateOnMount ? 'always' : false })
  useEffect(() => {
    const expire = () => {
      clearSession()
      queryClient.setQueryData(sessionQueryKey, null)
      queryClient.removeQueries({ queryKey: ['cart'] })
    }
    window.addEventListener(sessionExpiredEvent, expire)
    return () => window.removeEventListener(sessionExpiredEvent, expire)
  }, [queryClient])
  return query
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: logout, onSettled: () => {
    clearSession()
    queryClient.removeQueries({ queryKey: sessionQueryKey })
    queryClient.removeQueries({ queryKey: ['cart'] })
    queryClient.clear()
  } })
}
