import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import axios from 'axios'
import { Link } from '@tanstack/react-router'
import { ArrowLeftIcon } from '@/components/icons'
import { MarketplaceHeader } from '@/components/marketplace-header'
import type { ApiErrorResponse } from '@/contracts/nft'
import { formatCentsAsBRL, parseBRLToCents } from '@/domain/money-brl'
import { connectRealtime } from '@/lib/realtime/socket'
import { useApplyCartCoupon, useCartQuery, useClearCart, useRemoveCartCoupon, useRemoveCartItem, useUpdateCartQuantity } from './use-cart'
import './cart.css'

function currency(value: string) {
  return formatCentsAsBRL(parseBRLToCents(value))
}

function errorMessage(error: unknown) {
  if (axios.isAxiosError<ApiErrorResponse>(error)) return error.response?.data.error.message ?? 'Falha de conexão. Tente novamente.'
  return error instanceof Error ? error.message : 'Não foi possível concluir a operação.'
}

export function CartPage() {
  const cart = useCartQuery()
  const cartItemsRef = useRef(cart.data?.items ?? [])
  const eventVersionsRef = useRef(new Map<string, number>())
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const [couponCode, setCouponCode] = useState('')
  const [couponFeedback, setCouponFeedback] = useState('')
  const applyCoupon = useApplyCartCoupon()
  const removeCoupon = useRemoveCartCoupon()
  const updateQuantity = useUpdateCartQuantity()
  const removeItem = useRemoveCartItem()
  const clear = useClearCart()

  useEffect(() => {
    cartItemsRef.current = cart.data?.items ?? []
    for (const line of cartItemsRef.current) {
      const seen = eventVersionsRef.current.get(line.nft.id) ?? 0
      if (line.nft.version > seen) eventVersionsRef.current.set(line.nft.id, line.nft.version)
    }
  }, [cart.data])

  useEffect(() => {
    let active = true
    let disconnect: (() => void) | undefined
    void connectRealtime({ onConnect: () => { if (active) setRealtimeConnected(true) }, onNftUpdated: (event) => {
      if (!cartItemsRef.current.some((line) => line.nft.id === event.nftId)) return
      const currentVersion = eventVersionsRef.current.get(event.nftId) ?? 0
      if (event.version <= currentVersion) return
      eventVersionsRef.current.set(event.nftId, event.version)
      void cart.refetch()
    } }).then((socket) => {
      if (active) disconnect = () => socket.disconnect()
      else socket.disconnect()
    }).catch(() => {
      // A tela continua funcional por REST quando o transporte em tempo real cai.
    })
    return () => { active = false; disconnect?.() }
  }, [cart.refetch])

  async function submitCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCouponFeedback('')
    try {
      await applyCoupon.mutateAsync(couponCode)
      setCouponFeedback('Cupom aplicado. A cotação foi atualizada pela API.')
      setCouponCode('')
    } catch (error) {
      setCouponFeedback(errorMessage(error))
    }
  }

  async function removeCouponCode() {
    setCouponFeedback('')
    try {
      await removeCoupon.mutateAsync()
      setCouponFeedback('Cupom removido.')
    } catch (error) {
      setCouponFeedback(errorMessage(error))
    }
  }

  const queryError = cart.isError ? errorMessage(cart.error) : ''

  return <div className="marketplace-shell cart-shell">
    <MarketplaceHeader />
    <main className="cart-main">
      <Link className="back-link" to="/"><ArrowLeftIcon size={16} /> CONTINUAR EXPLORANDO</Link>
      <div className="cart-title-row"><div><p className="eyebrow">SUA SELEÇÃO</p><h1>Meu carrinho<span>.</span></h1></div>{cart.data && cart.data.items.length > 0 && <button className="cart-clear-button" type="button" onClick={() => clear.mutate()} disabled={clear.isPending}>Limpar carrinho</button>}</div>

      {cart.isPending && <div className="cart-layout" data-testid="cart-skeletons" aria-label="Carregando carrinho" aria-busy="true"><div className="cart-lines-skeleton">{[0, 1].map((key) => <div className="cart-line-skeleton shimmer" key={key} />)}</div><div className="cart-summary-skeleton shimmer" /></div>}
      {cart.isError && <section className="cart-state" role="alert"><h2>Não conseguimos carregar seu carrinho</h2><p>{queryError}</p><button className="button-primary" type="button" onClick={() => void cart.refetch()}>Tentar novamente</button></section>}
      {!cart.isPending && !cart.isError && cart.data?.items.length === 0 && <section className="cart-empty" data-testid="cart-empty"><span aria-hidden="true">J</span><p className="eyebrow">AINDA NÃO HÁ PEÇAS AQUI</p><h2>Encontre algo que fale com você.</h2><p>As peças escolhidas ficam salvas neste navegador para você voltar quando quiser.</p><Link className="button-primary" to="/">Explorar o catálogo</Link></section>}

      {!cart.isPending && !cart.isError && cart.data && cart.data.items.length > 0 && <div className="cart-layout">
        <section className="cart-items" aria-label="Itens do carrinho">
          {cart.data.items.map(({ nft, quantity, lineSubtotalBRL }) => <article className="cart-line" key={nft.id}>
            <img className="cart-line-image" src={nft.imageUrl} alt={`Arte digital: ${nft.name}`} />
            <div className="cart-line-copy"><span className="nft-collection">{nft.collection}</span><h2>{nft.name}</h2><p>por {nft.creator}</p>
              {nft.edition.available < quantity && <p className="cart-stock-warning" role="alert">Disponibilidade atual: {nft.edition.available}. Ajuste a quantidade ou remova esta peça.</p>}
              {nft.edition.available === 0 && <p className="cart-stock-warning" role="alert">Esta edição está esgotada.</p>}
              <div className="cart-quantity" aria-label={`Quantidade de ${nft.name}`}>
                <button type="button" aria-label={`Diminuir quantidade de ${nft.name}`} onClick={() => updateQuantity.mutate({ nftId: nft.id, quantity: quantity - 1 })} disabled={quantity <= 1 || updateQuantity.isPending}>−</button>
                <span aria-live="polite">{quantity}</span>
                <button type="button" aria-label={`Aumentar quantidade de ${nft.name}`} onClick={() => updateQuantity.mutate({ nftId: nft.id, quantity: quantity + 1 })} disabled={quantity >= nft.edition.available || updateQuantity.isPending}>+</button>
              </div>
              <button className="cart-remove-button" type="button" onClick={() => removeItem.mutate(nft.id)} disabled={removeItem.isPending}>Remover</button>
            </div>
            <div className="cart-line-prices"><span>{currency(nft.priceBRL)} cada</span><strong>{currency(lineSubtotalBRL)}</strong></div>
          </article>)}
          {(updateQuantity.isError || removeItem.isError || clear.isError) && <p className="cart-feedback-error" role="alert">{errorMessage(updateQuantity.error ?? removeItem.error ?? clear.error)}</p>}
        </section>

        <aside className="cart-summary" aria-labelledby="summary-heading">
          <p className="eyebrow">RESUMO DA COTAÇÃO</p><h2 id="summary-heading">Sua compra</h2>
          <p className="realtime-notice" role="status">{realtimeConnected ? 'Atualizações de preço ativas' : 'Cotação sincronizada pela API'}</p>
          <form className="coupon-form" onSubmit={(event) => void submitCoupon(event)}>
            <label htmlFor="coupon-code">Cupom de desconto</label><div><input id="coupon-code" value={couponCode} onChange={(event) => setCouponCode(event.currentTarget.value)} placeholder="Digite seu cupom" autoComplete="off" /><button type="submit" disabled={!couponCode.trim() || applyCoupon.isPending}>{applyCoupon.isPending ? '…' : 'Aplicar'}</button></div>
          </form>
          {couponFeedback && <p className={`coupon-feedback ${applyCoupon.isError ? 'cart-feedback-error' : ''}`} role={applyCoupon.isError ? 'alert' : 'status'}>{couponFeedback}</p>}
          {cart.data.quote.couponCode && <div className="applied-coupon"><span>{cart.data.quote.couponCode} · {cart.data.quote.couponDescription}</span><button type="button" onClick={() => void removeCouponCode()} disabled={removeCoupon.isPending}>Remover</button></div>}
          <dl className="cart-totals"><div><dt>Subtotal ({cart.data.quote.itemCount} {cart.data.quote.itemCount === 1 ? 'item' : 'itens'})</dt><dd>{currency(cart.data.quote.subtotalBRL)}</dd></div><div><dt>Desconto</dt><dd>− {currency(cart.data.quote.discountBRL)}</dd></div><div><dt>Taxa de rede</dt><dd>{currency(cart.data.quote.networkFeeBRL)}</dd></div><div className="cart-grand-total"><dt>Total</dt><dd>{currency(cart.data.quote.totalBRL)}</dd></div></dl>
          <p className="digital-notice">NFTs são itens digitais. Esta cotação não inclui frete; a taxa de rede é informada pela simulação da API.</p>
          <Link className="button-primary cart-checkout-link" to="/checkout">Continuar para o checkout</Link>
          <p className="cart-stage-note">Ao entrar, sua seleção será vinculada à sua conta.</p>
        </aside>
      </div>}
    </main>
  </div>
}
