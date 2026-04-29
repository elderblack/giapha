import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { buildTransactionalEmail, escapeHtml, publicSiteUrlFromEnv } from '../_shared/emailLayout.ts'
import { resendFailureHintVi } from '../_shared/resendHints.ts'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

type Body = {
  token?: string
  to_email?: string
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^@\s]+\.[^\s@]+$/.test(s.trim())
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

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const raw = typeof body.token === 'string' ? body.token.trim() : ''
  const toEmail =
    typeof body.to_email === 'string' ? body.to_email.trim().toLowerCase() : ''
  if (!raw || !toEmail || !isEmail(toEmail)) {
    return new Response(JSON.stringify({ error: 'Thiếu token hoặc email không hợp lệ' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const userClient = createClient(supabaseUrl, anon, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: ures, error: uerr } = await userClient.auth.getUser()
  if (uerr || !ures.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const token_hash = await sha256Hex(raw)
  const admin = createClient(supabaseUrl, serviceKey)

  const { data: inv, error: ierr } = await admin
    .from('family_tree_member_link_invites')
    .select(`
      family_tree_id,
      member_id,
      email,
      expires_at,
      consumed_at,
      family_trees ( name ),
      family_tree_members ( full_name )
    `)
    .eq('token_hash', token_hash)
    .maybeSingle()

  if (ierr || !inv?.member_id || inv.consumed_at) {
    return new Response(JSON.stringify({ error: 'Lời mời không hợp lệ hoặc đã dùng.' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if ((inv.email as string).trim().toLowerCase() !== toEmail) {
    return new Response(JSON.stringify({ error: 'Email không khớp với lời mời.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const expire = inv.expires_at ? new Date(inv.expires_at as string).getTime() : 0
  if (!expire || expire < Date.now()) {
    return new Response(JSON.stringify({ error: 'Lời mời đã hết hạn.' }), {
      status: 410,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const uid = ures.user.id
  const treeId = inv.family_tree_id as string

  const { data: ft } = await admin.from('family_trees').select('owner_id').eq('id', treeId).maybeSingle()

  const { data: roleRow } = await admin
    .from('family_tree_roles')
    .select('role')
    .eq('family_tree_id', treeId)
    .eq('user_id', uid)
    .maybeSingle()

  const ownerId = ft?.owner_id as string | undefined | null
  const allowed = ownerId === uid || roleRow?.role === 'editor'

  if (!allowed) {
    return new Response(JSON.stringify({ error: 'Chỉ chủ hoặc biên tập viên có thể gửi email.' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const treeRows = inv.family_trees as { name?: string } | null
  const memRows = inv.family_tree_members as { full_name?: string } | null
  const treeName = treeRows?.name ?? 'Dòng họ'
  const memberName = memRows?.full_name ?? 'Thành viên'

  const siteUrl = publicSiteUrlFromEnv()
  const claimPath = `/app/claim-invite?token=${encodeURIComponent(raw)}`
  const claimUrl = `${siteUrl}${claimPath}`

  const resendKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail =
    Deno.env.get('RESEND_FROM_EMAIL') ?? 'GiaPhả <onboarding@resend.dev>'

  if (!resendKey) {
    return new Response(
      JSON.stringify({
        ok: true,
        skipped: true,
        message:
          'Chưa cấu hình RESEND_API_KEY trên Edge Function send-member-link-invite — không gửi email (không có log Resend). Sao chép liên kết trong app.',
        claim_url: claimUrl,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const innerHtml = `<p>Xin chào,</p>
<p>Bạn được mời liên kết tài khoản với <strong>${escapeHtml(memberName)}</strong> trong dòng họ <strong>${escapeHtml(treeName)}</strong> trên GiaPhả.</p>
<p>Vui lòng đăng nhập bằng <strong>chính email này</strong>, rồi nhấn nút dưới đây (hoặc sao chép liên kết từ app).</p>
<p style="font-size:14px;color:#6b7280;margin-top:16px;">Nếu bạn không mong đợi email này, hãy bỏ qua.</p>`

  const html = buildTransactionalEmail({
    title: 'Mời liên kết tài khoản',
    preheader: `${treeName} — ${memberName}`,
    innerHtml,
    primaryUrl: claimUrl,
    primaryLabel: 'Liên kết với phả hệ',
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
      to: [toEmail],
      subject: `[GiaPhả] Mời liên kết tài khoản — ${memberName}`,
      html,
    }),
  })

  const rawBody = await res.text()
  if (!res.ok) {
    console.error('Resend member invite', res.status, rawBody)
    const hint = resendFailureHintVi(res.status, rawBody)
    return new Response(
      JSON.stringify({
        error: `${hint} Sao chép liên kết trong app nếu cần.`,
        claim_url: claimUrl,
      }),
      {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }

  return new Response(JSON.stringify({ ok: true, claim_url: claimUrl }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
