import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { DateTime } from 'https://esm.sh/luxon@3.5.0'
import { buildTransactionalEmail, escapeHtml, publicSiteUrlFromEnv } from '../_shared/emailLayout.ts'
import { isLunarMemorialNotifyDay } from '../_shared/lunarAnniversary.ts'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

function decodeJwtRole(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null
  const jwt = authHeader.slice(7)
  const parts = jwt.split('.')
  if (parts.length < 2) return null
  const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
  try {
    const payload = JSON.parse(atob(b64 + pad)) as { role?: string }
    return typeof payload.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}

function vnToday(): DateTime {
  return DateTime.now().setZone('Asia/Ho_Chi_Minh').startOf('day')
}

function vnTodayIsoDate(): string {
  const d = vnToday().toISODate()
  return d ?? ''
}

/**
 * Nhắc theo kỷ niệm ngày mất dương lịch (tháng/ngày), múi giờ VN.
 * 29/2: năm không nhuận dùng 28/2.
 */
function isMemorialNotifyDay(deathDateStr: string, daysBefore: number): boolean {
  const today = vnToday()
  const death = DateTime.fromISO(deathDateStr.slice(0, 10), { zone: 'utc' })
  if (!death.isValid) return false
  let ann = DateTime.fromObject(
    { year: today.year, month: death.month, day: death.day },
    { zone: 'Asia/Ho_Chi_Minh' },
  )
  if (!ann.isValid && death.month === 2 && death.day === 29) {
    ann = DateTime.fromObject(
      { year: today.year, month: 2, day: 28 },
      { zone: 'Asia/Ho_Chi_Minh' },
    )
  }
  if (!ann.isValid) return false
  const notify = ann.minus({ days: daysBefore })
  return notify.hasSame(today, 'day')
}

type MemberRow = {
  id: string
  family_tree_id: string
  full_name: string
  death_date: string
  memorial_note: string | null
  death_lunar_text: string | null
  memorial_reminder_enabled: boolean
  memorial_reminder_days_before: number | null
  memorial_reminder_use_lunar?: boolean | null
  family_trees: { name: string } | { name: string }[] | null
}

function treeNameFromJoin(row: MemberRow): string {
  const ft = row.family_trees
  if (!ft) return 'Dòng họ'
  const one = Array.isArray(ft) ? ft[0] : ft
  return typeof one?.name === 'string' && one.name ? one.name : 'Dòng họ'
}

function normalizeRpcEmails(data: unknown): string[] {
  if (!Array.isArray(data)) return []
  if (data.every((x) => typeof x === 'string')) {
    return [...new Set(data as string[])]
  }
  const out: string[] = []
  for (const row of data) {
    if (row && typeof row === 'object' && 'app_tree_reminder_recipient_emails' in row) {
      const v = (row as { app_tree_reminder_recipient_emails?: unknown }).app_tree_reminder_recipient_emails
      if (typeof v === 'string') out.push(v)
    }
  }
  return [...new Set(out)]
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (decodeJwtRole(req.headers.get('Authorization')) !== 'service_role') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey)

  const { data: rows, error: qerr } = await admin
    .from('family_tree_members')
    .select(
      'id,family_tree_id,full_name,death_date,memorial_note,death_lunar_text,memorial_reminder_enabled,memorial_reminder_days_before,memorial_reminder_use_lunar,family_trees(name)',
    )
    .eq('memorial_reminder_enabled', true)
    .not('death_date', 'is', null)

  if (qerr) {
    console.error(qerr)
    return new Response(JSON.stringify({ error: qerr.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const list = (rows ?? []) as MemberRow[]
  const todayStr = vnTodayIsoDate()
  if (!todayStr) {
    return new Response(JSON.stringify({ error: 'Invalid date' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const todayParts = { y: vnToday().year, m: vnToday().month, d: vnToday().day }
  const due: MemberRow[] = []
  for (const r of list) {
    const n = r.memorial_reminder_days_before ?? 0
    const lunar = Boolean(r.memorial_reminder_use_lunar)
    const hit = lunar
      ? isLunarMemorialNotifyDay(r.death_date, n, todayParts)
      : isMemorialNotifyDay(r.death_date, n)
    if (hit) due.push(r)
  }

  const pending: MemberRow[] = []
  for (const row of due) {
    const { count, error: cErr } = await admin
      .from('memorial_reminder_log')
      .select('*', { count: 'exact', head: true })
      .eq('family_tree_member_id', row.id)
      .eq('remind_for_date', todayStr)
    if (cErr) {
      console.error('memorial log count', cErr)
      continue
    }
    if ((count ?? 0) === 0) pending.push(row)
  }

  type Digest = {
    treeId: string
    treeName: string
    members: MemberRow[]
  }
  const digests = new Map<string, Digest>()
  for (const row of pending) {
    const tid = row.family_tree_id
    let d = digests.get(tid)
    if (!d) {
      d = { treeId: tid, treeName: treeNameFromJoin(row), members: [] }
      digests.set(tid, d)
    }
    d.members.push(row)
  }

  const resendKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail =
    Deno.env.get('RESEND_FROM_EMAIL') ?? 'GiaPhả <onboarding@resend.dev>'
  const siteUrl = publicSiteUrlFromEnv()

  let emailsAttempted = 0
  let emailsOk = 0
  let treesLogged = 0

  if (!resendKey) {
    return new Response(
      JSON.stringify({
        ok: true,
        skipped_resend: true,
        today_vn: todayStr,
        due_count: due.length,
        pending_count: pending.length,
        message:
          'RESEND_API_KEY chưa cấu hình — không gửi email và không ghi log (sẽ chạy lại khi có API key).',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  for (const digest of digests.values()) {
    const { data: rawEmails } = await admin.rpc('app_tree_reminder_recipient_emails', {
      p_family_tree_id: digest.treeId,
    })
    const emails = normalizeRpcEmails(rawEmails)
    if (emails.length === 0) continue

    const lines = digest.members
      .map((it) => {
        let sub = ''
        const cal = it.memorial_reminder_use_lunar ? 'âm lịch' : 'dương lịch'
        sub += `<div style="font-size:14px;color:#6b7280;margin-top:4px;">Kỷ niệm nhắc: <strong>${cal}</strong> (từ ngày mất dương trong hồ sơ)</div>`
        if (it.death_lunar_text?.trim()) {
          sub += `<div style="font-size:14px;color:#6b7280;margin-top:4px;">Âm (ghi chú): ${escapeHtml(it.death_lunar_text.trim())}</div>`
        }
        if (it.memorial_note?.trim()) {
          sub += `<div style="font-size:14px;color:#6b7280;margin-top:4px;">${escapeHtml(it.memorial_note.trim())}</div>`
        }
        return `<li style="margin:0 0 12px 0;"><strong>${escapeHtml(it.full_name)}</strong>${sub}</li>`
      })
      .join('')

    const innerHtml = `<p>Hôm nay (<strong>${escapeHtml(todayStr)}</strong>, giờ Việt Nam) là ngày nhắc giỗ trong dòng họ <strong>${escapeHtml(digest.treeName)}</strong>. Mỗi người dùng ngày kỷ niệm <strong>dương</strong> hoặc <strong>âm</strong> theo cài đặt ở thẻ thành viên.</p><ul style="margin:16px 0 0 0;padding-left:20px;">${lines}</ul>`

    const treeUrl = `${siteUrl}/app/trees/${digest.treeId}`
    let anySendOk = false
    for (const to of emails) {
      emailsAttempted++
      const html = buildTransactionalEmail({
        title: 'Nhắc giỗ hôm nay',
        preheader: `${digest.treeName} — ${digest.members.length} người`,
        innerHtml,
        primaryUrl: treeUrl,
        primaryLabel: 'Mở dòng họ',
        siteUrl,
      })
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [to],
          subject: `[GiaPhả] Nhắc giỗ — ${digest.treeName}`,
          html,
        }),
      })
      if (res.ok) {
        emailsOk++
        anySendOk = true
      } else {
        console.error('Resend memorial', res.status, await res.text())
      }
    }

    if (anySendOk) {
      const logs = digest.members.map((m) => ({
        family_tree_member_id: m.id,
        remind_for_date: todayStr,
      }))
      const { error: insErr } = await admin.from('memorial_reminder_log').insert(logs)
      if (insErr) {
        console.error('memorial_reminder_log insert', insErr)
      } else {
        treesLogged++
      }
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      today_vn: todayStr,
      due_count: due.length,
      pending_new: pending.length,
      trees_with_digest: digests.size,
      emails_attempted: emailsAttempted,
      emails_ok: emailsOk,
      trees_logged: treesLogged,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
