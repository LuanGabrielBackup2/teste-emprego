import { expect, test } from '@playwright/test'

async function prepareCheckout(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.evaluate(() => fetch('/api/mock/scenarios/reset', { method: 'POST' }))
  await page.reload()
  const card = page.locator('.nft-card').filter({ hasText: 'Emerald Ape #042' })
  await card.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
  await expect(card.getByRole('status')).toHaveText('Item adicionado ao carrinho.')
  await page.goto('/checkout')
  await expect.poll(async () => await page.getByLabel('E-mail').isVisible() || await page.getByRole('heading', { name: 'Finalizar pedido.' }).isVisible()).toBeTruthy()
  if (await page.getByLabel('E-mail').isVisible()) {
    await page.getByLabel('E-mail').fill('maya@jungle.test')
    await page.getByLabel('Senha').fill('Jungle#2025')
    await page.getByRole('button', { name: 'Entrar' }).click()
  }
  await expect(page.getByRole('heading', { name: 'Finalizar pedido.' })).toBeVisible({ timeout: 15_000 })
}

async function connectAndFill(page: import('@playwright/test').Page) {
  await page.getByLabel('CPF do colecionador').fill('52998224725')
  await page.getByRole('button', { name: 'Conectar carteira simulada' }).click()
  await expect(page.getByRole('status')).toContainText('Carteira conectada na simulação.')
}

test('compra completa apresenta snapshot confirmado em BRL, mesmo após atualização do catálogo', async ({ page }) => {
  await prepareCheckout(page)
  await expect(page.getByText('R$ 235,90').last()).toBeVisible()
  await connectAndFill(page)
  await page.getByRole('button', { name: 'Enviar pedido' }).click()
  await expect(page).toHaveURL(/\/orders\/order-/)
  await expect(page.getByRole('heading', { name: 'Pedido confirmado.' })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('heading', { name: 'Resumo do pedido' })).toBeVisible()
  await expect(page.locator('.order-receipt')).toContainText('R$ 235,90')
  const orderId = new URL(page.url()).pathname.split('/').pop()!
  await page.evaluate(async () => fetch('/api/mock/scenarios/nfts/emerald-ape-042', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priceBRL: '999.99' }) }))
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Pedido confirmado.' })).toBeVisible()
  await expect(page.locator('.order-receipt')).toContainText('R$ 235,90')
  await expect(page.locator('.order-receipt')).not.toContainText('R$ 999,99')
  expect(new URL(page.url()).pathname).toBe(`/orders/${orderId}`)
})

test('valida campos antes de enviar e mostra erros associados', async ({ page }) => {
  await prepareCheckout(page)
  await page.getByLabel('Nome completo').fill('A')
  await page.getByLabel('E-mail').fill('invalido')
  await page.getByLabel('CPF do colecionador').fill('11111111111')
  await page.getByRole('button', { name: 'Enviar pedido' }).click()
  await expect(page.getByText('Informe seu nome completo.')).toBeVisible()
  await expect(page.getByText('Informe um e-mail válido.')).toBeVisible()
  await expect(page.getByText('Informe um CPF válido com 11 dígitos.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Enviar pedido' })).toBeEnabled()
})

test('carteira simulada pode recusar a conexão e não libera o envio', async ({ page }) => {
  await prepareCheckout(page)
  await page.getByLabel('CPF do colecionador').fill('52998224725')
  await page.evaluate(() => localStorage.setItem('jungle-market.scenario.wallet-connect-refused', 'true'))
  await page.getByRole('button', { name: 'Conectar carteira simulada' }).click()
  await expect(page.getByRole('alert')).toContainText('A conexão simulada foi recusada.')
  await page.getByRole('button', { name: 'Enviar pedido' }).click()
  await expect(page.locator('.checkout-feedback-error')).toContainText('Conecte a carteira simulada escolhida')
})

test('mudança de preço em tempo real exige revisão antes do envio', async ({ page }) => {
  await prepareCheckout(page)
  await connectAndFill(page)
  await expect(page.getByRole('button', { name: 'Enviar pedido' })).toBeEnabled()
  await page.evaluate(async () => fetch('/api/mock/scenarios/nfts/emerald-ape-042', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priceBRL: '260.00' }) }))
  await expect(page.locator('.checkout-alert').filter({ hasText: 'A cotação mudou.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Enviar pedido' })).toBeDisabled()
  await expect(page.locator('.checkout-item')).toContainText('R$ 260,00')
  await page.getByRole('button', { name: 'Revisar nova cotação' }).click()
  await expect(page.getByRole('button', { name: 'Enviar pedido' })).toBeEnabled()
})

test('estoque insuficiente é revalidado e bloqueia o pedido', async ({ page }) => {
  await prepareCheckout(page)
  await page.evaluate(async () => fetch('/api/mock/scenarios/nfts/emerald-ape-042', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ available: 0 }) }))
  await expect(page.locator('.checkout-alert').filter({ hasText: 'A cotação mudou.' })).toBeVisible()
  await expect(page.locator('.checkout-stock-error')).toContainText('Disponibilidade insuficiente: 0')
  await expect(page.getByRole('button', { name: 'Enviar pedido' })).toBeDisabled()
})

test('timeout após persistência recupera o mesmo pedido sem duplicar', async ({ page }) => {
  await prepareCheckout(page)
  await connectAndFill(page)
  await page.evaluate(() => localStorage.setItem('jungle-market.scenario.order-timeout-once', 'true'))
  await page.getByRole('button', { name: 'Enviar pedido' }).click()
  await expect(page).toHaveURL(/\/orders\/order-/)
  await expect(page.getByRole('heading', { name: 'Pedido confirmado.' })).toBeVisible({ timeout: 10_000 })
  const orderId = new URL(page.url()).pathname.split('/').pop()!
  const count = await page.evaluate(() => {
    const orders = JSON.parse(localStorage.getItem('jungle-market.mock.orders.v1') ?? '{}')
    return Object.values(orders).flat().length
  })
  expect(count).toBe(1)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Pedido confirmado.' })).toBeVisible()
  expect(new URL(page.url()).pathname).toBe(`/orders/${orderId}`)
})

test('resposta indisponível não cria compra e permite repetir a mesma tentativa', async ({ page }) => {
  await prepareCheckout(page)
  await connectAndFill(page)
  await page.evaluate(() => localStorage.setItem('jungle-market.scenario.order-unavailable-once', 'true'))
  await page.getByRole('button', { name: 'Enviar pedido' }).click()
  await expect(page.getByRole('alert')).toContainText('Serviço de pedidos temporariamente indisponível.')
  const count = await page.evaluate(() => {
    const orders = JSON.parse(localStorage.getItem('jungle-market.mock.orders.v1') ?? '{}')
    return Object.values(orders).flat().length
  })
  expect(count).toBe(0)
  await page.getByRole('button', { name: 'Enviar pedido' }).click()
  await expect(page).toHaveURL(/\/orders\/order-/)
  await expect(page.getByRole('heading', { name: 'Pedido confirmado.' })).toBeVisible({ timeout: 10_000 })
})

test('recusa é terminal, não mostra recibo e preserva os itens no carrinho', async ({ page }) => {
  await prepareCheckout(page)
  await connectAndFill(page)
  await page.evaluate(() => localStorage.setItem('jungle-market.scenario.order-outcome', 'declined'))
  await page.getByRole('button', { name: 'Enviar pedido' }).click()
  await expect(page.getByRole('heading', { name: 'Pedido recusado.' })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('heading', { name: 'Resumo do pedido' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Voltar ao carrinho' }).click()
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()
  await expect(page.locator('.cart-grand-total')).toContainText('R$ 235,90')
})

test('cupom invalidado durante checkout impede pedido e aponta para revisão do carrinho', async ({ page }) => {
  await prepareCheckout(page)
  await connectAndFill(page)
  await page.evaluate(async () => {
    const session = JSON.parse(localStorage.getItem('jungle-market.session.v1')!)
    await fetch('/api/cart/coupon', { method: 'POST', headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'JUNGLE10' }) })
    localStorage.setItem('jungle-market.scenario.checkout-coupon-invalid', 'true')
  })
  await page.getByRole('button', { name: 'Enviar pedido' }).click()
  await expect(page.locator('.checkout-feedback-error')).toContainText('O cupom não está mais válido.')
  await expect(page.getByRole('link', { name: 'Voltar ao carrinho', exact: true })).toBeVisible()
  const count = await page.evaluate(() => {
    const orders = JSON.parse(localStorage.getItem('jungle-market.mock.orders.v1') ?? '{}')
    return Object.values(orders).flat().length
  })
  expect(count).toBe(0)
})

test('pedido pendente é recuperado após refresh e recebe atualização confirmada via Socket.IO', async ({ page }) => {
  await prepareCheckout(page)
  await connectAndFill(page)
  await page.evaluate(() => localStorage.setItem('jungle-market.scenario.order-outcome', 'pending'))
  await page.getByRole('button', { name: 'Enviar pedido' }).click()
  await expect(page).toHaveURL(/\/orders\/order-/)
  await expect(page.getByRole('heading', { name: 'Pedido pendente.' })).toBeVisible()
  const orderId = new URL(page.url()).pathname.split('/').pop()!
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Pedido pendente.' })).toBeVisible()
  await page.evaluate(async (id) => fetch(`/api/mock/scenarios/orders/${id}/resolve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'confirmed' }) }), orderId)
  await expect(page.getByRole('heading', { name: 'Pedido confirmado.' })).toBeVisible({ timeout: 10_000 })
})

test('cliques repetidos na interface enviam uma única criação de pedido', async ({ page }) => {
  await prepareCheckout(page)
  await connectAndFill(page)
  const button = page.getByRole('button', { name: 'Enviar pedido' })
  await button.evaluate((element) => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await expect(page).toHaveURL(/\/orders\/order-/)
  const count = await page.evaluate(() => {
    const orders = JSON.parse(localStorage.getItem('jungle-market.mock.orders.v1') ?? '{}')
    return Object.values(orders).flat().length
  })
  expect(count).toBe(1)
})

test('API idempotente recupera o mesmo pedido e rejeita chave com corpo divergente', async ({ page }) => {
  await prepareCheckout(page)
  await connectAndFill(page)
  const keys = await page.evaluate(async () => {
    const session = JSON.parse(localStorage.getItem('jungle-market.session.v1')!)
    const headers = { Authorization: `Bearer ${session.token}` }
    const quote = (await fetch('/api/checkout/quote', { headers }).then((response) => response.json())).quote
    const wallets = (await fetch('/api/wallets', { headers }).then((response) => response.json())).wallets
    const input = { quoteVersion: quote.version, buyer: { name: 'Maya Silva', email: 'maya@jungle.test', document: '52998224725' }, walletId: wallets[0].id, network: wallets[0].network }
    const key = 'playwright-idempotency-key-001'
    const send = (body: typeof input) => fetch('/api/orders', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(body) })
    const first = await send(input)
    const second = await send(input)
    const firstBody = await first.json()
    const secondBody = await second.json()
    const conflict = await send({ ...input, buyer: { ...input.buyer, name: 'Outra pessoa' } })
    return { firstId: firstBody.order.id, secondId: secondBody.order.id, conflictStatus: conflict.status }
  })
  expect(keys.firstId).toBe(keys.secondId)
  expect(keys.conflictStatus).toBe(409)
})

test('pedido de um usuário não pode ser consultado pela sessão de outro', async ({ page }) => {
  await prepareCheckout(page)
  await connectAndFill(page)
  await page.getByRole('button', { name: 'Enviar pedido' }).click()
  await expect(page.getByRole('heading', { name: 'Pedido confirmado.' })).toBeVisible({ timeout: 10_000 })
  const orderId = new URL(page.url()).pathname.split('/').pop()!
  await page.getByRole('button', { name: 'Sair da conta de Maya Silva' }).click()
  await page.goto('/login')
  await page.getByLabel('E-mail').fill('noah@jungle.test')
  await page.getByLabel('Senha').fill('Canopy#2025')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.goto(`/orders/${orderId}`)
  await expect(page.getByRole('heading', { name: 'Não foi possível confirmar o resultado.' })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Pedido não encontrado.')
  await expect(page.getByRole('heading', { name: 'Resumo do pedido' })).toHaveCount(0)
})

test('checkout e recibo não criam overflow nos viewports mobile, tablet e desktop', async ({ page }) => {
  await prepareCheckout(page)
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }))
    expect(dimensions.content, `checkout em ${width}px`).toBeLessThanOrEqual(dimensions.viewport + 1)
  }
  await connectAndFill(page)
  await page.getByRole('button', { name: 'Enviar pedido' }).click()
  await expect(page.getByRole('heading', { name: 'Pedido confirmado.' })).toBeVisible({ timeout: 10_000 })
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }))
    expect(dimensions.content, `recibo em ${width}px`).toBeLessThanOrEqual(dimensions.viewport + 1)
  }
})
