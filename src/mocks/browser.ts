import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

const worker = setupWorker(...handlers)
let workerStartPromise: ReturnType<typeof worker.start> | undefined

export function startMocks() {
  if (!workerStartPromise) {
    workerStartPromise = worker
      .start({ onUnhandledRequest: 'error' })
      .catch((error: unknown) => {
        workerStartPromise = undefined
        throw error
      })
  }

  return workerStartPromise
}
