import { Link } from '@tanstack/react-router'
import { LeafIcon, SearchIcon } from './icons'
import { useCartQuery } from '@/features/cart/use-cart'
import { useSession, useLogout } from '@/features/auth/use-session'
import { useNavigate } from '@tanstack/react-router'

interface MarketplaceHeaderProps {
  onSearch?: (value: string) => void
  searchValue?: string
}

export function MarketplaceHeader({ onSearch, searchValue = '' }: MarketplaceHeaderProps) {
  const cart = useCartQuery()
  const session = useSession()
  const logout = useLogout()
  const navigate = useNavigate()
  const itemCount = cart.data?.quote.itemCount ?? 0
  return (
    <header className="site-header">
      <Link className="brand" to="/" aria-label="Jungle Market — início">
        <span className="brand-mark"><LeafIcon size={19} /></span>
        <span>JUNGLE<span className="brand-light">MARKET</span></span>
      </Link>
      {onSearch ? (
        <label className="header-search">
          <SearchIcon size={16} />
          <span className="sr-only">Buscar no catálogo</span>
          <input
            aria-label="Buscar no catálogo"
            type="search"
            placeholder="Buscar NFTs, artistas..."
            value={searchValue}
            onChange={(event) => onSearch(event.currentTarget.value)}
            data-testid="catalog-search"
          />
          <kbd>/</kbd>
        </label>
      ) : <span className="header-caption">ARTE QUE FLORESCE</span>}
      <nav className="header-links" aria-label="Navegação principal">
        <Link to="/" className="header-link">Explorar</Link>
        <Link to="/cart" className="header-link" aria-label={`Carrinho, ${itemCount} ${itemCount === 1 ? 'item' : 'itens'}`}>Carrinho <span className="cart-count" aria-live="polite">{itemCount}</span></Link>
        <a className="header-link header-link-muted" href="#catalogo">Coleções</a>

        {session.data && (
          <Link className="header-link" to="/profile">
            Meu perfil
          </Link>
        )}

      {session.data ? <button className="header-account" type="button" onClick={() => { void logout.mutateAsync().then(() => navigate({ to: '/' })) }} disabled={logout.isPending} aria-label={`Sair da conta de ${session.data.user.name}`}>{logout.isPending ? '…' : 'Sair'}</button> : <Link className="header-link header-login" to="/login" search={{ returnTo: undefined }}>Entrar</Link>}
      </nav>
    </header>
  )
}
