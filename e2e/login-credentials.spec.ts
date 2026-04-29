/**
 * Chỉ chạy tay khi debug: đặt E2E_LOGIN_EMAIL và E2E_LOGIN_PASSWORD trong môi trường.
 * Không commit mật khẩu vào repo.
 *
 *   E2E_LOGIN_EMAIL=... E2E_LOGIN_PASSWORD=... pnpm exec playwright test e2e/login-credentials.spec.ts
 */
import { expect, test } from '@playwright/test'

test.describe('Đăng nhập thật (optional)', () => {
  test('redirect khỏi /app/login sau khi nhập đúng ENV', async ({ page }) => {
    const email = process.env.E2E_LOGIN_EMAIL?.trim()
    const password = process.env.E2E_LOGIN_PASSWORD
    test.skip(!email || !password, 'Cần E2E_LOGIN_EMAIL và E2E_LOGIN_PASSWORD')

    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    const reqFailed: string[] = []
    page.on('requestfailed', (r) => reqFailed.push(`${r.url()} ${r.failure()?.errorText ?? ''}`))
    const restErrors: { url: string; status: number }[] = []
    page.on('response', (resp) => {
      const u = resp.url()
      if (u.includes('/rest/v1/') || u.includes('/auth/v1/') || u.includes('/rpc/')) {
        const st = resp.status()
        if (st >= 400 && st !== 401) restErrors.push({ url: u.split('?')[0], status: st })
      }
    })

    await page.goto('/app/login')

    await page.locator('#auth-email').fill(email!)
    await page.locator('#auth-password').fill(password!)
    await page.locator('#auth-password').press('Enter')

    const stillOnLogin = async () => page.url().includes('/app/login')

    try {
      await expect(page).not.toHaveURL(/\/app\/login$/, { timeout: 35000 })
    } catch {
      const statusMsg = await page.locator('[role="status"]').first().textContent().catch(() => null)
      await page.screenshot({ path: 'test-results/login-debug.png', fullPage: true })
      throw new Error(
        `Vẫn ở đăng nhập. Thông báo trang: ${statusMsg ?? '(không có)'}. ` +
          `Console errors: ${JSON.stringify(consoleErrors)}. ` +
          `Request failed: ${JSON.stringify(reqFailed)}.`,
      )
    }

    expect(await stillOnLogin()).toBe(false)

    await page.goto('/app/trees')
    await expect(page.getByRole('heading', { name: /Không gian của gia tộc|Dòng họ/i })).toBeVisible({
      timeout: 15000,
    })

    const idMatch = await page.evaluate(() => {
      const a = document.querySelector<HTMLAnchorElement>('a[href^="/app/trees/"]')
      const h = a?.getAttribute('href') ?? ''
      const m = h.match(/^\/app\/trees\/([a-f0-9-]+)/i)
      return m ? m[1] : null
    })

    if (idMatch) {
      await page.goto(`/app/trees/${idMatch}/members`)
      await page.waitForLoadState('networkidle')
      await expect(page.locator('body')).toBeVisible()
    }

    if (consoleErrors.length > 0) {
      console.warn('Console errors sau login:', consoleErrors)
    }
    if (reqFailed.length > 0) {
      console.warn('Requests failed sau login:', reqFailed)
    }
    if (restErrors.length > 0) {
      console.warn('REST/RPC status >= 400:', restErrors)
    }
    expect(restErrors, 'PostgREST/RPC không được trả >=400 — thường do thiếu migration hoặc RLS').toHaveLength(
      0,
    )
  })
})
