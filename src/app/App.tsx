import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon, ChevronDownIcon, SlidersIcon } from '@/components/icons'
import type { Nft, NftCatalogQuery } from '@/contracts/nft'
import { nftCollections } from '@/contracts/nft'
import { fetchNftCatalog } from '@/features/catalog/catalog-api'
import { MarketplaceHeader } from '@/components/marketplace-header'
import { formatCentsAsBRL, parseBRLToCents } from '@/domain/money-brl'
import { AddToCartButton } from '@/features/cart/add-to-cart-button'
import '@/features/catalog/catalog.css'

const categories: Array<{ value: Nft['category'] | ''; label: string }> = [
  { value: '', label: 'Todas as categorias' },
  { value: 'avatar', label: 'Avatares' },
  { value: 'art', label: 'Arte' },
  { value: 'collectible', label: 'Colecionáveis' },
]
const sortOptions: Array<{ value: NonNullable<NftCatalogQuery['sort']>; label: string }> = [
  { value: 'featured', label: 'Em destaque' },
  { value: 'price-asc', label: 'Menor preço' },
  { value: 'price-desc', label: 'Maior preço' },
  { value: 'newest', label: 'Mais recentes' },
]

export function App() {
  const navigate = useNavigate({ from: '/' })
  const search = useSearch({ from: '/' })
  const query = { ...search, page: search.page ?? 1, pageSize: search.pageSize ?? 9 }
  const catalog = useQuery({
    queryKey: ['nfts', 'catalog', query],
    queryFn: () => fetchNftCatalog(query),
  })
  const [minPrice, setMinPrice] = useState(search.minPriceBRL ?? '')
  const [maxPrice, setMaxPrice] = useState(search.maxPriceBRL ?? '')
  const [priceError, setPriceError] = useState('')

  useEffect(() => {
    setMinPrice(search.minPriceBRL ?? '')
    setMaxPrice(search.maxPriceBRL ?? '')
  }, [search.minPriceBRL, search.maxPriceBRL])

  function updateSearch(patch: Partial<NftCatalogQuery>, replace = false) {
    void navigate({
      search: (previous) => ({ ...previous, ...patch, page: patch.page ?? 1 }),
      replace,
    })
  }

  function applyPrices(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    let min: bigint | undefined
    let max: bigint | undefined
    try {
      min = minPrice === '' ? undefined : parseBRLToCents(minPrice)
      max = maxPrice === '' ? undefined : parseBRLToCents(maxPrice)
    } catch {
      setPriceError('Informe valores em reais com até duas casas decimais.')
      return
    }
    if (min !== undefined && max !== undefined && min > max) {
      setPriceError('O valor mínimo deve ser menor ou igual ao máximo.')
      return
    }
    setPriceError('')
    updateSearch({ minPriceBRL: minPrice || undefined, maxPriceBRL: maxPrice || undefined })
  }

  const response = catalog.data
  const items = response?.items ?? []
  const pagination = response?.pagination
  const pageCount = Math.max(pagination?.totalPages ?? 1, 1)
  const activeFilters = Boolean(search.category || search.collection || search.network || search.minPriceBRL || search.maxPriceBRL)

  return (
    <div className="marketplace-shell">
      <MarketplaceHeader
        searchValue={search.q ?? ''}
        onSearch={(q) => updateSearch({ q: q || undefined }, true)}
      />
      <main className="catalog-main">
        <section className="catalog-hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-line" /> UM UNIVERSO EM EDIÇÃO LIMITADA</p>
            <h1 id="hero-title">A floresta é<br /><em>sua galeria.</em></h1>
            <p className="hero-description">Descubra arte digital criada para quem encontra beleza em lugares inesperados.</p>
            <a className="hero-link" href="#catalogo">EXPLORE A COLEÇÃO <ArrowDownIcon size={15} /></a>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="hero-orbit hero-orbit-one" />
            <div className="hero-orbit hero-orbit-two" />
            <div className="hero-art-card">
              <img src="/assets/nfts/provisional-canopy.svg" alt="" />
              <span className="hero-art-caption">WILD CANVAS <b>№ 08</b></span>
            </div>
            <span className="hero-stamp">JUNGLE<br />EDITION<br /><b>2025</b></span>
            <span className="hero-coordinate">04°12' S / 67°33' W</span>
          </div>
          <div className="hero-index"><span>01</span> — DESCOBERTA <span>02</span> — COLEÇÃO <span>03</span> — COMUNIDADE</div>
        </section>

        <section className="catalog-section" id="catalogo" aria-labelledby="catalog-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">PEÇAS SELECIONADAS</p>
              <h2 id="catalog-heading">Explore o catálogo<span className="heading-period">.</span></h2>
            </div>
            <p className="catalog-total" aria-live="polite">
              {catalog.isPending ? 'Carregando peças…' : `${pagination?.total ?? 0} peças encontradas`}
            </p>
          </div>

          <div className="catalog-layout">
            <aside className="filter-panel" aria-label="Filtros do catálogo">
              <div className="filter-heading"><SlidersIcon size={16} /><h3>Filtrar por</h3></div>
              <label className="field-label" htmlFor="category-filter">Categoria</label>
              <span className="select-wrap"><select id="category-filter" value={search.category ?? ''} onChange={(event) => updateSearch({ category: (event.target.value || undefined) as Nft['category'] | undefined })}>
                {categories.map((category) => <option key={category.label} value={category.value}>{category.label}</option>)}
              </select><ChevronDownIcon size={15} /></span>

              <label className="field-label" htmlFor="collection-filter">Coleção</label>
              <span className="select-wrap"><select id="collection-filter" value={search.collection ?? ''} onChange={(event) => updateSearch({ collection: event.target.value || undefined })}>
                <option value="">Todas as coleções</option>
                {nftCollections.map((collection) => <option value={collection} key={collection}>{collection}</option>)}
              </select><ChevronDownIcon size={15} /></span>

              <label className="field-label" htmlFor="network-filter">Rede</label>
              <span className="select-wrap"><select id="network-filter" value={search.network ?? ''} onChange={(event) => updateSearch({ network: (event.target.value || undefined) as Nft['network'] | undefined })}>
                <option value="">Todas as redes</option><option value="ethereum">Ethereum</option><option value="polygon">Polygon</option>
              </select><ChevronDownIcon size={15} /></span>

              <form className="price-form" onSubmit={applyPrices}>
                <fieldset>
                  <legend>Preço (R$)</legend>
                  <div className="price-inputs">
                    <label><span className="sr-only">Preço mínimo em reais</span><input type="number" min="0" step="0.01" placeholder="Mín." value={minPrice} onChange={(event) => setMinPrice(event.currentTarget.value)} /></label>
                    <span aria-hidden="true">—</span>
                    <label><span className="sr-only">Preço máximo em reais</span><input type="number" min="0" step="0.01" placeholder="Máx." value={maxPrice} onChange={(event) => setMaxPrice(event.currentTarget.value)} /></label>
                  </div>
                </fieldset>
                {priceError && <p className="field-error" role="alert">{priceError}</p>}
                <button className="filter-apply" type="submit">Aplicar faixa</button>
              </form>
              {activeFilters && <button className="clear-filters" type="button" onClick={() => { setMinPrice(''); setMaxPrice(''); updateSearch({ category: undefined, collection: undefined, network: undefined, minPriceBRL: undefined, maxPriceBRL: undefined }) }}>Limpar filtros</button>}
            </aside>

            <div className="catalog-results" aria-busy={catalog.isPending}>
              <div className="results-toolbar">
                <span className="results-context">{search.q ? <>Resultados para <strong>“{search.q}”</strong></> : 'Novidades da floresta'}</span>
                <label className="sort-control">Ordenar por <span className="select-wrap"><select aria-label="Ordenar catálogo" value={search.sort ?? 'featured'} onChange={(event) => updateSearch({ sort: event.target.value as NftCatalogQuery['sort'] })}>
                  {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select><ChevronDownIcon size={15} /></span></label>
              </div>

              {catalog.isPending && <div className="nft-grid" data-testid="catalog-skeletons" aria-label="Carregando catálogo">{Array.from({ length: 9 }, (_, index) => <div className="nft-skeleton" key={index}><div className="skeleton-art shimmer" /><div className="skeleton-copy shimmer" /><div className="skeleton-copy skeleton-copy-short shimmer" /></div>)}</div>}

              {catalog.isError && <div className="state-panel" role="alert"><span className="state-mark">!</span><h3>Não conseguimos carregar o catálogo</h3><p>Verifique a conexão e tente novamente. Seus filtros continuam na URL.</p><button type="button" className="button-primary" onClick={() => void catalog.refetch()}>Tentar novamente</button></div>}

              {!catalog.isPending && !catalog.isError && items.length === 0 && <div className="state-panel" data-testid="catalog-empty"><span className="state-mark">∅</span><h3>Nenhuma peça por aqui</h3><p>Tente outro termo ou remova algum filtro para ampliar a busca.</p><button type="button" className="button-primary" onClick={() => { setMinPrice(''); setMaxPrice(''); updateSearch({ q: undefined, category: undefined, collection: undefined, network: undefined, minPriceBRL: undefined, maxPriceBRL: undefined }) }}>Limpar busca e filtros</button></div>}

              {!catalog.isPending && !catalog.isError && items.length > 0 && <>
                <div className="nft-grid" data-testid="nft-grid">
                  {items.map((nft, index) => <article className="nft-card" key={nft.id}>
                    <Link className="nft-card-link" to="/nft/$nftId" params={{ nftId: nft.id }} aria-label={`Ver detalhes de ${nft.name}`}>
                      <div className="nft-art-wrap">
                        <img src={nft.imageUrl} alt={`Arte de ${nft.name}`} loading={index < 3 ? 'eager' : 'lazy'} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/assets/nfts/provisional-canopy.svg' }} />
                        <span className="nft-edition">{nft.edition.available === 0 ? 'ESGOTADO' : `${nft.edition.available} DISPONÍVEIS`}</span>
                      </div>
                      <div className="nft-card-info">
                      <div className="nft-card-title-row"><div><span className="nft-collection">{nft.collection}</span><h3>{nft.name}</h3></div><span className="card-arrow" aria-hidden="true"><ArrowRightIcon size={16} /></span></div>
                        <div className="nft-card-meta"><span>por {nft.creator}</span><span><small>PREÇO</small><b>{formatCentsAsBRL(parseBRLToCents(nft.priceBRL))}</b></span></div>
                      </div>
                    </Link>
                    {nft.edition.available > 0 && <AddToCartButton className="catalog-add-button" nftId={nft.id} quantity={1} />}
                  </article>)}
                </div>
                <nav className="pagination" aria-label="Paginação do catálogo">
                  <button type="button" aria-label="Página anterior" disabled={query.page <= 1} onClick={() => updateSearch({ page: query.page - 1 })}><ArrowLeftIcon size={16} /></button>
                  <span>Página <strong>{query.page}</strong> de <strong>{pageCount}</strong></span>
                  <button type="button" aria-label="Próxima página" disabled={query.page >= pageCount} onClick={() => updateSearch({ page: query.page + 1 })}><ArrowRightIcon size={16} /></button>
                </nav>
              </>}
            </div>
          </div>
        </section>
      </main>
      <footer className="site-footer"><Link className="brand" to="/"><span className="brand-mark"><span>J</span></span><span>JUNGLE<span className="brand-light">MARKET</span></span></Link><span>ARTE DIGITAL, ENCONTRADA NA NATUREZA.</span><span>© JUNGLE MARKET 2025</span></footer>
    </div>
  )
}
