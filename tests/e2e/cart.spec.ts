import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Explore o catálogo/ })).toBeVisible({ timeout: 15_000 })
})

test('adiciona um NFT pelo catálogo e mostra a quantidade no cabeçalho', async ({ page }) => {
  const card = page.locator('.nft-card').filter({ hasText: 'Emerald Ape #042' })
  await card.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
  await expect(card.getByRole('status')).toHaveText('Item adicionado ao carrinho.')
  await expect(page.getByRole('link', { name: 'Carrinho, 1 item' })).toBeVisible()
  await page.getByRole('link', { name: 'Carrinho, 1 item' }).click()
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()
  await expect(page.locator('.cart-grand-total')).toContainText('R$ 235,90')
})

test('apresenta BRL no catálogo e no detalhe do NFT', async ({ page }) => {
  await expect(page.locator('.nft-card').filter({ hasText: 'Emerald Ape #042' })).toContainText('R$ 235,90')
  await page.goto('/nft/emerald-ape-042')
  await expect(page.locator('.detail-price-row')).toContainText('R$ 235,90')
  await expect(page.locator('.detail-price-row')).not.toContainText('ETH')
})

test('seleciona quantidade no detalhe e a API impede exceder as edições', async ({ page }) => {
  await page.goto('/nft/emerald-ape-042')
  await page.getByRole('button', { name: 'Aumentar quantidade' }).click()
  await page.getByRole('button', { name: 'Adicionar 2 ao carrinho' }).click()
  await expect(page.getByRole('status')).toHaveText('Item adicionado ao carrinho.')
  await page.getByRole('link', { name: 'Carrinho, 2 itens' }).click()
  await expect(page.locator('.cart-grand-total')).toContainText('R$ 471,80')

  const status = await page.evaluate(async () => {
    const response = await fetch('/api/cart/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nftId: 'sun-disk', quantity: 2 }) })
    return response.status
  })
  expect(status).toBe(409)
})

test('altera quantidade com atualização otimista e remove o item', async ({ page }) => {
  const card = page.locator('.nft-card').filter({ hasText: 'Emerald Ape #042' })
  await card.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
  await page.getByRole('link', { name: 'Carrinho, 1 item' }).click()
  await page.getByRole('button', { name: 'Aumentar quantidade de Emerald Ape #042' }).click()
  await expect(page.locator('.cart-grand-total')).toContainText('R$ 471,80')
  await page.getByRole('button', { name: 'Diminuir quantidade de Emerald Ape #042' }).click()
  await expect(page.locator('.cart-grand-total')).toContainText('R$ 235,90')
  await page.getByRole('button', { name: 'Remover' }).click()
  await expect(page.getByTestId('cart-empty')).toBeVisible()
})

test('limpa o carrinho e mostra o estado vazio', async ({ page }) => {
  await page.locator('.nft-card').filter({ hasText: 'Emerald Ape #042' }).getByRole('button', { name: 'Adicionar ao carrinho' }).click()
  await page.getByRole('link', { name: 'Carrinho, 1 item' }).click()
  await page.getByRole('button', { name: 'Limpar carrinho' }).click()
  await expect(page.getByTestId('cart-empty')).toBeVisible()
})

test('mantém itens e cupom após refresh e apresenta a cotação BRL da API', async ({ page }) => {
  await page.locator('.nft-card').filter({ hasText: 'Emerald Ape #042' }).getByRole('button', { name: 'Adicionar ao carrinho' }).click()
  await page.getByRole('link', { name: 'Carrinho, 1 item' }).click()
  await page.getByLabel('Cupom de desconto').fill('JUNGLE10')
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await expect(page.getByText('10% de desconto')).toBeVisible()
  await expect(page.locator('.cart-grand-total')).toContainText('R$ 212,31')
  await expect(page.getByText('Taxa de rede', { exact: true })).toBeVisible()
  await expect(page.getByText('R$ 0,00')).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('JUNGLE10 · 10% de desconto')).toBeVisible()
  await expect(page.locator('.cart-grand-total')).toContainText('R$ 212,31')
})

test('a API rejeita cupom inválido e expirado sem alterar o total', async ({ page }) => {
  await page.locator('.nft-card').filter({ hasText: 'Emerald Ape #042' }).getByRole('button', { name: 'Adicionar ao carrinho' }).click()
  await page.getByRole('link', { name: 'Carrinho, 1 item' }).click()
  const total = page.locator('.cart-grand-total')
  await expect(total).toContainText('R$ 235,90')

  await page.getByLabel('Cupom de desconto').fill('NAOEXISTE')
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await expect(page.getByRole('alert')).toContainText('Cupom inválido.')
  await expect(total).toContainText('R$ 235,90')

  await page.getByLabel('Cupom de desconto').fill('VERDE5')
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await expect(page.getByRole('alert')).toContainText('Este cupom expirou.')
  await expect(total).toContainText('R$ 235,90')
})

test('atualiza a cotação quando chega um evento Socket.IO com novo preço', async ({ page }) => {
  await page.locator('.nft-card').filter({ hasText: 'Emerald Ape #042' }).getByRole('button', { name: 'Adicionar ao carrinho' }).click()
  await page.getByRole('link', { name: 'Carrinho, 1 item' }).click()
  await expect(page.getByText('Atualizações de preço ativas')).toBeVisible({ timeout: 10_000 })
  try {
    const response = await page.evaluate(async () => fetch('/api/mock/scenarios/nfts/emerald-ape-042', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priceBRL: '250.00', available: 8 }),
    }).then((result) => result.status))
    expect(response).toBe(200)
    await expect(page.locator('.cart-line-prices')).toContainText('R$ 250,00')
    await expect(page.locator('.cart-grand-total')).toContainText('R$ 250,00')
    const availabilityResponse = await page.evaluate(async () => fetch('/api/mock/scenarios/nfts/emerald-ape-042', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ available: 0 }),
    }).then((result) => result.status))
    expect(availabilityResponse).toBe(200)
    await expect(page.getByText('Esta edição está esgotada.')).toBeVisible()
  } finally {
    await page.evaluate(() => fetch('/api/mock/scenarios/reset', { method: 'POST' }))
  }
})

test('restaura a quantidade e a cotação se a atualização otimista falhar', async ({ page }) => {
  await page.locator('.nft-card').filter({ hasText: 'Emerald Ape #042' }).getByRole('button', { name: 'Adicionar ao carrinho' }).click()
  await page.getByRole('link', { name: 'Carrinho, 1 item' }).click()
  await page.evaluate(() => localStorage.setItem('jungle-market.scenario.cart-update-failure', 'once'))
  await page.getByRole('button', { name: 'Aumentar quantidade de Emerald Ape #042' }).click()
  await expect(page.locator('.cart-grand-total')).toContainText('R$ 235,90')
  await expect(page.getByRole('alert')).toContainText('Falha transitória ao atualizar o carrinho.')
})

test('detalhe e API tratam NFT esgotado', async ({ page }) => {
  await page.goto('/nft/moss-ape-088')
  await expect(page.getByRole('button', { name: 'Edição esgotada' })).toBeDisabled()
  const status = await page.evaluate(async () => {
    const response = await fetch('/api/cart/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nftId: 'moss-ape-088', quantity: 1 }) })
    return response.status
  })
  expect(status).toBe(409)
})

test('permite retentar quando a API do carrinho falha', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('jungle-market.scenario.cart-read-failure', 'once'))
  await page.goto('/cart')
  await expect(page.getByRole('heading', { name: 'Não conseguimos carregar seu carrinho' })).toBeVisible()
  await expect(page.getByText('Falha transitória simulada.')).toBeVisible()
  await page.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(page.getByTestId('cart-empty')).toBeVisible()
})

test('o carrinho cabe nos viewports mobile, tablet e desktop', async ({ page }) => {
  await page.locator('.nft-card').filter({ hasText: 'Emerald Ape #042' }).getByRole('button', { name: 'Adicionar ao carrinho' }).click()
  await page.getByRole('link', { name: 'Carrinho, 1 item' }).click()
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }))
    expect(dimensions.content, `largura do carrinho em ${width}px`).toBeLessThanOrEqual(dimensions.viewport + 1)
  }
})
