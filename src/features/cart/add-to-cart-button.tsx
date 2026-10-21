import axios from 'axios'
import type { ApiErrorResponse } from '@/contracts/nft'
import { useAddCartItem } from './use-cart'

interface AddToCartButtonProps {
  nftId: string
  quantity: number
  available?: number
  className?: string
}

export function AddToCartButton({ nftId, quantity, available = Number.MAX_SAFE_INTEGER, className = 'button-primary' }: AddToCartButtonProps) {
  const mutation = useAddCartItem()
  const error = axios.isAxiosError<ApiErrorResponse>(mutation.error)
    ? mutation.error.response?.data.error.message
    : mutation.error instanceof Error ? mutation.error.message : undefined

  async function add() {
    try {
      await mutation.mutateAsync({ nftId, quantity })
    } catch {
      // O erro é apresentado no status acessível abaixo.
    }
  }

  return <div className="add-to-cart-control">
    <button className={className} type="button" onClick={() => void add()} disabled={mutation.isPending || quantity > available}>
      {mutation.isPending ? 'Adicionando…' : `Adicionar ${quantity > 1 ? quantity + ' ' : ''}ao carrinho`}
    </button>
    {mutation.isSuccess && <p className="cart-feedback" role="status">Item adicionado ao carrinho.</p>}
    {error && <p className="cart-feedback cart-feedback-error" role="alert">{error}</p>}
  </div>
}
