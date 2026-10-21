import type { CartQuote } from './cart'

export type OrderStatus = 'pending' | 'confirmed' | 'declined'
export type MarketplaceNetwork = 'ethereum' | 'polygon'

export interface MockWallet {
  id: string
  label: string
  address: string
  network: MarketplaceNetwork
  isPrimary: boolean
}

export interface CheckoutBuyer {
  name: string
  email: string
  document: string
}

export interface CheckoutQuote {
  version: string
  items: Array<{
    nftId: string
    name: string
    collection: string
    creator: string
    imageUrl: string
    quantity: number
    priceBRL: string
    lineSubtotalBRL: string
    available: number
    nftVersion: number
  }>
  quote: CartQuote
  createdAt: string
}

export interface CreateOrderInput {
  quoteVersion: string
  buyer: CheckoutBuyer
  walletId: string
  network: MarketplaceNetwork
}

export interface OrderSnapshotLine {
  nftId: string
  name: string
  collection: string
  creator: string
  imageUrl: string
  quantity: number
  priceBRL: string
  lineSubtotalBRL: string
}

export interface OrderSnapshot {
  items: OrderSnapshotLine[]
  quote: CartQuote
  buyer: CheckoutBuyer
  wallet: MockWallet
  network: MarketplaceNetwork
}

export interface MarketplaceOrder {
  id: string
  idempotencyKey: string
  requestFingerprint: string
  userId: string
  status: OrderStatus
  version: number
  createdAt: string
  updatedAt: string
  snapshot: OrderSnapshot
  transactionReference?: string
}

export interface OrderResponse { order: MarketplaceOrder }

export interface ApiErrorResponse {
  error: { code: string; message: string; currentQuote?: CheckoutQuote }
}
