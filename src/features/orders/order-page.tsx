import { useEffect, useRef } from 'react'
import axios from 'axios'
import { Link, Navigate, useParams } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MarketplaceHeader } from '@/components/marketplace-header'
import type { ApiErrorResponse, OrderStatus } from '@/contracts/order'
import { formatCentsAsBRL, parseBRLToCents } from '@/domain/money-brl'
import { connectRealtime } from '@/lib/realtime/socket'
import { useSession } from '@/features/auth/use-session'
import { fetchOrder } from '@/features/checkout/checkout-api'
import './orders.css'

function currency(value: string) { return formatCentsAsBRL(parseBRLToCents(value)) }
function message(error: unknown) {
  if (axios.isAxiosError<ApiErrorResponse>(error)) return error.response?.data.error.message ?? 'Falha de conexão ao consultar o pedido.'
  return error instanceof Error ? error.message : 'Não foi possível consultar o pedido.'
}

function statusLabel(status: OrderStatus) {
  if (status === 'confirmed') return 'Pedido confirmado'
  if (status === 'declined') return 'Pedido recusado'
  return 'Pedido pendente'
}

export function OrderPage() {
  const { orderId } = useParams({ from: '/orders/$orderId' })
  const session = useSession(true)
  const queryClient = useQueryClient()
  const userId = session.data?.user.id
  const query = useQuery({
    queryKey: ['order', userId, orderId],
    queryFn: () => fetchOrder(orderId),
    enabled: Boolean(userId),
    retry: false,
    refetchInterval: (current) => current.state.data?.status === 'pending' ? 1_000 : false,
  })
  const seenVersion = useRef(0)

  useEffect(() => {
    const order = query.data
    if (order && order.version > seenVersion.current) seenVersion.current = order.version
  }, [query.data])

  useEffect(() => {
    if (query.data?.status === 'confirmed' && userId) void queryClient.invalidateQueries({ queryKey: ['cart', userId] })
  }, [query.data?.status, queryClient, userId])

  useEffect(() => {
    if (!userId) return
    let active = true
    let disconnect: (() => void) | undefined
    void connectRealtime({
      onNftUpdated: () => {},
      onOrderUpdated: (event) => {
        if (event.userId !== userId || event.orderId !== orderId || event.version <= seenVersion.current) return
        seenVersion.current = event.version
        // O socket apenas invalida a consulta; a API continua sendo autoridade do recibo.
        void queryClient.invalidateQueries({ queryKey: ['order', userId, orderId] })
      },
      onConnect: () => { if (active) void queryClient.invalidateQueries({ queryKey: ['order', userId, orderId] }) },
    }).then((socket) => { if (active) disconnect = () => socket.disconnect(); else socket.disconnect() }).catch(() => {})
    return () => { active = false; disconnect?.() }
  }, [orderId, queryClient, userId])

  if (session.isPending) return <main role="status" className="order-loading">Verificando sessão…</main>
  if (!session.data) return <Navigate to="/login" search={{ returnTo: `/orders/${orderId}` }} replace />

  return <div className="marketplace-shell order-shell"><MarketplaceHeader /><main className="order-main">
    <Link className="back-link" to="/">← VOLTAR AO CATÁLOGO</Link>
    {query.isPending && <section className="order-state" role="status"><p className="eyebrow">CONSULTANDO A API</p><h1>Recuperando seu pedido…</h1></section>}
    {query.isError && <section className="order-state order-error" role="alert"><p className="eyebrow">PEDIDO NÃO DISPONÍVEL</p><h1>Não foi possível confirmar o resultado.</h1><p>{message(query.error)}</p><button className="button-secondary" type="button" onClick={() => void query.refetch()}>Consultar novamente</button></section>}
    {query.data && <>
      <section className={`order-state order-state-${query.data.status}`} aria-live="polite">
        <p className="eyebrow">{query.data.status === 'confirmed' ? 'COMPRA SIMULADA CONCLUÍDA' : query.data.status === 'declined' ? 'COMPRA NÃO CONCLUÍDA' : 'AGUARDANDO PROCESSAMENTO'}</p>
        <h1>{statusLabel(query.data.status)}<span>.</span></h1>
        <p>{query.data.status === 'pending' ? 'A API ainda está processando. Esta tela consultará novamente e pode ser atualizada com segurança.' : query.data.status === 'declined' ? 'A simulação recusou o pedido. Seus itens permanecem no carrinho.' : 'A API confirmou o pedido. Os valores abaixo são o snapshot aceito.'}</p>
        <strong className="order-number">Pedido {query.data.id}</strong>
        {query.data.status === 'confirmed' && <p className="simulated-reference">Referência simulada: {query.data.transactionReference}</p>}
      </section>
      {query.data.status === 'confirmed' && <section className="order-receipt" aria-labelledby="receipt-heading"><div className="order-receipt-heading"><div><p className="eyebrow">RECIBO · VALORES IMUTÁVEIS</p><h2 id="receipt-heading">Resumo do pedido</h2></div><span>R$ BRL</span></div>
        {query.data.snapshot.items.map((item) => <article className="order-line" key={item.nftId}><img src={item.imageUrl} alt={`Arte digital: ${item.name}`} /><div><strong>{item.name}</strong><small>{item.quantity} × {currency(item.priceBRL)}</small></div><b>{currency(item.lineSubtotalBRL)}</b></article>)}
        <dl className="order-totals"><div><dt>Subtotal</dt><dd>{currency(query.data.snapshot.quote.subtotalBRL)}</dd></div><div><dt>Desconto</dt><dd>− {currency(query.data.snapshot.quote.discountBRL)}</dd></div><div><dt>Taxa de rede</dt><dd>{currency(query.data.snapshot.quote.networkFeeBRL)}</dd></div><div className="order-total"><dt>Total pago na simulação</dt><dd>{currency(query.data.snapshot.quote.totalBRL)}</dd></div></dl>
        <div className="order-buyer"><span>Colecionador</span><strong>{query.data.snapshot.buyer.name}</strong><span>Carteira fictícia</span><strong>{query.data.snapshot.wallet.address} · {query.data.snapshot.network}</strong></div>
      </section>}
      {query.data.status !== 'confirmed' && <section className="order-summary"><p>{query.data.snapshot.items.length} {query.data.snapshot.items.length === 1 ? 'item' : 'itens'} · Total {currency(query.data.snapshot.quote.totalBRL)}</p><Link className="button-primary" to="/cart">{query.data.status === 'declined' ? 'Voltar ao carrinho' : 'Continuar acompanhando'}</Link></section>}
    </>}
    <p className="order-simulation-note">Carteira, referência e resultado são demonstrações locais. Não houve pagamento ou transação real.</p>
  </main></div>
}

export function orderPageErrorMessage(error: unknown) { return message(error) }
