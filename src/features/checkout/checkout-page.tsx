import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import axios from 'axios'
import { Link, Navigate, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MarketplaceHeader } from '@/components/marketplace-header'
import type { ApiErrorResponse, CheckoutBuyer, CreateOrderInput, MarketplaceNetwork, MockWallet } from '@/contracts/order'
import { validateCheckoutBuyer } from '@/domain/checkout'
import { formatCentsAsBRL, parseBRLToCents } from '@/domain/money-brl'
import { connectRealtime } from '@/lib/realtime/socket'
import { useSession } from '@/features/auth/use-session'
import { useCartQuery } from '@/features/cart/use-cart'
import { connectWallet, createOrder, disconnectWallet, fetchCheckoutQuote, fetchOrderByIdempotencyKey, fetchWallets } from './checkout-api'
import './checkout.css'

const attemptStorageKey = 'jungle-market.checkout-attempt.v1'
type SavedAttempt = { userId: string; key: string; fingerprint: string }

function currency(value: string) { return formatCentsAsBRL(parseBRLToCents(value)) }
function readAttempt(): SavedAttempt | null {
  try { return JSON.parse(sessionStorage.getItem(attemptStorageKey) ?? 'null') as SavedAttempt | null } catch { return null }
}
function apiMessage(error: unknown) {
  if (axios.isAxiosError<ApiErrorResponse>(error)) return error.response?.data.error.message ?? 'A conexão falhou. Tente novamente; a chave da tentativa será preservada.'
  return error instanceof Error ? error.message : 'Não foi possível enviar o pedido.'
}

export function CheckoutPage() {
  const session = useSession(true)
  const cart = useCartQuery()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = session.data?.user
  const quoteQuery = useQuery({ queryKey: ['checkout-quote', user?.id], queryFn: fetchCheckoutQuote, enabled: Boolean(user), retry: false })
  const walletsQuery = useQuery({ queryKey: ['wallets', user?.id], queryFn: fetchWallets, enabled: Boolean(user), retry: false })
  const [buyer, setBuyer] = useState<CheckoutBuyer>({ name: '', email: '', document: '' })
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof CheckoutBuyer, string>>>({})
  const [selectedWalletId, setSelectedWalletId] = useState('')
  const [connectedWalletId, setConnectedWalletId] = useState('')
  const [walletFeedback, setWalletFeedback] = useState('')
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [reconfirmationRequired, setReconfirmationRequired] = useState(false)
  const submitLock = useRef(false)
  const recoveryStarted = useRef(false)
  const quoteDataRef = useRef(quoteQuery.data)
  const refetchQuoteRef = useRef(quoteQuery.refetch)

  useEffect(() => { quoteDataRef.current = quoteQuery.data }, [quoteQuery.data])
  useEffect(() => { refetchQuoteRef.current = quoteQuery.refetch }, [quoteQuery.refetch])

  useEffect(() => {
    if (!user) return
    setBuyer((current) => ({ ...current, name: current.name || user.name, email: current.email || user.email }))
  }, [user])

  const selectedWallet = useMemo(() => walletsQuery.data?.find((wallet) => wallet.id === selectedWalletId) ?? null, [walletsQuery.data, selectedWalletId])
  useEffect(() => {
    if (!selectedWalletId && walletsQuery.data?.length) {
      const primary = walletsQuery.data.find((wallet) => wallet.isPrimary) ?? walletsQuery.data[0]
      setSelectedWalletId(primary.id)
    }
  }, [selectedWalletId, walletsQuery.data])

  useEffect(() => {
    if (!user || recoveryStarted.current) return
    recoveryStarted.current = true
    const attempt = readAttempt()
    if (!attempt || attempt.userId !== user.id) return
    void fetchOrderByIdempotencyKey(attempt.key).then((order) => {
      void navigate({ to: '/orders/$orderId', params: { orderId: order.id }, replace: true })
    }).catch(() => { /* 404 significa que a API ainda não recebeu essa tentativa */ })
  }, [navigate, user])

  useEffect(() => {
    if (!user?.id) return
    let active = true
    let disconnect: (() => void) | undefined
    const versions = new Map((quoteDataRef.current?.items ?? []).map((item) => [item.nftId, item.nftVersion]))
    void connectRealtime({
      onNftUpdated: (event) => {
        const currentVersion = versions.get(event.nftId) ?? 0
        if (event.version <= currentVersion) return
        versions.set(event.nftId, event.version)
        if (!(quoteDataRef.current?.items ?? []).some((item) => item.nftId === event.nftId)) return
        setReconfirmationRequired(true)
        void refetchQuoteRef.current()
      },
      onConnect: () => { if (active) void refetchQuoteRef.current() },
    }).then((socket) => { if (active) disconnect = () => socket.disconnect(); else socket.disconnect() }).catch(() => {})
    return () => { active = false; disconnect?.() }
  }, [user?.id])

  if (session.isPending) return <main className="checkout-loading" role="status">Verificando sua sessão…</main>
  if (!session.data) return <Navigate to="/login" search={{ returnTo: '/checkout' }} replace />
  if (cart.isSuccess && cart.data.items.length === 0) return <Navigate to="/cart" replace />

  const quote = quoteQuery.data
  const wallets: MockWallet[] = walletsQuery.data ?? []

  async function handleConnect() {
    if (!selectedWallet) return
    setWalletFeedback('')
    try { await connectWallet(selectedWallet.id); setConnectedWalletId(selectedWallet.id); setWalletFeedback('Carteira conectada na simulação. Nenhuma extensão ou transação real foi usada.') }
    catch (error) { setConnectedWalletId(''); setWalletFeedback(apiMessage(error)) }
  }

  async function handleDisconnect() {
    if (!selectedWallet) return
    try { await disconnectWallet(selectedWallet.id); setConnectedWalletId(''); setWalletFeedback('Carteira desconectada.') }
    catch (error) { setWalletFeedback(apiMessage(error)) }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback('')
    const errors = validateCheckoutBuyer(buyer)
    setFieldErrors(errors)
    if (Object.keys(errors).length || reconfirmationRequired || submitLock.current) return
    if (!quote) { setFeedback('Não há uma cotação válida. Atualize os dados e tente novamente.'); return }
    if (!selectedWallet || connectedWalletId !== selectedWallet.id) { setFeedback('Conecte a carteira simulada escolhida antes de enviar o pedido.'); return }
    submitLock.current = true
    setSubmitting(true)
    const input: CreateOrderInput = {
      quoteVersion: quote.version,
      buyer: { name: buyer.name.trim(), email: buyer.email.trim(), document: buyer.document.trim() },
      walletId: selectedWallet.id,
      network: selectedWallet.network as MarketplaceNetwork,
    }
    const fingerprint = JSON.stringify(input)
    const saved = readAttempt()
    const attempt: SavedAttempt = saved?.userId === user!.id && saved.fingerprint === fingerprint
      ? saved
      : { userId: user!.id, fingerprint, key: crypto.randomUUID() }
    sessionStorage.setItem(attemptStorageKey, JSON.stringify(attempt))
    try {
      const order = await createOrder(input, attempt.key)
      void navigate({ to: '/orders/$orderId', params: { orderId: order.id } })
    } catch (error) {
      setFeedback(apiMessage(error))
      if (axios.isAxiosError<ApiErrorResponse>(error) && error.response?.data.error.currentQuote) {
        queryClient.setQueryData(['checkout-quote', user!.id], error.response.data.error.currentQuote)
        setReconfirmationRequired(true)
      }
    } finally { submitLock.current = false; setSubmitting(false) }
  }

  const loading = quoteQuery.isPending || walletsQuery.isPending || cart.isPending
  return <div className="marketplace-shell checkout-shell"><MarketplaceHeader /><main className="checkout-main">
    <Link className="back-link" to="/cart">← VOLTAR AO CARRINHO</Link>
    <header className="checkout-heading"><p className="eyebrow">ÚLTIMA REVISÃO</p><h1>Finalizar pedido<span>.</span></h1><p>Revise a cotação e os dados do colecionador antes de enviar.</p></header>
    {loading && <div className="checkout-skeleton" role="status" aria-busy="true">Carregando a cotação atual…</div>}
    {(quoteQuery.isError || walletsQuery.isError || cart.isError) && <section className="checkout-alert" role="alert"><h2>Não foi possível preparar o checkout</h2><p>{apiMessage(quoteQuery.error ?? walletsQuery.error ?? cart.error)}</p><button className="button-secondary" type="button" onClick={() => { void quoteQuery.refetch(); void walletsQuery.refetch(); void cart.refetch() }}>Tentar novamente</button> <Link className="checkout-error-link" to="/cart">Revisar carrinho e cupom</Link></section>}
    {!loading && quote && <form className="checkout-grid" onSubmit={(event) => void submit(event)} noValidate>
      <div className="checkout-form-column">
        <section className="checkout-card" aria-labelledby="buyer-heading"><p className="eyebrow">01 · COLECIONADOR</p><h2 id="buyer-heading">Seus dados</h2>
          <div className="checkout-fields">
            <label>Nome completo<input value={buyer.name} onChange={(event) => setBuyer({ ...buyer, name: event.currentTarget.value })} autoComplete="name" aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? 'buyer-name-error' : undefined} /></label>{fieldErrors.name && <p className="checkout-field-error" id="buyer-name-error" role="alert">{fieldErrors.name}</p>}
            <label>E-mail<input type="email" value={buyer.email} onChange={(event) => setBuyer({ ...buyer, email: event.currentTarget.value })} autoComplete="email" aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'buyer-email-error' : undefined} /></label>{fieldErrors.email && <p className="checkout-field-error" id="buyer-email-error" role="alert">{fieldErrors.email}</p>}
            <label>CPF do colecionador<input inputMode="numeric" value={buyer.document} onChange={(event) => setBuyer({ ...buyer, document: event.currentTarget.value.replace(/\D/g, '').slice(0, 11) })} autoComplete="off" aria-invalid={Boolean(fieldErrors.document)} aria-describedby={fieldErrors.document ? 'buyer-document-error' : undefined} /></label>{fieldErrors.document && <p className="checkout-field-error" id="buyer-document-error" role="alert">{fieldErrors.document}</p>}
          </div>
        </section>
        <section className="checkout-card" aria-labelledby="wallet-heading"><p className="eyebrow">02 · CARTEIRA SIMULADA</p><h2 id="wallet-heading">Escolha carteira e rede</h2>
          {walletsQuery.isError && <p role="alert">{apiMessage(walletsQuery.error)}</p>}
          <div className="wallet-options">{wallets.map((wallet) => <label className={`wallet-option ${selectedWalletId === wallet.id ? 'is-selected' : ''}`} key={wallet.id}><input type="radio" name="wallet" value={wallet.id} checked={selectedWalletId === wallet.id} onChange={() => { setSelectedWalletId(wallet.id); setConnectedWalletId(''); setWalletFeedback('') }} /><span><strong>{wallet.label}</strong><small>{wallet.address} · rede {wallet.network}</small></span></label>)}</div>
          <div className="wallet-actions">{connectedWalletId === selectedWalletId ? <button type="button" className="button-secondary" onClick={() => void handleDisconnect()}>Desconectar carteira simulada</button> : <button type="button" className="button-secondary" onClick={() => void handleConnect()} disabled={!selectedWallet}>Conectar carteira simulada</button>}</div>
          {walletFeedback && <p className="checkout-feedback" role={connectedWalletId ? 'status' : 'alert'}>{walletFeedback}</p>}
          <p className="simulation-note">Conexão e pedido são simulados. Nenhum pagamento ou transação blockchain será realizado.</p>
        </section>
      </div>
      <aside className="checkout-card checkout-review" aria-labelledby="review-heading"><p className="eyebrow">03 · REVISÃO</p><h2 id="review-heading">Sua compra</h2>
        <div className="checkout-items">{quote.items.map((item) => <article className="checkout-item" key={item.nftId}><img src={item.imageUrl} alt={`Arte digital: ${item.name}`} /><div><strong>{item.name}</strong><small>{item.quantity} × {currency(item.priceBRL)}</small>{item.quantity > item.available && <span className="checkout-stock-error" role="alert">Disponibilidade insuficiente: {item.available}</span>}</div><b>{currency(item.lineSubtotalBRL)}</b></article>)}</div>
        <dl className="checkout-totals"><div><dt>Subtotal</dt><dd>{currency(quote.quote.subtotalBRL)}</dd></div><div><dt>Desconto{quote.quote.couponCode ? ` · ${quote.quote.couponCode}` : ''}</dt><dd>− {currency(quote.quote.discountBRL)}</dd></div><div><dt>Taxa de rede</dt><dd>{currency(quote.quote.networkFeeBRL)}</dd></div><div className="checkout-total"><dt>Total em BRL</dt><dd>{currency(quote.quote.totalBRL)}</dd></div></dl>
        {reconfirmationRequired && <div className="checkout-alert" role="alert"><strong>A cotação mudou.</strong><p>Confira os valores atualizados e confirme a revisão antes de enviar.</p><button className="button-secondary" type="button" onClick={() => setReconfirmationRequired(false)}>Revisar nova cotação</button></div>}
        {feedback && <p className="checkout-feedback checkout-feedback-error" role="alert">{feedback}{feedback.toLocaleLowerCase().includes('cupom') && <> <Link className="checkout-error-link" to="/cart">Voltar ao carrinho</Link></>}</p>}
        <button className="button-primary checkout-submit" type="submit" disabled={submitting || reconfirmationRequired || quote.items.some((item) => item.quantity > item.available)}>{submitting ? 'Enviando pedido…' : 'Enviar pedido'}</button>
        <p className="checkout-api-note">O pedido só será considerado confirmado após resposta da API simulada.</p>
      </aside>
    </form>}
  </main></div>
}
