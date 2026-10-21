import { http, HttpResponse, ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import type { CartLine } from '@/contracts/cart'
import type { CreateOrderInput, MarketplaceOrder, MockWallet } from '@/contracts/order'
import type { Nft, NftCatalogQuery, NftSort } from '@/contracts/nft'
import { calculateCartQuote } from '@/domain/cart'
import { buildCheckoutQuote, validateCheckoutBuyer } from '@/domain/checkout'
import { centsToDecimal, parseBRLToCents } from '@/domain/money-brl'
import { nftFixtures } from './data/nfts'

const categories = new Set<Nft['category']>(['avatar', 'art', 'collectible'])
const networks = new Set<Nft['network']>(['ethereum', 'polygon'])
const sorts = new Set<NftSort>(['featured', 'price-asc', 'price-desc', 'newest'])
const cartStorageKey = 'jungle-market.cart.v1'
interface StoredCart { version: 1; lines: Array<{ nftId: string; quantity: number }>; couponCode?: string }
interface StoredCarts { version: 2; guest: StoredCart; users: Record<string, StoredCart> }
const accountsKey = 'jungle-market.mock.accounts.v1'
const sessionsKey = 'jungle-market.mock.sessions.v1'
const ordersKey = 'jungle-market.mock.orders.v1'
interface MockAccount { user: { id: string; name: string; email: string }; passwordHash: string }
interface MockSession { userId: string; expiresAt: string }
const initialNftFixtures = structuredClone(nftFixtures)
type MockSocketClient = ReturnType<typeof toSocketIo>['client']
const socketClients = new Set<MockSocketClient>()
type StoredOrders = Record<string, MarketplaceOrder[]>

function readOrders(): StoredOrders {
  try { return JSON.parse(window.localStorage.getItem(ordersKey) ?? '{}') as StoredOrders } catch { return {} }
}
function writeOrders(orders: StoredOrders) { window.localStorage.setItem(ordersKey, JSON.stringify(orders)) }
function getUserOrders(request: Request) {
  const owner = getOwner(request)
  if (owner === 'invalid' || !owner.id) return null
  return { userId: owner.id, orders: readOrders()[owner.id] ?? [] }
}

function walletsFor(userId: string): MockWallet[] {
  // Carteiras de demonstração são fixtures locais; não representam conexões reais.
  const suffix = userId === 'maya-silva' ? 'a31f' : 'b82c'
  return [
    { id: `${userId}-polygon`, label: 'Carteira principal · Polygon', address: `0x7c2a…${suffix}`, network: 'polygon', isPrimary: true },
    { id: `${userId}-ethereum`, label: 'Carteira secundária · Ethereum', address: `0x19de…${suffix}`, network: 'ethereum', isPrimary: false },
  ]
}

function emitOrderUpdated(order: MarketplaceOrder) {
  const event = { orderId: order.id, userId: order.userId, version: order.version, status: order.status }
  for (const client of socketClients) client.emit('order.updated', event)
}

function updateOrderStatus(userId: string, orderId: string, status: 'confirmed' | 'declined') {
  const stored = readOrders()
  const orders = stored[userId] ?? []
  const order = orders.find((item) => item.id === orderId)
  if (!order || order.status !== 'pending') return
  order.status = status
  order.version += 1
  order.updatedAt = new Date().toISOString()
  if (status === 'confirmed') order.transactionReference = `SIM-${order.id.slice(-8).toUpperCase()}`
  stored[userId] = orders
  writeOrders(stored)

  if (status === 'confirmed') {
    const carts = readCarts()
    const cart = carts.users[userId] ?? emptyCart()
    for (const item of order.snapshot.items) {
      const line = cart.lines.find((entry) => entry.nftId === item.nftId)
      if (!line) continue
      line.quantity -= item.quantity
      if (line.quantity <= 0) cart.lines = cart.lines.filter((entry) => entry.nftId !== item.nftId)
    }
    carts.users[userId] = cart
    window.localStorage.setItem(cartStorageKey, JSON.stringify(carts))
    for (const item of order.snapshot.items) {
      const nft = nftFixtures.find((entry) => entry.id === item.nftId)
      if (!nft) continue
      nft.edition.available = Math.max(0, nft.edition.available - item.quantity)
      nft.version += 1
      const event = { nftId: nft.id, version: nft.version }
      for (const client of socketClients) client.emit('nft.updated', event)
    }
  }
  emitOrderUpdated(order)
}

function errorResponse(status: number, code: string, message: string) {
  return HttpResponse.json({ error: { code, message } }, { status })
}

function parsePriceBRL(value: string | undefined): bigint | undefined {
  if (value === undefined) return undefined
  return parseBRLToCents(value)
}

function toSearchParams(query: URLSearchParams): NftCatalogQuery {
  const pageValue = query.get('page') ?? '1'
  const pageSizeValue = query.get('pageSize') ?? '9'
  const page = Number(pageValue)
  const pageSize = Number(pageSizeValue)
  const category = query.get('category') ?? undefined
  const network = query.get('network') ?? undefined
  const sort = query.get('sort') ?? 'featured'

  if (!/^\d+$/.test(pageValue) || !Number.isSafeInteger(page) || page < 1) throw new Error('page deve ser um inteiro maior que zero.')
  if (!/^\d+$/.test(pageSizeValue) || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 50) throw new Error('pageSize deve ser um inteiro entre 1 e 50.')
  if (category && !categories.has(category as Nft['category'])) throw new Error('category não reconhecida.')
  if (network && !networks.has(network as Nft['network'])) throw new Error('network não reconhecida.')
  if (!sorts.has(sort as NftSort)) throw new Error('sort não reconhecida.')

  const minPriceBRL = query.get('minPriceBRL') ?? undefined
  const maxPriceBRL = query.get('maxPriceBRL') ?? undefined
  const min = parsePriceBRL(minPriceBRL)
  const max = parsePriceBRL(maxPriceBRL)
  if (min !== undefined && max !== undefined && min > max) throw new Error('minPriceBRL não pode ser maior que maxPriceBRL.')

  return {
    q: query.get('q')?.trim() || undefined,
    category: category as Nft['category'] | undefined,
    collection: query.get('collection') || undefined,
    network: network as Nft['network'] | undefined,
    minPriceBRL,
    maxPriceBRL,
    sort: sort as NftSort,
    page,
    pageSize,
  }
}

function comparePriceBRL(left: string, right: string) {
  const leftValue = parseBRLToCents(left)
  const rightValue = parseBRLToCents(right)
  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0
}

function getCatalog(query: NftCatalogQuery) {
  const min = parsePriceBRL(query.minPriceBRL)
  const max = parsePriceBRL(query.maxPriceBRL)
  let items = nftFixtures.filter((nft) => {
    const searchable = `${nft.name} ${nft.collection} ${nft.creator}`.toLocaleLowerCase()
    const price = parseBRLToCents(nft.priceBRL)
    return (!query.q || searchable.includes(query.q.toLocaleLowerCase()))
      && (!query.category || nft.category === query.category)
      && (!query.collection || nft.collection === query.collection)
      && (!query.network || nft.network === query.network)
      && (min === undefined || price >= min)
      && (max === undefined || price <= max)
  })

  switch (query.sort) {
    case 'price-asc': items = [...items].sort((a, b) => comparePriceBRL(a.priceBRL, b.priceBRL)); break
    case 'price-desc': items = [...items].sort((a, b) => comparePriceBRL(b.priceBRL, a.priceBRL)); break
    case 'newest': items = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)); break
    default: items = [...items].sort((a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name))
  }

  const page = query.page ?? 1
  const pageSize = query.pageSize ?? 9
  const total = items.length
  const totalPages = Math.ceil(total / pageSize)
  items = items.slice((page - 1) * pageSize, page * pageSize)
  return { items, pagination: { page, pageSize, total, totalPages } }
}

function emptyCart(): StoredCart { return { version: 1, lines: [] } }
function readCarts(): StoredCarts {
  try {
    const value = window.localStorage.getItem(cartStorageKey)
    if (!value) return { version: 2, guest: emptyCart(), users: {} }
    const parsed = JSON.parse(value) as StoredCarts | StoredCart
    const normalize = (cart: StoredCart | undefined): StoredCart => ({ version: 1, lines: Array.isArray(cart?.lines) ? cart.lines.filter((line) => typeof line.nftId === 'string' && Number.isInteger(line.quantity) && line.quantity > 0) : [], couponCode: typeof cart?.couponCode === 'string' ? cart.couponCode : undefined })
    if ((parsed as StoredCarts).version === 2) {
      const value = parsed as StoredCarts
      return { version: 2, guest: normalize(value.guest), users: Object.fromEntries(Object.entries(value.users ?? {}).map(([id, cart]) => [id, normalize(cart)])) }
    }
    return { version: 2, guest: normalize(parsed as StoredCart), users: {} }
  } catch {
    return { version: 2, guest: emptyCart(), users: {} }
  }
}

function readAccounts(): MockAccount[] {
  try {
    const stored = window.localStorage.getItem(accountsKey)
    if (stored) return JSON.parse(stored) as MockAccount[]
  } catch { /* dados simulados corrompidos voltam aos usuários de demonstração */ }
  const seeded = [
    { user: { id: 'maya-silva', name: 'Maya Silva', email: 'maya@jungle.test' }, passwordHash: '408e969ca8ea675a6817f27d14cdef391971d3ec4fee1c7fbb0e009b7eaa7f72' },
    { user: { id: 'noah-costa', name: 'Noah Costa', email: 'noah@jungle.test' }, passwordHash: '5b25aae77a70231756e8a2b109b1384851093475f14547c6eaa774186bab8f7a' },
  ]
  window.localStorage.setItem(accountsKey, JSON.stringify(seeded))
  return seeded
}

function writeAccounts(accounts: MockAccount[]) { window.localStorage.setItem(accountsKey, JSON.stringify(accounts)) }
function readSessions(): Record<string, MockSession> {
  try { return JSON.parse(window.localStorage.getItem(sessionsKey) ?? '{}') as Record<string, MockSession> } catch { return {} }
}
function writeSessions(sessions: Record<string, MockSession>) { window.localStorage.setItem(sessionsKey, JSON.stringify(sessions)) }
function authorizedUser(request: Request): MockAccount['user'] | null | 'invalid' {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const session = readSessions()[token]
  if (!session || Date.parse(session.expiresAt) <= Date.now() || window.localStorage.getItem('jungle-market.scenario.session-expired') === 'true') return 'invalid'
  return readAccounts().find((account) => account.user.id === session.userId)?.user ?? 'invalid'
}
function getOwner(request: Request): { id: string | null } | 'invalid' {
  const user = authorizedUser(request)
  return user === 'invalid' ? 'invalid' : { id: user?.id ?? null }
}
function readCart(request: Request): StoredCart {
  const carts = readCarts()
  const owner = getOwner(request)
  return owner === 'invalid' ? emptyCart() : (owner.id ? carts.users[owner.id] : carts.guest) ?? emptyCart()
}
function writeCart(request: Request, cart: StoredCart) {
  const carts = readCarts()
  const owner = getOwner(request)
  if (owner === 'invalid') return
  if (owner.id) carts.users[owner.id] = cart
  else carts.guest = cart
  window.localStorage.setItem(cartStorageKey, JSON.stringify(carts))
}

function getCartResponse(request: Request) {
  const state = readCart(request)
  const items: CartLine[] = state.lines.flatMap((line) => {
    const nft = nftFixtures.find((item) => item.id === line.nftId)
    return nft ? [{ nft, quantity: line.quantity, lineSubtotalBRL: centsToDecimal(parseBRLToCents(nft.priceBRL) * BigInt(line.quantity)) }] : []
  })
  return { items, quote: calculateCartQuote(items, state.couponCode) }
}

// MSW remove o prefixo padrão /socket.io/ antes de comparar o handler.
const socketEndpoint = new URL('/', window.location.origin)
socketEndpoint.protocol = socketEndpoint.protocol === 'https:' ? 'wss:' : 'ws:'
const socketLink = ws.link(socketEndpoint.href)

export const handlers = [
  http.post('*/api/auth/login', async ({ request }) => {
    const body = await request.json() as { email?: unknown; password?: unknown }
    if (window.localStorage.getItem('jungle-market.scenario.auth-failure') === 'true') return errorResponse(503, 'AUTH_UNAVAILABLE', 'Serviço de autenticação indisponível. Tente novamente.')
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const accounts = readAccounts()
    const account = accounts.find((item) => item.user.email.toLowerCase() === email)
    const hash = typeof body.password === 'string' ? await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body.password)) : new ArrayBuffer(0)
    const passwordHash = [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
    if (!account || account.passwordHash !== passwordHash) return errorResponse(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.')
    const token = `mock-${crypto.randomUUID()}`
    const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString()
    writeSessions({ ...readSessions(), [token]: { userId: account.user.id, expiresAt } })
    return HttpResponse.json({ session: { token, expiresAt, user: account.user } })
  }),
  http.post('*/api/auth/register', async ({ request }) => {
    const body = await request.json() as { name?: unknown; email?: unknown; password?: unknown }
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return errorResponse(400, 'INVALID_REGISTRATION', 'Confira nome, e-mail e senha (mínimo de 8 caracteres).')
    const accounts = readAccounts()
    if (accounts.some((account) => account.user.email.toLowerCase() === email)) return errorResponse(409, 'EMAIL_IN_USE', 'Este e-mail já possui cadastro.')
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
    const passwordHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
    const user = { id: `user-${crypto.randomUUID()}`, name, email }
    writeAccounts([...accounts, { user, passwordHash }])
    const token = `mock-${crypto.randomUUID()}`
    const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString()
    writeSessions({ ...readSessions(), [token]: { userId: user.id, expiresAt } })
    return HttpResponse.json({ session: { token, expiresAt, user } }, { status: 201 })
  }),
  http.get('*/api/session', ({ request }) => {
    const user = authorizedUser(request)
    if (!user || user === 'invalid') return errorResponse(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente para continuar.')
    const token = request.headers.get('authorization')!.replace(/^Bearer\s+/i, '')
    return HttpResponse.json({ session: { token, expiresAt: readSessions()[token].expiresAt, user } })
  }),


  http.get('*/api/profile', ({ request }) => {
    const user = authorizedUser(request)

    if (!user || user === 'invalid') {
      return errorResponse(
        401,
        'SESSION_EXPIRED',
        'Sua sessão expirou. Entre novamente para continuar.',
      )
    }

    return HttpResponse.json({ user })
  }),

  http.put('*/api/profile', async ({ request }) => {
    const user = authorizedUser(request)

    if (!user || user === 'invalid') {
      return errorResponse(
        401,
        'SESSION_EXPIRED',
        'Sua sessão expirou. Entre novamente para continuar.',
      )
    }

    const body = await request.json() as {
      name?: unknown
      email?: unknown
    }

    const name = typeof body.name === 'string'
      ? body.name.trim()
      : ''

    const email = typeof body.email === 'string'
      ? body.email.trim().toLowerCase()
      : ''

    if (!name || name.length > 100) {
      return errorResponse(
        422,
        'INVALID_PROFILE',
        'Informe um nome válido, com até 100 caracteres.',
      )
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return errorResponse(
        422,
        'INVALID_PROFILE',
        'Informe um e-mail válido.',
      )
    }

    const accounts = readAccounts()

    if (accounts.some(
      (account) =>
        account.user.id !== user.id &&
        account.user.email.toLowerCase() === email,
    )) {
      return errorResponse(
        409,
        'EMAIL_IN_USE',
        'Este e-mail já está cadastrado em outra conta.',
      )
    }

    const updatedAccounts = accounts.map((account) =>
      account.user.id === user.id
        ? { ...account, user: { ...account.user, name, email } }
        : account,
    )

    writeAccounts(updatedAccounts)

    const updatedUser = updatedAccounts.find(
      (account) => account.user.id === user.id,
    )?.user

    if (!updatedUser) {
      return errorResponse(
        404,
        'PROFILE_NOT_FOUND',
        'Perfil não encontrado.',
      )
    }

    return HttpResponse.json({ user: updatedUser })
  }),

  http.put('*/api/profile/password', async ({ request }) => {
    const user = authorizedUser(request)

    if (!user || user === 'invalid') {
      return errorResponse(
        401,
        'SESSION_EXPIRED',
        'Sua sessão expirou. Entre novamente para continuar.',
      )
    }

    const body = await request.json() as {
      currentPassword?: unknown
      newPassword?: unknown
    }

    const currentPassword = typeof body.currentPassword === 'string'
      ? body.currentPassword
      : ''

    const newPassword = typeof body.newPassword === 'string'
      ? body.newPassword
      : ''

    if (newPassword.length < 8 || newPassword.length > 128) {
      return errorResponse(
        422,
        'INVALID_PASSWORD',
        'A nova senha deve ter entre 8 e 128 caracteres.',
      )
    }

    const accounts = readAccounts()
    const account = accounts.find(
      (item) => item.user.id === user.id,
    )

    if (!account) {
      return errorResponse(
        404,
        'PROFILE_NOT_FOUND',
        'Perfil não encontrado.',
      )
    }

    const currentDigest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(currentPassword),
    )

    const currentHash = [...new Uint8Array(currentDigest)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')

    if (account.passwordHash !== currentHash) {
      return errorResponse(
        422,
        'CURRENT_PASSWORD_INVALID',
        'A senha atual está incorreta.',
      )
    }

    const newDigest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(newPassword),
    )

    const newHash = [...new Uint8Array(newDigest)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')

    writeAccounts(
      accounts.map((item) =>
        item.user.id === user.id
          ? { ...item, passwordHash: newHash }
          : item,
      ),
    )

    return HttpResponse.json({ updated: true })
  }),

  http.post('*/api/auth/logout', ({ request }) => {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (token) { const sessions = readSessions(); delete sessions[token]; writeSessions(sessions) }
    return HttpResponse.json({ ok: true })
  }),

  http.get('*/api/wallets', ({ request }) => {
    const owner = getOwner(request)
    if (owner === 'invalid') return errorResponse(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente para continuar.')
    if (!owner.id) return errorResponse(401, 'AUTH_REQUIRED', 'Entre para consultar suas carteiras.')
    return HttpResponse.json({ wallets: walletsFor(owner.id) })
  }),
  http.post('*/api/wallets/:walletId/connect', ({ params, request }) => {
    const owner = getOwner(request)
    if (owner === 'invalid') return errorResponse(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente para continuar.')
    if (!owner.id || !walletsFor(owner.id).some((wallet) => wallet.id === params.walletId)) return errorResponse(404, 'WALLET_NOT_FOUND', 'Carteira não encontrada.')
    if (window.localStorage.getItem('jungle-market.scenario.wallet-connect-refused') === 'true') return errorResponse(422, 'WALLET_CONNECTION_REFUSED', 'A conexão simulada foi recusada.')
    return HttpResponse.json({ connected: true, walletId: params.walletId, simulated: true })
  }),
  http.post('*/api/wallets/:walletId/disconnect', ({ params, request }) => {
    const owner = getOwner(request)
    if (owner === 'invalid') return errorResponse(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente para continuar.')
    if (!owner.id || !walletsFor(owner.id).some((wallet) => wallet.id === params.walletId)) return errorResponse(404, 'WALLET_NOT_FOUND', 'Carteira não encontrada.')
    return HttpResponse.json({ connected: false, walletId: params.walletId, simulated: true })
  }),
  http.get('*/api/checkout/quote', ({ request }) => {
    const owner = getOwner(request)
    if (owner === 'invalid') return errorResponse(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente para continuar.')
    if (!owner.id) return errorResponse(401, 'AUTH_REQUIRED', 'Entre para iniciar o checkout.')
    const cart = getCartResponse(request)
    if (cart.items.length === 0) return errorResponse(409, 'EMPTY_CART', 'Seu carrinho está vazio.')
    if (cart.quote.couponCode && window.localStorage.getItem('jungle-market.scenario.checkout-coupon-invalid') === 'true') {
      return errorResponse(422, 'COUPON_INVALID', 'O cupom não está mais válido. Volte ao carrinho para removê-lo e revisar os valores.')
    }
    const unavailable = cart.items.find((line) => line.quantity > line.nft.edition.available || line.nft.edition.available === 0)
    if (unavailable) return HttpResponse.json({ error: { code: 'EDITION_UNAVAILABLE', message: 'Revise a quantidade: uma edição não está mais disponível.', currentQuote: buildCheckoutQuote(cart.items, cart.quote.couponCode) } }, { status: 409 })
    return HttpResponse.json({ quote: buildCheckoutQuote(cart.items, cart.quote.couponCode) })
  }),
  http.post('*/api/orders', async ({ request }) => {
    const owner = getOwner(request)
    if (owner === 'invalid') return errorResponse(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente para continuar.')
    if (!owner.id) return errorResponse(401, 'AUTH_REQUIRED', 'Entre para criar um pedido.')
    const idempotencyKey = request.headers.get('idempotency-key')?.trim()
    if (!idempotencyKey || idempotencyKey.length < 8) return errorResponse(400, 'IDEMPOTENCY_KEY_REQUIRED', 'A chave de idempotência é obrigatória.')
    const body = await request.json() as Partial<CreateOrderInput>
    const buyer = body.buyer
    if (!buyer || typeof buyer.name !== 'string' || typeof buyer.email !== 'string' || typeof buyer.document !== 'string') return errorResponse(400, 'INVALID_BUYER', 'Informe os dados do colecionador.')
    const fieldErrors = validateCheckoutBuyer(buyer)
    if (Object.keys(fieldErrors).length) return HttpResponse.json({ error: { code: 'INVALID_BUYER', message: Object.values(fieldErrors)[0] } }, { status: 422 })
    if (typeof body.quoteVersion !== 'string' || typeof body.walletId !== 'string' || (body.network !== 'polygon' && body.network !== 'ethereum')) return errorResponse(400, 'INVALID_CHECKOUT', 'Confira cotação, carteira e rede.')
    const wallet = walletsFor(owner.id).find((item) => item.id === body.walletId)
    if (!wallet || wallet.network !== body.network) return errorResponse(422, 'INVALID_WALLET', 'Selecione uma carteira cadastrada para a rede escolhida.')

    const stored = readOrders()
    const orders = stored[owner.id] ?? []
    const existing = orders.find((item) => item.idempotencyKey === idempotencyKey)
    const requestFingerprint = JSON.stringify(body)
    if (existing) {
      if (existing.requestFingerprint !== requestFingerprint) {
        return errorResponse(409, 'IDEMPOTENCY_CONFLICT', 'Esta chave já foi utilizada com outro conteúdo.')
      }
      return HttpResponse.json({ order: existing })
    }

    if (window.localStorage.getItem('jungle-market.scenario.checkout-coupon-invalid') === 'true' && readCart(request).couponCode) {
      const cart = getCartResponse(request)
      const currentQuote = buildCheckoutQuote(cart.items)
      return HttpResponse.json({ error: { code: 'COUPON_INVALID', message: 'O cupom não está mais válido. Remova-o e confirme novamente os valores.', currentQuote } }, { status: 409 })
    }

    const unavailableOnce = window.localStorage.getItem('jungle-market.scenario.order-unavailable-once') === 'true'
    if (unavailableOnce) {
      window.localStorage.removeItem('jungle-market.scenario.order-unavailable-once')
      return errorResponse(503, 'ORDER_SERVICE_UNAVAILABLE', 'Serviço de pedidos temporariamente indisponível.')
    }

    const cartResponse = getCartResponse(request)
    if (!cartResponse.items.length) return errorResponse(409, 'EMPTY_CART', 'Seu carrinho está vazio.')
    const currentQuote = buildCheckoutQuote(cartResponse.items, cartResponse.quote.couponCode)
    if (!currentQuote.items.every((item) => item.quantity <= item.available) || !currentQuote.items.length) {
      return HttpResponse.json({ error: { code: 'EDITION_UNAVAILABLE', message: 'Uma edição ficou indisponível. Revise o carrinho.', currentQuote } }, { status: 409 })
    }
    if (currentQuote.version !== body.quoteVersion) {
      return HttpResponse.json({ error: { code: 'QUOTE_CHANGED', message: 'Preço, disponibilidade ou desconto mudaram. Revise os valores antes de enviar novamente.', currentQuote } }, { status: 409 })
    }

    const order: MarketplaceOrder = {
      id: `order-${crypto.randomUUID()}`,
      idempotencyKey,
      requestFingerprint,
      userId: owner.id,
      status: 'pending',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      snapshot: {
        items: currentQuote.items.map(({ nftId, name, collection, creator, imageUrl, quantity, priceBRL, lineSubtotalBRL }) => ({ nftId, name, collection, creator, imageUrl, quantity, priceBRL, lineSubtotalBRL })),
        quote: currentQuote.quote,
        buyer: { name: buyer.name.trim(), email: buyer.email.trim(), document: buyer.document.trim() },
        wallet,
        network: body.network,
      },
    }
    stored[owner.id] = [...orders, order]
    writeOrders(stored)

    const timeoutOnce = window.localStorage.getItem('jungle-market.scenario.order-timeout-once') === 'true'
    if (timeoutOnce) {
      window.localStorage.removeItem('jungle-market.scenario.order-timeout-once')
      const outcome = window.localStorage.getItem('jungle-market.scenario.order-outcome')
      if (outcome !== 'pending') setTimeout(() => updateOrderStatus(owner.id!, order.id, outcome === 'declined' ? 'declined' : 'confirmed'), 400)
      return HttpResponse.error()
    }
    const outcome = window.localStorage.getItem('jungle-market.scenario.order-outcome')
    if (outcome !== 'pending') setTimeout(() => updateOrderStatus(owner.id!, order.id, outcome === 'declined' ? 'declined' : 'confirmed'), 400)
    return HttpResponse.json({ order }, { status: 201 })
  }),
  http.get('*/api/orders/by-idempotency/:key', ({ params, request }) => {
    const owner = getUserOrders(request)
    if (!owner) return errorResponse(401, 'AUTH_REQUIRED', 'Entre para consultar seus pedidos.')
    const order = owner.orders.find((item) => item.idempotencyKey === params.key)
    return order ? HttpResponse.json({ order }) : errorResponse(404, 'ORDER_NOT_FOUND', 'Ainda não existe um pedido para esta tentativa.')
  }),
  http.get('*/api/orders/:orderId', ({ params, request }) => {
    const owner = getUserOrders(request)
    if (!owner) return errorResponse(401, 'AUTH_REQUIRED', 'Entre para consultar seus pedidos.')
    const order = owner.orders.find((item) => item.id === params.orderId)
    return order ? HttpResponse.json({ order }) : errorResponse(404, 'ORDER_NOT_FOUND', 'Pedido não encontrado.')
  }),
  http.post('*/api/mock/scenarios/orders', async ({ request }) => {
    const body = await request.json() as { outcome?: unknown; timeoutOnce?: unknown; unavailableOnce?: unknown; walletRefused?: unknown; couponInvalid?: unknown }
    if (body.outcome !== undefined && !['confirmed', 'declined', 'pending'].includes(String(body.outcome))) return errorResponse(400, 'INVALID_SCENARIO', 'outcome deve ser confirmed, declined ou pending.')
    if (body.outcome) window.localStorage.setItem('jungle-market.scenario.order-outcome', String(body.outcome))
    if (body.timeoutOnce === true) window.localStorage.setItem('jungle-market.scenario.order-timeout-once', 'true')
    if (body.unavailableOnce === true) window.localStorage.setItem('jungle-market.scenario.order-unavailable-once', 'true')
    if (body.walletRefused === true) window.localStorage.setItem('jungle-market.scenario.wallet-connect-refused', 'true')
    if (body.couponInvalid === true) window.localStorage.setItem('jungle-market.scenario.checkout-coupon-invalid', 'true')
    return HttpResponse.json({ ok: true })
  }),
  http.post('*/api/mock/scenarios/orders/:orderId/resolve', async ({ params, request }) => {
    const body = await request.json() as { status?: unknown }
    if (body.status !== 'confirmed' && body.status !== 'declined') return errorResponse(400, 'INVALID_SCENARIO', 'status deve ser confirmed ou declined.')
    const stored = readOrders()
    const order = Object.values(stored).flat().find((item) => item.id === params.orderId)
    if (!order) return errorResponse(404, 'ORDER_NOT_FOUND', 'Pedido não encontrado.')
    updateOrderStatus(order.userId, order.id, body.status)
    return HttpResponse.json({ order: readOrders()[order.userId]?.find((item) => item.id === order.id) })
  }),
  http.post('*/api/cart/merge-guest', ({ request }) => {
    const user = authorizedUser(request)
    if (!user || user === 'invalid') return errorResponse(401, 'SESSION_EXPIRED', 'Entre novamente para mesclar o carrinho.')
    const carts = readCarts()
    const guest = carts.guest
    if (!guest.lines.length) return HttpResponse.json({ ...getCartResponse(request), merged: 0 })
    const owned = carts.users[user.id] ?? emptyCart()
    const combined = new Map(owned.lines.map((line) => [line.nftId, line.quantity]))
    for (const line of guest.lines) {
      const nft = nftFixtures.find((item) => item.id === line.nftId)
      const total = (combined.get(line.nftId) ?? 0) + line.quantity
      if (nft && total > nft.edition.available) return errorResponse(409, 'CART_MERGE_REVIEW', 'Uma edição mudou de disponibilidade. Os dois carrinhos foram preservados; ajuste as quantidades e tente novamente.')
      combined.set(line.nftId, total)
    }
    carts.users[user.id] = { version: 1, lines: [...combined].map(([nftId, quantity]) => ({ nftId, quantity })), couponCode: owned.couponCode ?? guest.couponCode }
    carts.guest = emptyCart()
    window.localStorage.setItem(cartStorageKey, JSON.stringify(carts))
    return HttpResponse.json({ ...getCartResponse(request), merged: guest.lines.length })
  }),
  http.get('*/api/nfts', ({ request }) => {
    try {
      const query = toSearchParams(new URL(request.url).searchParams)
      return HttpResponse.json(getCatalog(query))
    } catch (error) {
      return errorResponse(400, 'INVALID_CATALOG_QUERY', error instanceof Error ? error.message : 'Parâmetros de catálogo inválidos.')
    }
  }),
  http.get('*/api/nfts/:nftId', ({ params }) => {
    const nft = nftFixtures.find((item) => item.id === params.nftId)
    return nft ? HttpResponse.json({ item: nft }) : errorResponse(404, 'NFT_NOT_FOUND', 'NFT não encontrado.')
  }),
  http.get('*/api/cart', ({ request }) => {
    if (getOwner(request) === 'invalid') return errorResponse(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente para continuar.')
    if (window.localStorage.getItem('jungle-market.scenario.cart-read-failure') === 'once') {
      window.localStorage.removeItem('jungle-market.scenario.cart-read-failure')
      return errorResponse(503, 'TEMPORARY_FAILURE', 'Falha transitória simulada.')
    }
    return HttpResponse.json(getCartResponse(request))
  }),
  http.post('*/api/cart/items', async ({ request }) => {
    if (getOwner(request) === 'invalid') return errorResponse(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente para continuar.')
    const body = await request.json() as { nftId?: unknown; quantity?: unknown }
    const nft = typeof body.nftId === 'string' ? nftFixtures.find((item) => item.id === body.nftId) : undefined
    if (!nft) return errorResponse(404, 'NFT_NOT_FOUND', 'NFT não encontrado.')
    if (!Number.isSafeInteger(body.quantity) || Number(body.quantity) < 1) return errorResponse(400, 'INVALID_QUANTITY', 'A quantidade deve ser um inteiro positivo.')
    const state = readCart(request)
    const existing = state.lines.find((line) => line.nftId === nft.id)
    const nextQuantity = (existing?.quantity ?? 0) + Number(body.quantity)
    if (nft.edition.available < nextQuantity) return errorResponse(409, 'EDITION_UNAVAILABLE', 'A quantidade solicitada excede as edições disponíveis.')
    if (existing) existing.quantity = nextQuantity
    else state.lines.push({ nftId: nft.id, quantity: Number(body.quantity) })
    writeCart(request, state)
    return HttpResponse.json(getCartResponse(request), { status: 201 })
  }),
  http.patch('*/api/cart/items/:nftId', async ({ params, request }) => {
    if (getOwner(request) === 'invalid') return errorResponse(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente para continuar.')
    if (window.localStorage.getItem('jungle-market.scenario.cart-update-failure') === 'once') {
      window.localStorage.removeItem('jungle-market.scenario.cart-update-failure')
      return errorResponse(503, 'TEMPORARY_FAILURE', 'Falha transitória ao atualizar o carrinho.')
    }
    const body = await request.json() as { quantity?: unknown }
    const state = readCart(request)
    const line = state.lines.find((item) => item.nftId === params.nftId)
    const nft = nftFixtures.find((item) => item.id === params.nftId)
    if (!line || !nft) return errorResponse(404, 'CART_ITEM_NOT_FOUND', 'Item não encontrado no carrinho.')
    if (!Number.isSafeInteger(body.quantity) || Number(body.quantity) < 1) return errorResponse(400, 'INVALID_QUANTITY', 'A quantidade deve ser um inteiro positivo.')
    if (Number(body.quantity) > nft.edition.available) return errorResponse(409, 'EDITION_UNAVAILABLE', 'A quantidade solicitada excede as edições disponíveis.')
    line.quantity = Number(body.quantity)
    writeCart(request, state)
    return HttpResponse.json(getCartResponse(request))
  }),
  http.delete('*/api/cart/items/:nftId', ({ params, request }) => {
    if (getOwner(request) === 'invalid') return errorResponse(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente para continuar.')
    const state = readCart(request)
    state.lines = state.lines.filter((line) => line.nftId !== params.nftId)
    writeCart(request, state)
    return HttpResponse.json(getCartResponse(request))
  }),
  http.delete('*/api/cart', ({ request }) => {
    if (getOwner(request) === 'invalid') return errorResponse(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente para continuar.')
    writeCart(request, emptyCart())
    return HttpResponse.json(getCartResponse(request))
  }),
  http.post('*/api/cart/coupon', async ({ request }) => {
    if (getOwner(request) === 'invalid') return errorResponse(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente para continuar.')
    const body = await request.json() as { code?: unknown }
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
    if (code === 'VERDE5') return errorResponse(422, 'COUPON_EXPIRED', 'Este cupom expirou.')
    if (code !== 'JUNGLE10') return errorResponse(422, 'INVALID_COUPON', 'Cupom inválido.')
    const state = readCart(request)
    if (state.lines.length === 0) return errorResponse(400, 'EMPTY_CART', 'Adicione um NFT antes de aplicar o cupom.')
    state.couponCode = code
    writeCart(request, state)
    return HttpResponse.json(getCartResponse(request))
  }),
  http.delete('*/api/cart/coupon', ({ request }) => {
    if (getOwner(request) === 'invalid') return errorResponse(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente para continuar.')
    const state = readCart(request)
    delete state.couponCode
    writeCart(request, state)
    return HttpResponse.json(getCartResponse(request))
  }),
  http.post('*/api/mock/scenarios/nfts/:nftId', async ({ params, request }) => {
    const nft = nftFixtures.find((item) => item.id === params.nftId)
    if (!nft) return errorResponse(404, 'NFT_NOT_FOUND', 'NFT não encontrado.')
    const body = await request.json() as { priceBRL?: unknown; available?: unknown }
    if (body.priceBRL !== undefined) {
      if (typeof body.priceBRL !== 'string') return errorResponse(400, 'INVALID_PRICE', 'priceBRL deve ser uma string decimal.')
      try { parseBRLToCents(body.priceBRL) } catch { return errorResponse(400, 'INVALID_PRICE', 'priceBRL deve ter até duas casas decimais.') }
    }
    if (body.available !== undefined) {
      if (!Number.isSafeInteger(body.available) || Number(body.available) < 0 || Number(body.available) > nft.edition.total) {
        return errorResponse(400, 'INVALID_AVAILABILITY', 'available deve ser um inteiro entre zero e o total da edição.')
      }
    }
    if (typeof body.priceBRL === 'string') nft.priceBRL = body.priceBRL
    if (typeof body.available === 'number') nft.edition.available = body.available
    nft.version += 1
    const event = { nftId: nft.id, version: nft.version }
    for (const client of socketClients) client.emit('nft.updated', event)
    return HttpResponse.json({ item: nft })
  }),
  http.post('*/api/mock/scenarios/reset', () => {
    nftFixtures.splice(0, nftFixtures.length, ...structuredClone(initialNftFixtures))
    window.localStorage.removeItem(cartStorageKey)
    writeOrders({})
    for (const key of [
      'jungle-market.scenario.session-expired', 'jungle-market.scenario.auth-failure',
      'jungle-market.scenario.cart-read-failure', 'jungle-market.scenario.cart-update-failure',
      'jungle-market.scenario.order-timeout-once', 'jungle-market.scenario.order-unavailable-once',
      'jungle-market.scenario.order-outcome', 'jungle-market.scenario.wallet-connect-refused',
      'jungle-market.scenario.checkout-coupon-invalid',
    ]) window.localStorage.removeItem(key)
    return HttpResponse.json({ ok: true })
  }),
  http.get('*/api/health', () => HttpResponse.json({ source: 'msw-rest', ok: true })),
  socketLink.addEventListener('connection', (connection) => {
    const { client } = toSocketIo(connection)
    socketClients.add(client)
    client.on('disconnect', () => socketClients.delete(client))
    queueMicrotask(() => client.emit('nft.updated', { nftId: 'nft-poc-1', version: 1 }))
  }),
]
