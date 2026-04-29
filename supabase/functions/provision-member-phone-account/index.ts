import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

/** Chuẩn hoá SĐT VN → E.164 (+84...) — khớp apps/web/src/lib/phoneE164.ts */
function normalizeVnPhoneToE164(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  if (t.startsWith('+')) {
    if (!t.startsWith('+84')) return null
    const rest = t.slice(3).replace(/\D/g, '')
    if (rest.length < 9 || rest.length > 10) return null
    return `+84${rest}`
  }
  const digits = t.replace(/\D/g, '')
  if (digits.startsWith('84') && digits.length >= 11 && digits.length <= 12) return `+${digits}`
  if (digits.startsWith('0') && digits.length === 10) return `+84${digits.slice(1)}`
  if (digits.length === 9) return `+84${digits}`
  return null
}

type Body = { member_id?: string }

function memberPhoneMissingErr(msg: string): boolean {
  const m = msg.toLowerCase()
  return (
    m.includes('family_tree_members.phone') ||
    (m.includes('column') && m.includes('phone') && m.includes('does not exist'))
  )
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

  const memberId = typeof body.member_id === 'string' ? body.member_id.trim() : ''
  if (!memberId) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_member_id' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const defaultPassword =
    Deno.env.get('MEMBER_DEFAULT_ACCOUNT_PASSWORD')?.trim() || '123456'

  const userClient = createClient(supabaseUrl, anon, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: ures, error: uerr } = await userClient.auth.getUser()
  if (uerr || !ures.user?.id) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const editorId = ures.user.id
  const admin = createClient(supabaseUrl, serviceKey)

  let memRes = await admin
    .from('family_tree_members')
    .select('id, family_tree_id, full_name, phone, linked_profile_id')
    .eq('id', memberId)
    .maybeSingle()

  if (memRes.error && memberPhoneMissingErr(memRes.error.message ?? '')) {
    memRes = await admin
      .from('family_tree_members')
      .select('id, family_tree_id, full_name, linked_profile_id')
      .eq('id', memberId)
      .maybeSingle()
  }

  const { data: mem, error: merr } = memRes

  if (merr || !mem?.family_tree_id) {
    return new Response(JSON.stringify({ ok: false, error: 'not_found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const treeId = mem.family_tree_id as string
  if (mem.linked_profile_id) {
    return new Response(JSON.stringify({ ok: false, error: 'already_linked' }), {
      status: 409,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: ft } = await admin.from('family_trees').select('owner_id').eq('id', treeId).maybeSingle()
  const ownerId = ft?.owner_id as string | undefined | null
  const { data: roleRow } = await admin
    .from('family_tree_roles')
    .select('role')
    .eq('family_tree_id', treeId)
    .eq('user_id', editorId)
    .maybeSingle()

  const allowed =
    ownerId === editorId ||
    roleRow?.role === 'editor'

  if (!allowed) {
    return new Response(JSON.stringify({ ok: false, error: 'forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const rawPhone = typeof mem.phone === 'string' ? mem.phone : ''
  const e164 = normalizeVnPhoneToE164(rawPhone)
  if (!e164) {
    return new Response(
      JSON.stringify({ ok: true, skipped: true, reason: 'no_phone' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  async function linkProfileToMember(profileId: string): Promise<Response | null> {
    const { data: dup } = await admin
      .from('family_tree_members')
      .select('id')
      .eq('family_tree_id', treeId)
      .eq('linked_profile_id', profileId)
      .neq('id', memberId)
      .maybeSingle()

    if (dup?.id) {
      return new Response(JSON.stringify({ ok: false, error: 'phone_user_linked_other_node' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: otherTrees } = await admin
      .from('family_tree_roles')
      .select('family_tree_id')
      .eq('user_id', profileId)

    const blocked = (otherTrees ?? []).some(
      (r: { family_tree_id: string }) => r.family_tree_id !== treeId,
    )
    if (blocked) {
      return new Response(JSON.stringify({ ok: false, error: 'already_in_another_tree' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: existingRole } = await admin
      .from('family_tree_roles')
      .select('role')
      .eq('family_tree_id', treeId)
      .eq('user_id', profileId)
      .maybeSingle()

    if (!existingRole) {
      const ins = await admin.from('family_tree_roles').insert({
        family_tree_id: treeId,
        user_id: profileId,
        role: 'member',
      })
      if (
        ins.error &&
        ins.error.code !== '23505' &&
        !(`${ins.error.message ?? ''}`.includes('duplicate'))
      ) {
        console.error('provision-member-phone-account insert role', ins.error)
        return new Response(JSON.stringify({ ok: false, error: 'role_insert_failed' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    await admin
      .from('family_tree_members')
      .update({ linked_profile_id: profileId })
      .eq('id', memberId)

    await admin
      .from('profiles')
      .update({ phone: e164, full_name: mem.full_name as string })
      .eq('id', profileId)

    return null
  }

  const { data: existingUid, error: lookupErr } = await admin.rpc('auth_user_id_by_phone', {
    p_phone: e164,
  })

  if (!lookupErr && existingUid && typeof existingUid === 'string') {
    const early = await linkProfileToMember(existingUid)
    if (early) return early
    return new Response(
      JSON.stringify({
        ok: true,
        family_tree_id: treeId,
        linked_existing: true,
        profile_id: existingUid,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const fullName = (mem.full_name as string)?.trim() || 'Thành viên'
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    phone: e164,
    password: defaultPassword,
    phone_confirm: true,
    user_metadata: { full_name: fullName, name: fullName },
  })

  if (cErr || !created.user?.id) {
    const msg = (cErr?.message ?? '').toLowerCase()
    if (
      msg.includes('already') ||
      msg.includes('registered') ||
      msg.includes('exists')
    ) {
      const { data: uid2 } = await admin.rpc('auth_user_id_by_phone', { p_phone: e164 })
      if (uid2 && typeof uid2 === 'string') {
        const early = await linkProfileToMember(uid2)
        if (early) return early
        return new Response(
          JSON.stringify({
            ok: true,
            family_tree_id: treeId,
            linked_existing: true,
            profile_id: uid2,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
    }
    console.error('provision-member-phone-account createUser', cErr)
    return new Response(JSON.stringify({ ok: false, error: 'create_failed' }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const newId = created.user.id
  const linkErr = await linkProfileToMember(newId)
  if (linkErr) return linkErr

  return new Response(
    JSON.stringify({
      ok: true,
      family_tree_id: treeId,
      linked_existing: false,
      profile_id: newId,
      default_password_hint: true,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
