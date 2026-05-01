/**
 * Một lần: tạo user Auth + gán vào platform_admins.
 * CHỈ CHẠY TRÊN MÁY CÓ service_role — không commit key, không đẩy lên CI công khai.
 *
 * Cần áp migration `20260901120000_platform_admin_dashboard.sql`.
 *
 * Chuẩn bị trong apps/web/.env.local hoặc biến môi trường:
 *   NEXT_PUBLIC_SUPABASE_URL (hoặc SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Tùy chọn:
 *   ADMIN_BOOTSTRAP_EMAIL   (mặc định: admin@giapha.vn)
 *   ADMIN_BOOTSTRAP_PASSWORD (mặc định: admin123)
 *
 * Chạy: pnpm --filter web bootstrap-platform-admin  (hoặc: cd apps/web && pnpm bootstrap-platform-admin)
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnvLocal(): void {
  const path = join(__dirname, '..', '.env.local')
  if (!existsSync(path)) return
  const raw = readFileSync(path, 'utf8')
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq <= 0) continue
    const key = t.slice(0, eq).trim()
    let val = t.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

async function main() {
  loadEnvLocal()

  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const email = (process.env.ADMIN_BOOTSTRAP_EMAIL ?? 'admin@giapha.vn').trim().toLowerCase()
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? 'admin123'

  if (!url || !serviceRole) {
    console.error('Thiếu SUPABASE_URL (hoặc NEXT_PUBLIC_SUPABASE_URL) và/hoặc SUPABASE_SERVICE_ROLE_KEY.')
    console.error('Lấy Service Role trong Supabase Dashboard → Settings → API (không dùng anon key).')
    process.exit(1)
  }

  const sb = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let userId: string | null = null

  const createRes = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Platform Admin', name: 'Platform Admin' },
  })

  if (createRes.error) {
    const em = createRes.error.message.toLowerCase()
    if (
      !em.includes('already') &&
      !em.includes('registered') &&
      !em.includes('duplicate') &&
      createRes.error.status !== 422
    ) {
      console.error('Không tạo được user:', createRes.error.message)
      process.exit(1)
    }
    let page = 1
    const perPage = 200
    for (;;) {
      const list = await sb.auth.admin.listUsers({ page, perPage })
      if (list.error) {
        console.error('Không liệt kê được user:', list.error.message)
        process.exit(1)
      }
      const u = list.data.users.find((x) => (x.email ?? '').toLowerCase() === email)
      if (u) {
        userId = u.id
        break
      }
      if (list.data.users.length < perPage) break
      page += 1
      if (page > 50) break
    }
    if (!userId) {
      console.error('User đã tồn tại nhưng không tìm thấy theo email. Kiểm tra email hoặc tạo tay trên Dashboard.')
      process.exit(1)
    }
    const upd = await sb.auth.admin.updateUserById(userId, { password, email_confirm: true })
    if (upd.error) {
      console.error('Không cập nhật mật khẩu:', upd.error.message)
      process.exit(1)
    }
  } else if (createRes.data.user) {
    userId = createRes.data.user.id
  }

  if (!userId) {
    console.error('Không lấy được user id.')
    process.exit(1)
  }

  const ins = await sb.from('platform_admins').upsert(
    { user_id: userId, note: 'bootstrap script' },
    { onConflict: 'user_id' },
  )
  if (ins.error) {
    console.error('Không ghi platform_admins:', ins.error.message)
    console.error('Chạy migration platform_admin_dashboard chưa?')
    process.exit(1)
  }

  console.log('')
  console.log('— Xong. Đăng nhập web (apps) với:')
  console.log(`  Email:    ${email}`)
  console.log(`  Mật khẩu: ${password}`)
  console.log(`  User id:  ${userId}`)
  console.log('  Sau đó mở /app/admin — đổi mật khẩu trong Hồ sơ / Bảo mật.')
  console.log('')
}

void main()
