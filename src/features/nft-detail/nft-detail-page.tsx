import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import axios from 'axios'
import { ArrowLeftIcon, ArrowUpRightIcon, CheckIcon, LeafIcon } from '@/components/icons'
import { MarketplaceHeader } from '@/components/marketplace-header'
import { formatCentsAsBRL, parseBRLToCents } from '@/domain/money-brl'
import { AddToCartButton } from '@/features/cart/add-to-cart-button'
import { fetchNft } from '@/features/catalog/catalog-api'
import './nft-detail.css'

export function NftDetailPage() {
  const [quantity, setQuantity] = useState(1)
  const { nftId } = useParams({ from: '/nft/$nftId' })
  const nftQuery = useQuery({
    queryKey: ['nfts', 'detail', nftId],
    queryFn: () => fetchNft(nftId),
    retry: false,
  })

  const isNotFound = axios.isAxiosError(nftQuery.error) && nftQuery.error.response?.status === 404

  return (
    <div className="marketplace-shell detail-shell">
      <MarketplaceHeader />
      <main className="detail-main">
        <Link className="back-link" to="/"><ArrowLeftIcon size={16} /> VOLTAR AO CATÁLOGO</Link>

        {nftQuery.isPending && <div className="detail-loading" data-testid="detail-skeleton" aria-label="Carregando detalhes do NFT" aria-busy="true">
          <div className="detail-skeleton-image shimmer" />
          <div className="detail-skeleton-copy"><div className="skeleton-copy shimmer" /><div className="skeleton-copy skeleton-copy-short shimmer" /><div className="detail-skeleton-price shimmer" /></div>
        </div>}

        {nftQuery.isError && <section className="detail-state" role="alert" data-testid={isNotFound ? 'nft-not-found' : 'nft-load-error'}>
          <span className="detail-state-icon">{isNotFound ? '404' : '!'}</span>
          <p className="eyebrow">{isNotFound ? 'PEÇA NÃO LOCALIZADA' : 'CONEXÃO INSTÁVEL'}</p>
          <h1>{isNotFound ? 'Esta peça não está na coleção.' : 'Não foi possível abrir esta peça.'}</h1>
          <p>{isNotFound ? 'O NFT pode ter sido removido ou o endereço está incorreto.' : 'Tente novamente. O endereço da peça foi preservado.'}</p>
          <div className="detail-state-actions">
            {!isNotFound && <button type="button" className="button-primary" onClick={() => void nftQuery.refetch()}>Tentar novamente</button>}
            <Link className="button-secondary" to="/">Explorar catálogo</Link>
          </div>
        </section>}

        {nftQuery.data && <>
          <div className="detail-breadcrumb"><Link to="/">Início</Link><span>/</span><span>{nftQuery.data.collection}</span></div>
          <section className="detail-layout" aria-labelledby="nft-title">
            <div className="detail-art-column">
              <div className="detail-art-frame">
                <img src={nftQuery.data.imageUrl} alt={`Arte digital: ${nftQuery.data.name}`} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/assets/nfts/provisional-canopy.svg' }} />
                <span className="detail-art-index">JGL / {String(nftQuery.data.version).padStart(2, '0')}</span>
                <span className="detail-art-leaf"><LeafIcon size={18} /></span>
              </div>
              <p className="detail-art-caption">OBRA DIGITAL <span>•</span> REDE {nftQuery.data.network.toUpperCase()}</p>
            </div>

            <div className="detail-info-column">
              <p className="eyebrow"><span className="eyebrow-line" /> {nftQuery.data.collection.toUpperCase()}</p>
              <h1 id="nft-title">{nftQuery.data.name}</h1>
              <p className="detail-creator">Criado por <strong>{nftQuery.data.creator}</strong></p>
              <p className="detail-description">{nftQuery.data.description}</p>

              <div className="detail-edition-card">
                <div className="edition-topline"><span>EDIÇÃO LIMITADA</span><span>#{nftQuery.data.id.slice(-3).toUpperCase()}</span></div>
                <div className="edition-count"><strong>{nftQuery.data.edition.available}</strong><span>de {nftQuery.data.edition.total} disponíveis</span></div>
                <div className="edition-progress" role="progressbar" aria-label="Edições já adquiridas" aria-valuemin={0} aria-valuemax={nftQuery.data.edition.total} aria-valuenow={nftQuery.data.edition.total - nftQuery.data.edition.available}><span style={{ width: `${Math.max(0, Math.min(100, (1 - nftQuery.data.edition.available / nftQuery.data.edition.total) * 100))}%` }} /></div>
                <p className="edition-status">{nftQuery.data.edition.available > 0 ? <><CheckIcon size={14} /> Edição disponível para aquisição</> : 'Esta edição está esgotada'}</p>
              </div>

              <div className="detail-price-row"><span>PREÇO ATUAL</span><strong>{formatCentsAsBRL(parseBRLToCents(nftQuery.data.priceBRL))}</strong></div>
              <div className="detail-actions">
                {nftQuery.data.edition.available > 0
                  ? <><div className="detail-quantity" aria-label="Quantidade"><button type="button" aria-label="Diminuir quantidade" onClick={() => setQuantity((current) => Math.max(1, current - 1))} disabled={quantity <= 1}>−</button><span aria-live="polite">{quantity}</span><button type="button" aria-label="Aumentar quantidade" onClick={() => setQuantity((current) => Math.min(nftQuery.data.edition.available, current + 1))} disabled={quantity >= nftQuery.data.edition.available}>+</button></div><AddToCartButton className="button-primary detail-buy-placeholder" nftId={nftQuery.data.id} quantity={quantity} available={nftQuery.data.edition.available} /></>
                  : <button className="button-primary detail-buy-placeholder" type="button" disabled>Edição esgotada</button>}
                <Link className="detail-collection-link" to="/" search={{ collection: nftQuery.data.collection }}>Ver coleção <ArrowUpRightIcon size={15} /></Link>
              </div>

              <div className="attributes-block"><div className="attributes-heading"><h2>Atributos</h2><span>{nftQuery.data.attributes.length} TRAÇOS</span></div>
                <div className="attribute-list">{nftQuery.data.attributes.map((attribute) => <div className="attribute-card" key={attribute.trait}><span>{attribute.trait}</span><strong>{attribute.value}</strong></div>)}</div>
              </div>
            </div>
          </section>
        </>}
      </main>
    </div>
  )
}
