import { expect, test } from '@playwright/test'

test.describe('landing', () => {
  test('title và hero', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/GiaPhả/)
    await expect(page.getByRole('heading', { level: 1 }).first()).toContainText('Gắn kết mọi')
  })

  test('điều hướng anchor Tính năng', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('Điều hướng chính').getByRole('link', { name: 'Tính năng' }).click()
    await expect(page).toHaveURL(/#features/)
    await expect(page.getByRole('heading', { name: 'Mọi thứ cần cho một dòng họ' })).toBeVisible()
  })

  test('header Đăng nhập tới /app/login', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('banner').getByRole('link', { name: 'Đăng nhập' }).click()
    await expect(page).toHaveURL(/\/app\/login/)
  })
})
