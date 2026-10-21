import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CartResponse } from '@/contracts/cart'
import { calculateCartQuote } from '@/domain/cart'
import { centsToDecimal, parseBRLToCents } from '@/domain/money-brl'
import { addCartItem, applyCartCoupon, clearCart, fetchCart, removeCartCoupon, removeCartItem, updateCartQuantity } from './cart-api'
import { readStoredSession } from '@/lib/auth/session-storage'
import { useSession } from '@/features/auth/use-session'

export function cartQueryKey() { return ['cart', readStoredSession()?.user.id ?? 'guest'] as const }

export function useCartQuery() {
  const storedSession = readStoredSession()
  const session = useSession()
  return useQuery({ queryKey: cartQueryKey(), queryFn: fetchCart, retry: false, enabled: !storedSession || session.isSuccess || session.isError })
}

function setOptimisticCart(queryClient: ReturnType<typeof useQueryClient>, update: (cart: CartResponse) => CartResponse) {
  const key = cartQueryKey()
  const previous = queryClient.getQueryData<CartResponse>(key)
  if (previous) queryClient.setQueryData<CartResponse>(key, update(previous))
  return { previous }
}

function useCartMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<CartResponse>, optimistic?: (cart: CartResponse, variables: TVariables) => CartResponse) {
  const queryClient = useQueryClient()
  const key = cartQueryKey()
  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: key })
      return optimistic ? setOptimisticCart(queryClient, (cart) => optimistic(cart, variables)) : { previous: undefined }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSuccess: (cart) => queryClient.setQueryData(key, cart),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

export function useAddCartItem() {
  return useCartMutation(addCartItem)
}

export function useUpdateCartQuantity() {
  return useCartMutation(
    ({ nftId, quantity }: { nftId: string; quantity: number }) => updateCartQuantity(nftId, quantity),
    (cart, { nftId, quantity }) => {
      const items = cart.items.map((line) => line.nft.id === nftId
        ? { ...line, quantity, lineSubtotalBRL: centsToDecimal(parseBRLToCents(line.nft.priceBRL) * BigInt(quantity)) }
        : line)
      return { items, quote: calculateCartQuote(items, cart.quote.couponCode) }
    },
  )
}

export function useRemoveCartItem() {
  return useCartMutation((nftId: string) => removeCartItem(nftId), (cart, nftId) => {
    const items = cart.items.filter((line) => line.nft.id !== nftId)
    return { items, quote: calculateCartQuote(items, cart.quote.couponCode) }
  })
}

export function useClearCart() {
  return useCartMutation(clearCart, () => ({ items: [], quote: calculateCartQuote([]) }))
}

export function useApplyCartCoupon() {
  return useCartMutation((code: string) => applyCartCoupon(code))
}

export function useRemoveCartCoupon() {
  return useCartMutation(removeCartCoupon)
}
