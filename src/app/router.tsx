import {
  createRootRoute,
  createRoute,
  createRouter,
  defaultStringifySearch,
  lazyRouteComponent,
  Outlet,
} from '@tanstack/react-router'
import type { NftCatalogQuery } from '@/contracts/nft'

const CatalogPage = lazyRouteComponent(() => import('./App'), 'App')
const NftDetailPage = lazyRouteComponent(() => import('@/features/nft-detail/nft-detail-page'), 'NftDetailPage')
const CartPage = lazyRouteComponent(() => import('@/features/cart/cart-page'), 'CartPage')
const TransportSmokePage = lazyRouteComponent(() => import('@/features/diagnostics/transport-smoke-page'), 'TransportSmokePage')
const LoginPage = lazyRouteComponent(() => import('@/features/auth/auth-pages'), 'LoginPage')
const RegisterPage = lazyRouteComponent(() => import('@/features/auth/auth-pages'), 'RegisterPage')
const CheckoutPage = lazyRouteComponent(() => import('@/features/checkout/checkout-page'), 'CheckoutPage')
const OrderPage = lazyRouteComponent(() => import('@/features/orders/order-page'), 'OrderPage')
const ProfilePage = lazyRouteComponent(
  () => import('@/features/profile/profile-page'),
  'ProfilePage',
)

function validateLoginSearch(search: Record<string, unknown>) {
  const destination = typeof search.returnTo === 'string' ? search.returnTo : undefined
  return { returnTo: destination?.startsWith('/') && !destination.startsWith('//') ? destination : undefined }
}

function validateCatalogSearch(search: Record<string, unknown>): NftCatalogQuery {
  const stringValue = (key: string) => {
    const value = search[key]
    if (typeof value === 'string') return value
    // O parser padrão do Router lê `0.5` como number; contratos monetários são strings.
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
    return undefined
  }
  const integerValue = (key: string, fallback: number, maximum: number) => {
    const parsed = Number(search[key])
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= maximum ? parsed : fallback
  }
  const category = stringValue('category')
  const network = stringValue('network')
  const sort = stringValue('sort')
  const validPrice = (value: string | undefined) => value && /^\d+(\.\d{1,2})?$/.test(value) ? value : undefined

  return {
    q: stringValue('q')?.trim() || undefined,
    category: category === 'avatar' || category === 'art' || category === 'collectible' ? category : undefined,
    collection: stringValue('collection'),
    network: network === 'ethereum' || network === 'polygon' ? network : undefined,
    minPriceBRL: validPrice(stringValue('minPriceBRL')),
    maxPriceBRL: validPrice(stringValue('maxPriceBRL')),
    sort: sort === 'price-asc' || sort === 'price-desc' || sort === 'newest' ? sort : 'featured',
    page: integerValue('page', 1, 100_000),
    pageSize: integerValue('pageSize', 9, 50),
  }
}

function stringifyCatalogSearch(search: Record<string, unknown>) {
  const { minPriceBRL, maxPriceBRL, ...otherSearch } = search
  const ordinaryParams = defaultStringifySearch(otherSearch).replace(/^\?/, '')
  const priceParams = Object.entries({ minPriceBRL, maxPriceBRL })
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
  const combined = [ordinaryParams, priceParams].filter(Boolean).join('&')
  return combined ? `?${combined}` : ''
}

const rootRoute = createRootRoute({ component: Outlet })

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: validateCatalogSearch,
  component: CatalogPage,
})

const nftDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/nft/$nftId',
  component: NftDetailPage,
})

const transportRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/__transport',
  component: TransportSmokePage,
})

const cartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cart',
  component: CartPage,
})

const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: '/login', validateSearch: validateLoginSearch, component: LoginPage })
const registerRoute = createRoute({ getParentRoute: () => rootRoute, path: '/register', validateSearch: validateLoginSearch, component: RegisterPage })
const checkoutRoute = createRoute({ getParentRoute: () => rootRoute, path: '/checkout', component: CheckoutPage })
const orderRoute = createRoute({ getParentRoute: () => rootRoute, path: '/orders/$orderId', component: OrderPage })

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  component: ProfilePage,
})

const routeTree = rootRoute.addChildren([indexRoute, nftDetailRoute, cartRoute, loginRoute, registerRoute, checkoutRoute, orderRoute,   profileRoute, transportRoute])

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  stringifySearch: stringifyCatalogSearch,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
