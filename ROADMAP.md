# Roadmap — Gia Phả

Cập nhật: **tháng 4/2026** (bổ sung Phase 4 feed & kết nối).

## Trạng thái hiện tại

| Giai đoạn | Mức độ | Ghi chú |
|-----------|--------|---------|
| **Phase 1** — Nền tảng DB | Hoàn thành | Migration `20260427120000_foundation.sql` |
| **Phase 2** — Auth, RLS, mã mời, storage | Hoàn thành | Migration `20260428120000_phase2_rls_storage_invite.sql` + app `/app/*` |
| **Phase 3** — Cây gia phả (thành viên, quan hệ, UI cây) | **Hoàn thành (mã nguồn)** | Cây, thế hệ, giỗ email dương/âm, gợi ý âm UI, template Auth tiếng Việt trong repo. **Cloud:** chạy migration, deploy Edge `memorial-reminders`, lịch gọi cron + secrets (Dashboard). |
| **Phase 4** — Bảng tin & kết nối | Hoàn thành (mã nguồn) | Migration `20260601120000_phase4_feed_social.sql` (posts, reactions, comments, follows, friendships, notifications, bucket `family-feed-media`, Realtime). App tab **Bảng tin** trong dòng họ, `/app/connections`, chuông thông báo. |
| **Phase 5** — Chat realtime | Hoàn thành (mã nguồn) | DM + nhóm, presence, badge đọc, thông báo trong app — xem mục Phase 5 dưới. **Cloud:** migration Phase 5 + Realtime + bucket chat. |
| **Phase 6** — Mobile (Expo) | **Đang triển khai** | `apps/mobile`: Expo SDK 54 + Expo Router, Metro monorepo + pnpm; bundle id `vn.giapha.app`. Chạy: `pnpm dev:mobile`. |

**Tóm lắc:** vận hành: áp migration Phase 4–5…; **Phase 6** xây app iOS/Android song song web; Phase 3 cloud: cron nhắc giỗ.


---

## Phase 1 — Nền tảng (đã xong)

- Bảng `profiles`, `waitlist`, `family_trees`, `family_tree_roles`
- Trigger tạo profile khi có user mới (`handle_new_user`)
- RLS cơ bản (profile của chính mình; xem dòng họ khi là thành viên/chủ)

## Phase 2 — Xác thực & dòng họ — khung (đã xong)

**Backend / Supabase**

- Cột `invite_code` (UUID), RPC `join_family_tree`, RLS (tạo/sửa dòng họ, thêm role)
- RPC `create_family_tree` (transaction: `family_trees` + role `owner`, `SECURITY DEFINER`) — migration `20260430120000_create_family_tree_rpc.sql`; policy INSERT/UPDATE chủ — thêm `20260430120100_ensure_family_trees_insert_policy.sql` nếu DB từng thiếu policy
- Bucket storage ảnh hồ sơ (theo migration)

**Web (`apps/web`)**

- Landing, shell app, `AuthProvider`, `/app/auth/callback`
- Đăng nhập: **email + mật khẩu**, **đăng ký**, magic link, **OTP điện thoại** (E.164 VN), **Google OAuth** (cần bật trên Supabase/Google Cloud)
- **Quên mật khẩu** / **đặt lại mật khẩu** (`/app/forgot-password`, `/app/reset-password`)
- **Hướng dẫn trong app:** thẻ «Làm quen GiaPhả» trên **Trang nhà** (ẩn sau khi bấm «Đã hiểu», lưu `localStorage`).
- Hồ sơ (`ProfilePage`): bố cục kiểu Facebook (**ảnh bìa** + ảnh đại diện, upload Supabase Storage `profile-media`), bio & chỉnh sửa thông tin.
- Tạo dòng họ qua RPC `create_family_tree`; danh sách / tham gia mã mời; `TreeDetailLayout` + tab **Trang chủ / Phả hệ / Thành viên** — bản tin nằm tại `/app/home` (**Trang nhà**)

## Phase 3 — Cây gia phả (**mã nguồn đã đủ**)

**Đã có** (tóm tắt; chi tiết trong migrations + `Tree*` + `FamilyTreeHierarchyChart`)

- Thành viên, quan hệ cha/mẹ / vợ chồng, biên tập viên, một dòng họ / user, liên kết node, invite email (Edge + Resend).
- Sơ đồ phả hệ (thế hệ, neo vợ/chồng, pan/zoom); **đời trong phả** `lineage_generation`; nhãn xưng hô / Lão tổ.
- Âm lịch: gợi ý từ dương trong form; nhắc giỗ email **dương hoặc âm** (`memorial_reminder_use_lunar`), Edge `memorial-reminders`, `memorial_reminder_log`.
- **Email Auth (tiếng Việt, repo):** `supabase/templates/*.html` + `config.toml` — local: `supabase start`; **cloud:** Dashboard → Authentication → Email templates (hoặc `config push` nếu có CI).

**Tiếp theo (vận hành, không nằm trong git)**

- **Supabase cloud:** áp migration còn thiếu; deploy Edge (`memorial-reminders`, …); Secrets `PUBLIC_SITE_URL`, `RESEND_*`; **Cron** POST hằng ngày tới `memorial-reminders` với JWT **service_role**.

## Phase 4 — Bảng tin & kết nối (mã nguồn)

**Đã có**

- Backend: `family_feed_posts`, `family_feed_post_media`, `family_feed_post_reactions`, `family_feed_comments`, `family_feed_follows`, `family_friend_*`, `family_notifications` + Storage `family-feed-media` + triggers thông báo.
- Web: **Trang nhà** `/app/home` có **bản tin** dòng họ (khi đã tham gia cây); chi tiết dòng họ tab Trang chủ / Phả hệ / Thành viên; **Kết nối** (`/app/connections`); chuông thông báo (Realtime trên `family_notifications`).

**Cloud:** chạy migration Phase 4; kiểm tra publication Realtime và bucket trên Dashboard nếu cần.

## Phase 5 — Chat realtime (đã xong — mã nguồn)

**Đã có**

- Backend: `family_chat_conversations` (kind DM/group, `title`), `family_chat_participants`, `family_chat_messages` + RLS + RPC `family_chat_open_dm` (friendship) + nhóm/RPC trong migration `20260806120000_family_chat_groups.sql` (điều kiện bạn bè / cùng dòng họ). Storage `family-chat-media` + policies. Thông báo tin nhắn → `family_notifications`. Publication Realtime trên `family_chat_messages` (và các bảng liên quan theo migration).
- Web: `/app/chat`, `ChatShell`, `ThreadList`, `MessageList`, `MessageComposer`; chat nổi / dock; nhóm (`ChatCreateGroupModal`, tiêu đề nhóm trong luồng); badge chưa đọc; typing + presence.

**Cloud:** áp migrations `20260801120000_phase5_chat_realtime.sql`, `20260806120000_family_chat_groups.sql` (và mọi migration RLS chat đi kèm trong repo); bật Realtime + bucket trên Dashboard. Local: `supabase start`.

## Phase 6 — Mobile (Expo / React Native)

**Tiến độ (mã nguồn)**

- `apps/mobile`: template **tabs** + **Expo Router** (stack + tab *Trang nhà* / *Dòng họ* placeholder), scheme `giapha`, `metro.config.js` + `babel.config.js` theo monorepo pnpm (`watchFolders` workspace root).
- Lệnh gốc repo: `pnpm dev:mobile` (tương đương `pnpm --filter mobile dev` → `expo start`).

**Việc tiếp (Phase 6)**

- `p6-t2` …: Supabase Auth (`@supabase/supabase-js`), port màn hình; `p6-t3` phả đồ (`react-native-svg`); push FCM/APNs; offline (theo `apps/web/src/content/devPlan.ts`).

## Sau Phase 6

- Tìm kiếm công khai, monetization — theo Phase 7 trong `devPlan.ts` (chưa làm).

---

## Tham chiếu nhanh

- Migration: `supabase/migrations/`
- App web: `apps/web/src/App.tsx`
- App mobile: `apps/mobile/app/` (Expo Router)
- Chi tiết dòng họ: `TreeDetailLayout.tsx`, tab **Trang chủ / Phả hệ / Thành viên** (`TreeOverviewPage.tsx`, `TreeChartPage.tsx`, `TreeMembersPage.tsx`); bản tin: `feed/TreeFeedPage` trên **Trang nhà** `AppHome.tsx`
- Kế hoạch chi tiết (7 phase, checkbox): `apps/web/src/pages/landing/RoadmapPage.tsx`, dữ liệu `apps/web/src/content/devPlan.ts`
