import type { CartLine, CartQuote } from '@/contracts/cart'
import { centsToDecimal, parseBRLToCents } from './money-brl'

export function calculateCartQuote(items: CartLine[], couponCode?: string): CartQuote {
  const subtotalCents = items.reduce(
    (total, item) => total + parseBRLToCents(item.nft.priceBRL) * BigInt(item.quantity),
    0n,
  )
  const discountCents = couponCode === 'JUNGLE10' ? (subtotalCents * 1000n + 5000n) / 10000n : 0n
  // NFTs são bens digitais; nenhuma taxa de rede é cobrada nesta política de simulação.
  const networkFeeCents = 0n

  return {
    subtotalBRL: centsToDecimal(subtotalCents),
    discountBRL: centsToDecimal(discountCents),
    networkFeeBRL: centsToDecimal(networkFeeCents),
    totalBRL: centsToDecimal(subtotalCents - discountCents + networkFeeCents),
    couponCode,
    couponDescription: couponCode === 'JUNGLE10' ? '10% de desconto' : undefined,
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
  }
}
