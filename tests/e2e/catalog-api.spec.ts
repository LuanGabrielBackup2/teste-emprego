import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  // A aplicação só monta a rota depois que o service worker está ativo.
  await expect(page.getByRole('heading', { name: /Explore o catálogo/ })).toBeVisible({ timeout: 15_000 })
})

test('catálogo combina filtros, preço, ordenação e paginação no handler MSW', async ({ page }) => {
  const response = await page.evaluate(async () => {
    const result = await fetch('/api/nfts?category=art&network=ethereum&minPriceBRL=50.00&sort=price-asc&page=1&pageSize=2')
    return { status: result.status, body: await result.json() }
  })

  expect(response.status).toBe(200)
  expect(response.body.items).toHaveLength(2)
  expect(response.body.items.map((nft: { id: string }) => nft.id)).toEqual(['violet-dream', 'quiet-orbit'])
  expect(response.body.pagination).toEqual({ page: 1, pageSize: 2, total: 3, totalPages: 2 })
})

test('busca sem resultados retorna coleção vazia e detalhe inexistente retorna 404 tipado', async ({ page }) => {
  const results = await page.evaluate(async () => {
    const emptyResponse = await fetch('/api/nfts?q=nao-existe-na-jungle')
    const missingResponse = await fetch('/api/nfts/id-que-nao-existe')
    return {
      emptyStatus: emptyResponse.status,
      empty: await emptyResponse.json(),
      missingStatus: missingResponse.status,
      missing: await missingResponse.json(),
    }
  })

  expect(results.emptyStatus).toBe(200)
  expect(results.empty.items).toEqual([])
  expect(results.empty.pagination).toEqual({ page: 1, pageSize: 9, total: 0, totalPages: 0 })
  expect(results.missingStatus).toBe(404)
  expect(results.missing.error.code).toBe('NFT_NOT_FOUND')
})

test('detalhe existente e parâmetros inválidos têm respostas reproduzíveis', async ({ page }) => {
  const results = await page.evaluate(async () => {
    const detailResponse = await fetch('/api/nfts/emerald-ape-042')
    const invalidResponse = await fetch('/api/nfts?page=0&pageSize=100')
    return {
      detailStatus: detailResponse.status,
      detail: await detailResponse.json(),
      invalidStatus: invalidResponse.status,
      invalid: await invalidResponse.json(),
    }
  })

  expect(results.detailStatus).toBe(200)
  expect(results.detail.item.id).toBe('emerald-ape-042')
  expect(results.detail.item.priceBRL).toBe('235.90')
  expect(results.invalidStatus).toBe(400)
  expect(results.invalid.error.code).toBe('INVALID_CATALOG_QUERY')
})
