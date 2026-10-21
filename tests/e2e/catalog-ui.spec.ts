import { expect, test } from '@playwright/test'

test('carrega filtros compartilháveis pela URL e mantém o estado após refresh', async ({ page }) => {
  await page.goto('/?category=art&network=ethereum&minPriceBRL=50.00&sort=price-asc&page=1&pageSize=2')

  await expect(page.getByRole('heading', { name: 'Violet Dream' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Quiet Orbit' })).toBeVisible()
  await expect(page.getByTestId('nft-grid').locator('article')).toHaveCount(2)
  await expect(page.getByLabel('Categoria')).toHaveValue('art')
  await expect(page.getByLabel('Rede')).toHaveValue('ethereum')
  await expect(page.getByLabel('Ordenar catálogo')).toHaveValue('price-asc')

  await page.reload()
  await expect(page.getByTestId('nft-grid').locator('article')).toHaveCount(2)
  await expect(page).toHaveURL(/category=art/)
  await expect(page).toHaveURL(/pageSize=2/)
})

test('alterar um filtro reinicia a página e o histórico restaura os filtros anteriores', async ({ page }) => {
  await page.goto('/?page=2&pageSize=2')
  await expect(page.getByText('Página 2 de 9')).toBeVisible()

  await page.getByLabel('Categoria').selectOption('art')
  await expect(page).toHaveURL(/category=art/)
  await expect(page).toHaveURL(/page=1/)
  await expect(page.getByText('Página 1 de 3')).toBeVisible()

  await page.goBack()
  await expect(page).toHaveURL(/page=2/)
  await expect(page.getByLabel('Categoria')).toHaveValue('')
  await expect(page.getByText('Página 2 de 9')).toBeVisible()
})

test('busca por texto e combina com filtro de categoria sem perder estado no URL', async ({ page }) => {
  await page.goto('/')
  const search = page.getByRole('searchbox', { name: 'Buscar no catálogo' })
  await search.fill('Wild Canvas')
  await expect(page).toHaveURL(/q=Wild\+Canvas/)
  await page.getByLabel('Categoria').selectOption('art')

  await expect(page).toHaveURL(/category=art/)
  await expect(page).toHaveURL(/q=Wild\+Canvas/)
  await expect(page.getByTestId('nft-grid').locator('article')).toHaveCount(3)
  await expect(page.getByRole('heading', { name: 'Violet Dream' })).toBeVisible()
})

test('abre detalhes do NFT selecionado e trata um ID inexistente', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Ver detalhes de Emerald Ape #042' }).click()

  await expect(page).toHaveURL(/\/nft\/emerald-ape-042$/)
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()
  await expect(page.getByText('R$ 235,90', { exact: true })).toBeVisible()
  await expect(page.getByText('Edição disponível para aquisição')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ver coleção' })).toBeVisible()

  await page.goto('/nft/id-que-nao-existe')
  await expect(page.getByTestId('nft-not-found')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('heading', { name: 'Esta peça não está na coleção.' })).toBeVisible({ timeout: 15_000 })
})

test('mostra estado vazio e permite limpar a busca', async ({ page }) => {
  await page.goto('/?q=nao-existe-na-jungle')
  await expect(page.getByTestId('catalog-empty')).toBeVisible()
  await page.getByRole('button', { name: 'Limpar busca e filtros' }).click()
  await expect(page).not.toHaveURL(/q=/)
  await expect(page.getByTestId('nft-grid').locator('article')).toHaveCount(9)
})

test('mostra erro de API 400 e mantém a URL para a pessoa corrigir os filtros', async ({ page }) => {
  await page.goto('/?minPriceBRL=100.00&maxPriceBRL=50.00')
  await expect(page.getByRole('alert').getByRole('heading', { name: 'Não conseguimos carregar o catálogo' })).toBeVisible()
  await expect(page).toHaveURL(/minPriceBRL=100(?:\.00)?/)
  await expect(page).toHaveURL(/maxPriceBRL=50(?:\.00)?/)
})

test('permanece operável e sem overflow horizontal em mobile, tablet e desktop', async ({ page }) => {
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /Explore o catálogo/ })).toBeVisible({ timeout: 15_000 })
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }))
    expect(dimensions.content, `largura do conteúdo em ${width}px`).toBeLessThanOrEqual(dimensions.viewport + 1)
  }
  await page.keyboard.press('Tab')
  await expect(page.locator(':focus')).toHaveAttribute('aria-label', 'Jungle Market — início')
})
