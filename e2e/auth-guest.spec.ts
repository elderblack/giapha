import { expect, test } from '@playwright/test'

test.describe('auth (khách)', () => {
  test('trang đăng nhập', async ({ page }) => {
    await page.goto('/app/login')
    await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
  })

  test('/app và /app/home chuyển về login', async ({ page }) => {
    await page.goto('/app/home')
    await expect(page).toHaveURL(/\/app\/login/)
    await page.goto('/app')
    await expect(page).toHaveURL(/\/app\/login/)
  })
})
