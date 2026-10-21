import { useEffect, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { apiClient } from '@/lib/api/client'
import type { NftUpdatedEvent } from '@/contracts/realtime'
import { connectRealtime } from '@/lib/realtime/socket'

type Check = 'aguardando' | 'worker-ok' | 'ok' | 'erro'

export function TransportSmokePage() {
  const [rest, setRest] = useState<Check>('aguardando')
  const [socket, setSocket] = useState<Check>('aguardando')
  const [failure, setFailure] = useState('')

  useEffect(() => {
    let active = true
    let socketClient: Socket | undefined

    async function verify() {
      try {
        const response = await apiClient.get<{ source: string }>('/api/health')
        if (!active || response.data.source !== 'msw-rest') throw new Error('Resposta REST não veio do MSW.')
        setRest('ok')
        socketClient = await connectRealtime({
          onNftUpdated: (event: NftUpdatedEvent) => {
            if (active && event.nftId === 'nft-poc-1' && event.version === 1) {
              setSocket('ok')
              socketClient?.disconnect()
            }
          },
        })
        socketClient.on('connect_error', () => { if (active) setSocket('erro') })
      } catch (error) {
        if (active) {
          setRest('erro')
          setFailure(error instanceof Error ? error.message : String(error))
        }
      }
    }

    void verify()
    return () => { active = false; socketClient?.disconnect() }
  }, [])

  return <main className="transport-diagnostic">
    <h1>Prova de transporte</h1>
    <p>Verificação de regressão da integração de rede aprovada.</p>
    <ul>
      <li data-testid="rest-status" data-state={rest}>Axios → MSW REST: {rest}</li>
      <li data-testid="socket-status" data-state={socket}>Socket.IO Client → MSW: {socket}</li>
    </ul>
    {failure && <pre data-testid="transport-error">{failure}</pre>}
  </main>
}
