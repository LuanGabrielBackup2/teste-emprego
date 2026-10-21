import type { AddCartItemInput, CartResponse } from '@/contracts/cart'
import { apiClient } from '@/lib/api/client'

export async function fetchCart(): Promise<CartResponse> {
  return (await apiClient.get<CartResponse>('/api/cart')).data
}

export async function addCartItem(input: AddCartItemInput): Promise<CartResponse> {
  return (await apiClient.post<CartResponse>('/api/cart/items', input)).data
}

export async function updateCartQuantity(nftId: string, quantity: number): Promise<CartResponse> {
  return (await apiClient.patch<CartResponse>(`/api/cart/items/${encodeURIComponent(nftId)}`, { quantity })).data
}

export async function removeCartItem(nftId: string): Promise<CartResponse> {
  return (await apiClient.delete<CartResponse>(`/api/cart/items/${encodeURIComponent(nftId)}`)).data
}

export async function clearCart(): Promise<CartResponse> {
  return (await apiClient.delete<CartResponse>('/api/cart')).data
}

export async function applyCartCoupon(code: string): Promise<CartResponse> {
  return (await apiClient.post<CartResponse>('/api/cart/coupon', { code })).data
}

export async function removeCartCoupon(): Promise<CartResponse> {
  return (await apiClient.delete<CartResponse>('/api/cart/coupon')).data
}
