export interface NftUpdatedEvent {
  nftId: string
  version: number
}

export interface OrderUpdatedEvent {
  orderId: string
  userId: string
  version: number
  status: 'pending' | 'confirmed' | 'declined'
}
