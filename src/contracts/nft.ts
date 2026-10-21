/** Preços simulados em reais trafegam como decimais string (ex.: "235.90"). */
export interface Nft {
  id: string
  name: string
  collection: string
  creator: string
  description: string
  imageUrl: string
  priceBRL: string
  category: 'avatar' | 'art' | 'collectible'
  network: 'ethereum' | 'polygon'
  edition: {
    total: number
    available: number
  }
  attributes: Array<{ trait: string; value: string }>
  featured: boolean
  createdAt: string
  version: number
}

export type NftSort = 'featured' | 'price-asc' | 'price-desc' | 'newest'
export const nftCollections = [
  'Jungle Apes',
  'Wild Canvas',
  'Forest Spirits',
  'Canopy Birds',
  'Ancient Relics',
  'After Dark',
] as const

/** Parâmetros públicos do GET /api/nfts; espelham futuramente a URL do catálogo. */
export interface NftCatalogQuery {
  q?: string
  category?: Nft['category']
  collection?: string
  network?: Nft['network']
  minPriceBRL?: string
  maxPriceBRL?: string
  sort?: NftSort
  page?: number
  pageSize?: number
}

export interface NftCatalogResponse {
  items: Nft[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export interface ApiErrorResponse {
  error: {
    code: string
    message: string
  }
}
