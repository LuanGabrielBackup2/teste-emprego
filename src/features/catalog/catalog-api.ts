import type { Nft, NftCatalogQuery, NftCatalogResponse } from '@/contracts/nft'
import { apiClient } from '@/lib/api/client'

export async function fetchNftCatalog(query: NftCatalogQuery): Promise<NftCatalogResponse> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const response = await apiClient.get<NftCatalogResponse>('/api/nfts', { params })
  return response.data
}

export async function fetchNft(nftId: string): Promise<Nft> {
  const response = await apiClient.get<{ item: Nft }>(`/api/nfts/${encodeURIComponent(nftId)}`)
  return response.data.item
}
