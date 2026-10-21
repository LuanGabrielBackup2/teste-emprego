import { expect, test } from '@playwright/test'

test('intercepta Axios via MSW e entrega evento ao cliente Socket.IO via MSW', async ({ page }) => {
  await page.goto('/__transport')

  await expect(page.getByTestId('rest-status')).toHaveAttribute('data-state', 'ok')
  await expect(page.getByTestId('socket-status')).toHaveAttribute('data-state', 'ok')
})
