import type { Nft } from '@/contracts/nft'

// Coleção fixa e variada para testar busca, filtros combinados e paginação.
// Os preços permanecem strings. As ilustrações SVG provisórias ficam em
// public/assets/nfts e poderão ser trocadas por assets do Figma sem alterar o contrato.
const seeds: Array<Pick<Nft, 'id' | 'name' | 'collection' | 'creator' | 'priceBRL' | 'category' | 'network' | 'edition' | 'featured'>> = [
  { id: 'emerald-ape-042', name: 'Emerald Ape #042', collection: 'Jungle Apes', creator: 'Maya Silva', priceBRL: '235.90', category: 'avatar', network: 'ethereum', edition: { total: 100, available: 12 }, featured: true },
  { id: 'sunset-ape-017', name: 'Sunset Ape #017', collection: 'Jungle Apes', creator: 'Maya Silva', priceBRL: '349.50', category: 'avatar', network: 'ethereum', edition: { total: 100, available: 4 }, featured: true },
  { id: 'moss-ape-088', name: 'Moss Ape #088', collection: 'Jungle Apes', creator: 'Noah Costa', priceBRL: '89.90', category: 'avatar', network: 'polygon', edition: { total: 50, available: 0 }, featured: false },
  { id: 'violet-dream', name: 'Violet Dream', collection: 'Wild Canvas', creator: 'Lia Martins', priceBRL: '142.00', category: 'art', network: 'ethereum', edition: { total: 25, available: 9 }, featured: true },
  { id: 'golden-hour', name: 'Golden Hour', collection: 'Wild Canvas', creator: 'Lia Martins', priceBRL: '168.00', category: 'art', network: 'polygon', edition: { total: 25, available: 3 }, featured: false },
  { id: 'quiet-orbit', name: 'Quiet Orbit', collection: 'Wild Canvas', creator: 'Ravi Nunes', priceBRL: '212.00', category: 'art', network: 'ethereum', edition: { total: 10, available: 7 }, featured: false },
  { id: 'fern-guardian', name: 'Fern Guardian', collection: 'Forest Spirits', creator: 'Theo Ramos', priceBRL: '131.00', category: 'collectible', network: 'polygon', edition: { total: 200, available: 41 }, featured: true },
  { id: 'moon-moth', name: 'Moon Moth', collection: 'Forest Spirits', creator: 'Theo Ramos', priceBRL: '157.00', category: 'collectible', network: 'ethereum', edition: { total: 200, available: 18 }, featured: false },
  { id: 'river-keeper', name: 'River Keeper', collection: 'Forest Spirits', creator: 'Ana Reis', priceBRL: '245.00', category: 'collectible', network: 'polygon', edition: { total: 80, available: 8 }, featured: false },
  { id: 'copper-toucan', name: 'Copper Toucan', collection: 'Canopy Birds', creator: 'Bia Lopes', priceBRL: '124.00', category: 'avatar', network: 'polygon', edition: { total: 75, available: 22 }, featured: false },
  { id: 'blue-macaw', name: 'Blue Macaw', collection: 'Canopy Birds', creator: 'Bia Lopes', priceBRL: '176.00', category: 'avatar', network: 'ethereum', edition: { total: 75, available: 5 }, featured: false },
  { id: 'canopy-at-dawn', name: 'Canopy at Dawn', collection: 'Canopy Birds', creator: 'Ivo Freitas', priceBRL: '310.00', category: 'art', network: 'ethereum', edition: { total: 12, available: 2 }, featured: false },
  { id: 'jade-mask', name: 'Jade Mask', collection: 'Ancient Relics', creator: 'Nina Alves', priceBRL: '188.00', category: 'collectible', network: 'polygon', edition: { total: 30, available: 11 }, featured: false },
  { id: 'sun-disk', name: 'Sun Disk', collection: 'Ancient Relics', creator: 'Nina Alves', priceBRL: '420.00', category: 'collectible', network: 'ethereum', edition: { total: 30, available: 1 }, featured: false },
  { id: 'rainforest-map', name: 'Rainforest Map', collection: 'Ancient Relics', creator: 'Omar Dias', priceBRL: '205.00', category: 'art', network: 'polygon', edition: { total: 15, available: 0 }, featured: false },
  { id: 'neon-panther', name: 'Neon Panther', collection: 'After Dark', creator: 'Kai Mendes', priceBRL: '163.00', category: 'avatar', network: 'ethereum', edition: { total: 60, available: 14 }, featured: false },
  { id: 'night-bloom', name: 'Night Bloom', collection: 'After Dark', creator: 'Kai Mendes', priceBRL: '272.00', category: 'art', network: 'polygon', edition: { total: 40, available: 6 }, featured: false },
  { id: 'electric-vines', name: 'Electric Vines', collection: 'After Dark', creator: 'Sol Pires', priceBRL: '139.00', category: 'collectible', network: 'ethereum', edition: { total: 90, available: 28 }, featured: false },
]

export const nftFixtures: Nft[] = seeds.map((seed, index) => ({
  ...seed,
  description: `${seed.name} é uma peça digital da coleção ${seed.collection}, criada por ${seed.creator}. Cada edição possui registro e atributos próprios no universo Jungle.`,
  imageUrl: seed.category === 'avatar'
    ? '/assets/nfts/provisional-avatar.svg'
    : seed.category === 'collectible'
      ? '/assets/nfts/provisional-relic.svg'
      : '/assets/nfts/provisional-canopy.svg',
  attributes: [
    { trait: 'Coleção', value: seed.collection },
    { trait: 'Raridade', value: index % 4 === 0 ? 'Lendária' : index % 3 === 0 ? 'Rara' : 'Comum' },
    { trait: 'Edição', value: `${seed.edition.total} cópias` },
  ],
  createdAt: new Date(Date.UTC(2025, 0, 1 + index)).toISOString(),
  version: 1,
}))
