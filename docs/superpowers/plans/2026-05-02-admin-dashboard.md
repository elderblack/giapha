# Admin Dashboard — Implementation Plan

> **For agentic workers:** các bước chính đã triển khai trong repo (MVP).

**Goal:** Dashboard nội bộ trên web để xem chỉ báo tổng hợp và waitlist, chỉ user có trong `platform_admins`.

**Architecture:** Không đặt cờ admin trên `profiles` (tránh client tự nâng quyền). Bảng `platform_admins` không có policy SELECT cho `authenticated`; RPC `SECURITY DEFINER` kiểm tra membership rồi trả JSON. UI `/app/admin` + `RequirePlatformAdmin` + `usePlatformAdmin()` (RPC `is_platform_admin`).

**Tech stack:** Supabase Postgres + PostgREST RPC, React web (`apps/web`).

---

### Đã làm

- Migration `supabase/migrations/20260901120000_platform_admin_dashboard.sql`
- `apps/web/src/hooks/usePlatformAdmin.ts`, `auth/RequirePlatformAdmin.tsx`, `app/admin/*`, route `App.tsx`, nav `AppShell.tsx`
- `ROADMAP.md`, `apps/web/src/content/devPlan.ts` (phase 6b)

### Vận hành

1. Áp migration lên Supabase (local/cloud).
2. SQL Editor (quyền đủ): `INSERT INTO public.platform_admins (user_id) VALUES ('UUID-của-bạn');`
3. Đăng nhập web → mục **Quản trị** → `/app/admin`.

### Mở rộng sau

- Xuất CSV waitlist; biểu đồ theo tuần; nhật ký kiểm toán admin; tái dùng RLS đọc hạn chế thay cho mọi thứ trong một RPC.
