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
  email?: string
  name?: string
  phone?: string
  referrer?: string
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
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

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const email = body.email?.trim().toLowerCase()
  if (!email || !isValidEmail(email)) {
    return new Response(JSON.stringify({ error: 'Email không hợp lệ' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const name = body.name?.trim() || null
  const phone = body.phone?.trim() || null
  const referrer = body.referrer?.trim() || null

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey)

  const { error: insertError } = await admin.from('waitlist').insert({
    email,
    name,
    phone,
    referrer,
  })

  if (insertError) {
    if (insertError.code === '23505') {
      return new Response(
        JSON.stringify({
          ok: true,
          message: 'Email này đã đăng ký trước đó.',
          duplicate: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    console.error(insertError)
    return new Response(
      JSON.stringify({ error: 'Không thể lưu đăng ký. Thử lại sau.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const resendKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail =
    Deno.env.get('RESEND_FROM_EMAIL') ?? 'GiaPhả <onboarding@resend.dev>'

  let emailNotice: string | undefined

  if (!resendKey) {
    emailNotice =
      'Chưa cấu hình RESEND_API_KEY cho Edge Function waitlist-join — không gửi email (không có log trên Resend).'
  } else {
    const siteUrl = publicSiteUrlFromEnv()
    const safeName = escapeHtml(name ?? 'bạn')
    const innerHtml = `<p>Xin chào ${safeName},</p>
<p>Cảm ơn bạn đã đăng ký nhận thông tin sớm về <strong>GiaPhả</strong> — mạng xã hội dòng họ và cây gia phả.</p>
<p>Chúng tôi sẽ gửi tin khi có bản thử hoặc ra mắt chính thức.</p>`
    const html = buildTransactionalEmail({
      title: 'Đã nhận đăng ký sớm',
      preheader: 'GiaPhả — cảm ơn bạn đã quan tâm',
      innerHtml,
      primaryUrl: siteUrl,
      primaryLabel: 'Về trang chủ GiaPhả',
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
        to: [email],
        subject: 'Cảm ơn bạn đã quan tâm GiaPhả',
        html,
      }),
    })
    const rawBody = await res.text()
    if (!res.ok) {
      console.error('Resend waitlist', res.status, rawBody)
      emailNotice = resendFailureHintVi(res.status, rawBody)
    }
  }

  if (emailNotice) {
    console.warn('[waitlist-join] email not sent:', emailNotice)
  }

  return new Response(JSON.stringify({ ok: true, message: 'Đăng ký thành công' }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
