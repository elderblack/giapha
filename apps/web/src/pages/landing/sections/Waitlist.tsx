import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod/v3'
import { role } from '../../../design/roles'
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase'

const schema = z.object({
  name: z.string().max(120),
  email: z.string().email('Email không hợp lệ'),
  phone: z.string().max(30),
  consent: z
    .boolean()
    .refine((v) => v, { message: 'Vui lòng đồng ý nhận thông tin' }),
})

type FormValues = z.infer<typeof schema>

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string }

const bullets = [
  'Ưu tiên mở beta & roadmap sản phẩm',
  'Không spam — chỉ tin ra mắt và ưu đãi có giá trị',
  'Huỷ đăng ký bất cứ lúc nào',
]

export function Waitlist() {
  const [state, setState] = useState<SubmitState>({ kind: 'idle' })
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      consent: false,
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    if (!isSupabaseConfigured() || !getSupabase()) {
      setState({
        kind: 'error',
        message: 'Biểu mẫu tạm thời chưa khả dụng. Vui lòng thử lại sau.',
      })
      return
    }

    setState({ kind: 'loading' })
    const referrer =
      typeof document !== 'undefined' ? document.referrer || undefined : undefined
    const { data, error } = await getSupabase()!.functions.invoke(
      'waitlist-join',
      {
        body: {
          email: values.email,
          name: values.name || undefined,
          phone: values.phone || undefined,
          referrer: referrer,
        },
      },
    )

    if (error) {
      setState({
        kind: 'error',
        message: error.message ?? 'Không gửi được. Kiểm tra mạng hoặc Edge Function.',
      })
      return
    }

    const body = data as { ok?: boolean; message?: string; duplicate?: boolean } | null
    if (body?.ok) {
      setState({
        kind: 'success',
        message: body.message ?? 'Đã ghi nhận. Cảm ơn bạn đã quan tâm!',
      })
      reset({ name: '', email: '', phone: '', consent: false } as FormValues)
      return
    }

    setState({
      kind: 'error',
      message: (data as { error?: string })?.error ?? 'Có lỗi từ máy chủ',
    })
  })

  return (
    <section id="waitlist" className="relative overflow-hidden bg-abnb-canvas">
      <div className="pointer-events-none absolute inset-0 bg-hero-radial opacity-70" aria-hidden />
      <div className="lp-container relative lp-section">
        <div className="grid items-start gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5 lg:pt-4">
            <p className={`${role.kicker} mb-5`}>Early access</p>
            <h2 className={`${role.headingSection} max-w-[18ch]`}>Đăng ký để không bỏ lỡ</h2>
            <p className={`${role.bodyMd} mt-6 max-w-md text-pretty`}>
              GiaPhả đang hoàn thiện. Để lại email — chúng tôi chỉ gửi những cập nhật thật sự hữu
              ích.
            </p>
            <ul className="mt-8 space-y-3">
              {bullets.map((b) => (
                <li key={b} className="flex gap-3 text-[15px] leading-snug text-abnb-body">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-abnb-primary/12 text-abnb-primary">
                    <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-6 lg:col-start-7">
            <form
              onSubmit={onSubmit}
              className={`${role.card} space-y-5 rounded-abnb-xl !border-abnb-hairlineSoft p-6 !shadow-abnb-lg sm:p-8`}
              noValidate
            >
              <div>
                <label htmlFor="wl-name" className={`${role.caption} text-abnb-body`}>
                  Tên <span className="font-normal text-abnb-muted">(tuỳ chọn)</span>
                </label>
                <input
                  id="wl-name"
                  type="text"
                  autoComplete="name"
                  className={`${role.input} mt-2 ${errors.name ? role.inputError : ''}`}
                  placeholder="Nguyễn Văn A"
                  {...register('name')}
                />
                {errors.name && (
                  <p className="mt-1.5 text-sm text-abnb-error" role="alert">
                    {errors.name.message}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="wl-email" className={`${role.caption} text-abnb-body`}>
                  Email <span className="text-abnb-error">*</span>
                </label>
                <input
                  id="wl-email"
                  type="email"
                  autoComplete="email"
                  className={`${role.input} mt-2 ${errors.email ? role.inputError : ''}`}
                  placeholder="ban@email.com"
                  {...register('email')}
                />
                {errors.email && (
                  <p className="mt-1.5 text-sm text-abnb-error" role="alert">
                    {errors.email.message}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="wl-phone" className={`${role.caption} text-abnb-body`}>
                  Điện thoại <span className="font-normal text-abnb-muted">(tuỳ chọn)</span>
                </label>
                <input
                  id="wl-phone"
                  type="tel"
                  autoComplete="tel"
                  className={`${role.input} mt-2`}
                  placeholder="09xx"
                  {...register('phone')}
                />
              </div>
              <label className="flex items-start gap-3 rounded-abnb-md bg-abnb-surfaceSoft/80 p-3">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-abnb-hairline text-abnb-primary focus:ring-abnb-ink/20"
                  {...register('consent')}
                />
                <span className={`${role.bodySm} text-[15px] leading-snug`}>
                  Tôi đồng ý nhận email từ GiaPhả (có thể huỷ sau).
                </span>
              </label>
              {errors.consent && (
                <p className="text-sm text-abnb-error" role="alert">
                  {errors.consent.message}
                </p>
              )}

              <button
                type="submit"
                disabled={state.kind === 'loading'}
                className={`${role.btnPrimary} w-full justify-center !rounded-full disabled:translate-y-0 disabled:shadow-sm`}
              >
                {state.kind === 'loading' ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang gửi…
                  </span>
                ) : (
                  'Gửi đăng ký'
                )}
              </button>

              {state.kind === 'success' && (
                <p className="text-center text-[15px] font-medium text-abnb-ink" role="status">
                  {state.message}
                </p>
              )}
              {state.kind === 'error' && (
                <p className="text-center text-sm text-abnb-error" role="alert">
                  {state.message}
                </p>
              )}
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}
