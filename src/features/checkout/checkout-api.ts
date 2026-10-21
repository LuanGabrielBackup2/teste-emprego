import type { AxiosError } from 'axios'
import type { CheckoutQuote, CreateOrderInput, MarketplaceOrder, MockWallet, OrderResponse } from '@/contracts/order'
import type { ApiErrorResponse } from '@/contracts/order'
import { apiClient } from '@/lib/api/client'

export async function fetchCheckoutQuote() {
  try { return (await apiClient.get<{ quote: CheckoutQuote }>('/api/checkout/quote')).data.quote }
  catch (error) {
    const current = (error as AxiosError<ApiErrorResponse>).response?.data.error.currentQuote
    // Conflito de estoque ainda contém uma cotação útil para mostrar o item indisponível.
    if (current && (error as AxiosError<ApiErrorResponse>).response?.data.error.code === 'EDITION_UNAVAILABLE') return current
    throw error
  }
}

export async function fetchWallets() {
  return (await apiClient.get<{ wallets: MockWallet[] }>('/api/wallets')).data.wallets
}

export async function connectWallet(walletId: string) {
  return (await apiClient.post<{ connected: boolean }>(`/api/wallets/${encodeURIComponent(walletId)}/connect`)).data
}

export async function disconnectWallet(walletId: string) {
  return (await apiClient.post<{ connected: false }>(`/api/wallets/${encodeURIComponent(walletId)}/disconnect`)).data
}

export async function fetchOrder(orderId: string) {
  return (await apiClient.get<OrderResponse>(`/api/orders/${encodeURIComponent(orderId)}`)).data.order
}

export async function fetchOrderByIdempotencyKey(key: string) {
  return (await apiClient.get<OrderResponse>(`/api/orders/by-idempotency/${encodeURIComponent(key)}`)).data.order
}

export async function createOrder(input: CreateOrderInput, idempotencyKey: string): Promise<MarketplaceOrder> {
  try {
    return (await apiClient.post<OrderResponse>('/api/orders', input, { headers: { 'Idempotency-Key': idempotencyKey } })).data.order
  } catch (error) {
    // Se a conexão caiu depois da persistência, consultar pela chave recupera a mesma compra.
    const networkFailure = (error as AxiosError<ApiErrorResponse>).response === undefined
    if (networkFailure) {
      try { return await fetchOrderByIdempotencyKey(idempotencyKey) } catch { /* mantém o erro original */ }
    }
    throw error
  }
}
