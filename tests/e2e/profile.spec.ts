
import { expect, test } from '@playwright/test'

async function loginMaya(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill('maya@jungle.test')
  await page.getByLabel('Senha').fill('Jungle#2025')
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(
    page.getByRole('button', { name: 'Sair da conta de Maya Silva' }),
  ).toBeVisible()
}

async function openProfile(page: import('@playwright/test').Page) {
  await page.getByRole('link', { name: 'Meu perfil' }).click()
  await expect(
    page.getByRole('heading', { name: 'Meu perfil' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: /seus dados/i }),
  ).toBeVisible()
}

test.describe('Perfil do usuário', () => {
  test('edita o nome e mantém os dados após recarregar', async ({ page }) => {
    await loginMaya(page)
    await openProfile(page)

    const nome = page.getByLabel('Nome completo')
    await nome.fill('Maya Silva Atualizada')
    await page.getByRole('button', { name: /salvar alterações/i }).click()

    await expect(page.getByRole('status')).toContainText(/atualizado|sucesso/i)
    await expect(
      page.getByRole('button', {
        name: 'Sair da conta de Maya Silva Atualizada',
      }),
    ).toBeVisible()

    await page.reload()
    await expect(
      page.getByRole('heading', { name: 'Meu perfil' }),
    ).toBeVisible()
    await expect(page.getByLabel('Nome completo')).toHaveValue(
      'Maya Silva Atualizada',
    )
  })

  test('impede usar um e-mail já cadastrado por outra conta', async ({ page }) => {
    await loginMaya(page)
    await openProfile(page)

    await page.getByLabel('E-mail').fill('noah@jungle.test')
    await page.getByRole('button', { name: /salvar alterações/i }).click()

    await expect(page.getByRole('alert')).toContainText(/e-mail/i)
  })

  test('valida a confirmação da nova senha', async ({ page }) => {
    await loginMaya(page)
    await openProfile(page)

    await page.getByLabel('Senha atual').fill('Jungle#2025')
    await page.locator('input[name="newPassword"]').fill('NovaSenha#2026')
    await page
      .getByLabel(/confirmar nova senha/i)
      .fill('SenhaDiferente#2026')

    await page.getByRole('button', { name: /alterar senha/i }).click()

    await expect(page.getByRole('alert')).toContainText(/confirmação não corresponde/i)
  })

  test('troca a senha e permite entrar com a nova senha', async ({ page }) => {
    await loginMaya(page)
    await openProfile(page)

    await page.getByLabel('Senha atual').fill('SenhaIncorreta#2026')
    await page.locator('input[name="newPassword"]').fill('NovaSenha#2026')
    await page
      .getByLabel(/confirmar nova senha/i)
      .fill('NovaSenha#2026')
    await page.getByRole('button', { name: /alterar senha/i }).click()

    await expect(page.getByRole('alert')).toBeVisible()

    await page.getByLabel('Senha atual').fill('Jungle#2025')
    await page.getByRole('button', { name: /alterar senha/i }).click()

    await expect(page.getByRole('status')).toContainText(/senha.*alterada|sucesso/i)

    await page.getByRole('button', { name: /sair da conta/i }).click()
    await page.goto('/login')
    await page.getByLabel('E-mail').fill('maya@jungle.test')
    await page.getByLabel('Senha').fill('NovaSenha#2026')
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(
      page.getByRole('button', { name: /sair da conta de maya/i }),
    ).toBeVisible()
  })

  test('redireciona para o login quando não existe sessão', async ({ page }) => {
    await page.goto('/profile')

    await expect(page).toHaveURL(/\/login\?returnTo=%2Fprofile/)
    await expect(
      page.getByRole('link', { name: /criar cadastro/i }),
    ).toBeVisible()
  })
})