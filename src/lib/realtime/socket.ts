import type { Socket } from 'socket.io-client'
import type { NftUpdatedEvent, OrderUpdatedEvent } from '@/contracts/realtime'

export async function connectRealtime(options: {
  onNftUpdated: (event: NftUpdatedEvent) => void
  onOrderUpdated?: (event: OrderUpdatedEvent) => void
  onConnect?: () => void
}): Promise<Socket> {
  // Importar só depois que o MSW iniciar garante que seu interceptor WebSocket
  // esteja ativo antes do socket.io-client abrir a conexão.
  const { io } = await import('socket.io-client')
  const socket = io(window.location.origin, {
    transports: ['websocket'],
    // Checkout e resultado do pedido precisam reconciliar após uma interrupção curta.
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 250,
    reconnectionDelayMax: 1_000,
    timeout: 3_000,
  })

  socket.on('nft.updated', options.onNftUpdated)
  if (options.onConnect) socket.on('connect', options.onConnect)
  if (options.onOrderUpdated) {
    socket.on('order.updated', options.onOrderUpdated)
  }

  return socket
}
