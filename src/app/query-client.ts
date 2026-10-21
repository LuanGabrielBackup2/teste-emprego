import { QueryClient } from '@tanstack/react-query'

// Mantém erros previsíveis enquanto cada fluxo da aplicação for conectado.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})
