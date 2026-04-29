import { expect, test } from '@playwright/test'

test.describe('cây phả hệ (khách — chưa đăng nhập)', () => {
  test('/app/trees chuyển về đăng nhập', async ({ page }) => {
    await page.goto('/app/trees')
    await expect(page).toHaveURL(/\/app\/login/)
  })

  test('sơ đồ /app/trees/:id/chart cũng yêu cầu đăng nhập', async ({ page }) => {
    await page.goto('/app/trees/00000000-0000-0000-0000-000000000001/chart')
    await expect(page).toHaveURL(/\/app\/login/)
  })

  test('trang đăng nhập vẫn hiển thị form', async ({ page }) => {
    await page.goto('/app/login')
    await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible()
  })
})
