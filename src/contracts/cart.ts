import type { Nft } from './nft'

export interface CartLine {
  nft: Nft
  quantity: number
  lineSubtotalBRL: string
}

export interface CartQuote {
  subtotalBRL: string
  discountBRL: string
  networkFeeBRL: string
  totalBRL: string
  couponCode?: string
  couponDescription?: string
  itemCount: number
}

export interface CartResponse {
  items: CartLine[]
  quote: CartQuote
}

export interface CartErrorResponse {
  error: { code: string; message: string }
}

export interface AddCartItemInput {
  nftId: string
  quantity: number
}
