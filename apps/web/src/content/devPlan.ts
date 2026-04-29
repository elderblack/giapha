/**
 * Kế hoạch phát triển (mục 16 — GiaPha_System_Documentation v2.0).
 * Nguồn dùng chung: landing `/roadmap` và app `dev-plan` (import alias).
 */
export type PlanTask = {
  id: string
  label: string
  /** Đã có trên repo — checkbox mặc định tích; localStorage vẫn ghi đè khi bạn bấm tay */
  shipped?: boolean
}

export type PlanPhase = {
  id: string
  title: string
  goal: string
  weekRange: string
  tasks: PlanTask[]
}

export const DEVELOPMENT_PLAN: PlanPhase[] = [
  {
    id: 'p1',
    title: 'Giai đoạn 1 — Foundation',
    weekRange: 'Tuần 1–2',
    goal: 'Landing page live + Supabase setup',
    tasks: [
      { id: 'p1-t1', label: 'Khởi tạo monorepo (pnpm workspaces)', shipped: true },
      { id: 'p1-t2', label: 'Setup Supabase: schema, RLS, auth', shipped: true },
      { id: 'p1-t3', label: 'Landing Page hoàn chỉnh + deploy', shipped: true },
      { id: 'p1-t4', label: 'Waitlist form + Edge Function gửi email', shipped: true },
      { id: 'p1-t5', label: 'Deploy lên Vercel, setup domain giapha.vn', shipped: true },
    ],
  },
  {
    id: 'p2',
    title: 'Giai đoạn 2 — Auth & Profile',
    weekRange: 'Tuần 3–5',
    goal: 'Đăng nhập + hồ sơ cơ bản',
    tasks: [
      { id: 'p2-t1', label: 'Auth: OTP email/SMS, Google OAuth', shipped: true },
      { id: 'p2-t2', label: 'Profile cá nhân (Facebook-style): ảnh bìa, bio, edit', shipped: true },
      { id: 'p2-t3', label: 'Tạo / tham gia dòng họ', shipped: true },
      { id: 'p2-t4', label: 'Product tour / hướng dẫn trong app (gợi ý nhanh Trang nhà)', shipped: true },
      { id: 'p2-t5', label: 'Upload ảnh (Supabase Storage)', shipped: true },
    ],
  },
  {
    id: 'p3',
    title: 'Giai đoạn 3 — Cây gia phả',
    weekRange: 'Tuần 6–9',
    goal: 'Core gia phả hoạt động',
    tasks: [
      { id: 'p3-t1', label: 'Render cây bằng D3.js (phân cấp + lực; pan/zoom không reset khi chọn node)', shipped: true },
      { id: 'p3-t2', label: 'CRUD members (thêm, sửa, xoá node)', shipped: true },
      { id: 'p3-t3', label: 'Quan hệ cha/mẹ-con, vợ/chồng (phân cấp: neo vợ/chồng không cha/mẹ cùng hàng đôi)', shipped: true },
      {
        id: 'p3-t4',
        label:
          'Thế hệ & vai vế: cha/mẹ + sync vợ/chồng + đời trong phả (lineage_generation, DB ft_generations); nhãn Cha/Lão tổ theo người liên kết',
        shipped: true,
      },
      { id: 'p3-t5', label: 'Luồng claim node + gửi email mời', shipped: true },
      {
        id: 'p3-t6',
        label:
          'Âm lịch + ngày giỗ: gợi ý âm từ dương trong form; nhắc email (Edge memorial-reminders) theo kỷ niệm dương hoặc âm + cron/PUBLIC_SITE_URL/Resend',
        shipped: true,
      },
    ],
  },
  {
    id: 'p4',
    title: 'Giai đoạn 4 — Mạng xã hội',
    weekRange: 'Tuần 10–13',
    goal: 'Facebook-style feed hoạt động',
    tasks: [
      { id: 'p4-t1', label: 'Đăng bài (text, ảnh, video)', shipped: true },
      { id: 'p4-t2', label: 'News Feed với thuật toán cơ bản', shipped: true },
      { id: 'p4-t3', label: 'Reactions (6 loại)', shipped: true },
      { id: 'p4-t4', label: 'Comments (nested 1 cấp)', shipped: true },
      { id: 'p4-t5', label: 'Hệ thống kết nối (gửi, chấp nhận, gợi ý)', shipped: true },
      { id: 'p4-t6', label: 'Notifications realtime', shipped: true },
    ],
  },
  {
    id: 'p5',
    title: 'Giai đoạn 5 — Chat',
    weekRange: 'Tuần 14–16',
    goal: 'Nhắn tin đầy đủ',
    tasks: [
      { id: 'p5-t1', label: 'Chat 1-1 realtime (text, ảnh)', shipped: true },
      { id: 'p5-t2', label: 'Nhóm chat: tạo tay và tự động theo nhánh' },
      { id: 'p5-t3', label: 'Typing indicator, online presence', shipped: true },
      { id: 'p5-t4', label: 'Đọc/chưa đọc, badge count', shipped: true },
      { id: 'p5-t5', label: 'Push notification cho tin nhắn', shipped: true },
    ],
  },
  {
    id: 'p6',
    title: 'Giai đoạn 6 — Mobile App',
    weekRange: 'Tuần 17–20',
    goal: 'iOS & Android',
    tasks: [
      { id: 'p6-t1', label: 'Expo setup, Expo Router' },
      { id: 'p6-t2', label: 'Port tất cả màn hình sang React Native' },
      { id: 'p6-t3', label: 'Cây gia phả mobile (react-native-svg)' },
      { id: 'p6-t4', label: 'Push notifications (FCM + APNs)' },
      { id: 'p6-t5', label: 'Offline mode' },
      { id: 'p6-t6', label: 'Submit App Store & Google Play' },
    ],
  },
  {
    id: 'p7',
    title: 'Giai đoạn 7 — Monetisation',
    weekRange: 'Tuần 21–24',
    goal: 'Ra mắt freemium',
    tasks: [
      { id: 'p7-t1', label: 'Stripe + VNPay integration' },
      { id: 'p7-t2', label: 'Enforce giới hạn Free tier' },
      { id: 'p7-t3', label: 'Tính năng Pro: xuất PDF, nhóm tự động' },
      { id: 'p7-t4', label: 'Tính năng Enterprise: phân quyền nâng cao' },
      { id: 'p7-t5', label: 'Analytics, A/B testing' },
    ],
  },
]

/** Tiến độ mặc định: các mục có `shipped: true` trong DEVELOPMENT_PLAN */
export function buildShippedDefaults(): Record<string, boolean> {
  const m: Record<string, boolean> = {}
  for (const p of DEVELOPMENT_PLAN) {
    for (const t of p.tasks) {
      if (t.shipped) m[t.id] = true
    }
  }
  return m
}

export const PLAN_PROGRESS_STORAGE_KEY = 'giapha-dev-plan-completed-v2'
const PLAN_PROGRESS_LEGACY_STORAGE_KEY = 'giapha-dev-plan-completed-v1'

/** Gộp mặc định shipped + ghi đè từ localStorage (v2; đọc thêm v1 nếu chưa có v2). */
export function loadPlanProgress(): Record<string, boolean> {
  const shipped = buildShippedDefaults()
  if (typeof localStorage === 'undefined') return { ...shipped }
  try {
    const raw = localStorage.getItem(PLAN_PROGRESS_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, boolean>
      if (parsed && typeof parsed === 'object') return { ...shipped, ...parsed }
    }
    const legacy = localStorage.getItem(PLAN_PROGRESS_LEGACY_STORAGE_KEY)
    if (legacy) {
      const parsed = JSON.parse(legacy) as Record<string, boolean>
      if (parsed && typeof parsed === 'object') return { ...shipped, ...parsed }
    }
  } catch {
    /* ignore */
  }
  return { ...shipped }
}

export function savePlanProgress(map: Record<string, boolean>) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(PLAN_PROGRESS_STORAGE_KEY, JSON.stringify(map))
}

export function getAllTaskIds(): string[] {
  return DEVELOPMENT_PLAN.flatMap((p) => p.tasks.map((t) => t.id))
}

export function countTasks(): { total: number; phases: number } {
  return {
    total: getAllTaskIds().length,
    phases: DEVELOPMENT_PLAN.length,
  }
}
