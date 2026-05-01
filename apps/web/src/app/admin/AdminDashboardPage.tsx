import { useCallback, useEffect, useState } from 'react'
import { LayoutDashboard, Loader2, RefreshCw } from 'lucide-react'
import { role } from '../../design/roles'
import { getSupabase } from '../../lib/supabase'
import type { AdminDashboardSummary, WaitlistAdminRow } from './types'

function formatInt(n: unknown): string {
  if (n == null) return '—'
  const num = typeof n === 'number' ? n : Number(n)
  if (Number.isNaN(num)) return '—'
  return num.toLocaleString('vi-VN')
}

function formatDt(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d)
}

const statDefs: { key: keyof AdminDashboardSummary; label: string }[] = [
  { key: 'profiles', label: 'Tài khoản (profiles)' },
  { key: 'trees', label: 'Dòng họ' },
  { key: 'tree_members', label: 'Thành viên trên cây' },
  { key: 'tree_roles', label: 'Gán vai trò dòng họ' },
  { key: 'waitlist', label: 'Đăng ký waitlist' },
  { key: 'feed_posts', label: 'Bài bảng tin' },
  { key: 'chat_conversations', label: 'Hội thoại chat' },
]

export function AdminDashboardPage() {
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    const sb = getSupabase()
    if (!sb) {
      setErr('Chưa cấu hình Supabase.')
      setLoading(false)
      return
    }
    setErr(null)
    setLoading(true)
    const { data, error } = await sb.rpc('get_admin_dashboard_summary')
    setLoading(false)
    if (error) {
      setErr(error.message)
      setSummary(null)
      return
    }
    const row = data as AdminDashboardSummary | null
    if (row?.error === 'forbidden') {
      setErr('Bạn không có quyền quản trị.')
      setSummary(null)
      return
    }
    if (row?.error) {
      setErr(row.error)
      setSummary(null)
      return
    }
    setSummary(row)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const rows: WaitlistAdminRow[] = Array.isArray(summary?.waitlist_rows) ? summary.waitlist_rows : []

  return (
    <div className="pb-16">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-abnb-lg bg-abnb-primary/12 text-abnb-primary ring-1 ring-abnb-hairlineSoft">
            <LayoutDashboard className="h-6 w-6" strokeWidth={1.75} aria-hidden />
          </span>
          <div>
            <p className={role.kicker}>Nội bộ vận hành</p>
            <h1 className={`${role.headingSection} mt-1`}>Dashboard quản trị</h1>
            <p className={`${role.bodySm} mt-2 max-w-xl text-abnb-muted`}>
              Số liệu tổng hợp và danh sách đăng ký sớm (waitlist). Quyền truy cập do bảng{' '}
              <code className="rounded bg-abnb-surfaceSoft px-1 py-0.5 text-xs">platform_admins</code> trên Supabase.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className={`${role.btnSecondary} inline-flex h-11 min-w-0 items-center gap-2 !rounded-full !px-5 text-sm disabled:opacity-60`}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Làm mới dữ liệu
          </button>
        </div>
      </div>

      {err ? (
        <div
          className={`${role.cardQuiet} mb-8 border-abnb-error/30 bg-abnb-error/5 px-4 py-3 text-sm font-medium text-abnb-error`}
          role="alert"
        >
          {err}
        </div>
      ) : null}

      {loading && !summary ? (
        <div className="flex justify-center py-20 text-abnb-muted">
          <Loader2 className="h-10 w-10 animate-spin text-abnb-primary" aria-hidden />
        </div>
      ) : summary ? (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {statDefs.map(({ key, label }) => (
              <li key={key} className={`${role.cardElevated} p-5`}>
                <p className={role.statLabel}>{label}</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-abnb-ink tabular-nums">
                  {formatInt(summary[key])}
                </p>
              </li>
            ))}
          </ul>

          <section className="mt-12">
            <h2 className={role.headingModule}>Waitlist gần đây</h2>
            <p className={`${role.bodySm} mt-2 text-abnb-muted`}>
              Tối đa 80 bản ghi mới nhất. Toàn bộ dữ liệu nằm trong bảng <code className="text-xs">waitlist</code>.
            </p>
            <div
              className={`${role.cardQuiet} mt-4 overflow-x-auto rounded-abnb-lg border border-abnb-hairlineSoft shadow-sm`}
            >
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-abnb-hairlineSoft bg-abnb-surfaceSoft/60">
                    <th className="px-4 py-3 font-semibold text-abnb-ink">Email</th>
                    <th className="px-4 py-3 font-semibold text-abnb-ink">Tên</th>
                    <th className="px-4 py-3 font-semibold text-abnb-ink">SĐT</th>
                    <th className="px-4 py-3 font-semibold text-abnb-ink">Nguồn</th>
                    <th className="px-4 py-3 font-semibold text-abnb-ink">Thời điểm</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-abnb-muted">
                        Chưa có bản ghi waitlist.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.id} className="border-b border-abnb-hairlineSoft/80 last:border-0">
                        <td className="px-4 py-3 font-medium text-abnb-ink">{r.email}</td>
                        <td className="px-4 py-3 text-abnb-body">{r.name ?? '—'}</td>
                        <td className="px-4 py-3 text-abnb-body">{r.phone ?? '—'}</td>
                        <td className="px-4 py-3 text-abnb-muted">{r.referrer ?? '—'}</td>
                        <td className="px-4 py-3 text-abnb-muted whitespace-nowrap">{formatDt(r.created_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
