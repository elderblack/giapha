# 🌳 Hệ Thống GIA PHẢ — Tài Liệu Hệ Thống v2.0

> **Định vị sản phẩm:** Mạng xã hội dòng họ — kết hợp Facebook (profile, bảng tin, chat) + Cây gia phả trực quan  
> **Phiên bản:** 2.0.0  
> **Ngôn ngữ:** Tiếng Việt — tập trung người dùng Việt Nam

---

## Mục Lục

1. [Tổng Quan & Định Vị Sản Phẩm](#1-tổng-quan--định-vị-sản-phẩm)
2. [Kiến Trúc Hệ Thống](#2-kiến-trúc-hệ-thống)
3. [Tech Stack](#3-tech-stack)
4. [Cấu Trúc Thư Mục](#4-cấu-trúc-thư-mục)
5. [Database Schema](#5-database-schema)
6. [Authentication & Phân Quyền](#6-authentication--phân-quyền)
7. [Tính Năng — Mạng Xã Hội](#7-tính-năng--mạng-xã-hội)
8. [Tính Năng — Cây Gia Phả](#8-tính-năng--cây-gia-phả)
9. [Tính Năng — Nhắn Tin & Nhóm Chat](#9-tính-năng--nhắn-tin--nhóm-chat)
10. [Tính Năng — Liên Kết Thành Viên](#10-tính-năng--liên-kết-thành-viên)
11. [Landing Page](#11-landing-page)
12. [Mobile App](#12-mobile-app)
13. [Mô Hình Freemium](#13-mô-hình-freemium)
14. [Đặc Thù Văn Hoá Việt Nam](#14-đặc-thù-văn-hoá-việt-nam)
15. [API & Realtime Design](#15-api--realtime-design)
16. [Kế Hoạch Phát Triển](#16-kế-hoạch-phát-triển)
17. [Môi Trường & Deploy](#17-môi-trường--deploy)

---

## 1. Tổng Quan & Định Vị Sản Phẩm

### 1.1 Tầm Nhìn

**GiaPhả** = **Facebook** (profile, bảng tin, chat, nhóm) **+ Cây Gia Phả** (trực quan, thế hệ, vai vế)

Hai trụ cột này **ngang bằng nhau** — không cái nào phụ cái nào. Người dùng có thể chỉ dùng MXH mà không quan tâm cây, hoặc ngược lại — nhưng khi kết hợp, trải nghiệm trở nên độc đáo và sâu sắc hơn bất kỳ mạng xã hội nào khác.

### 1.2 Điểm Khác Biệt So Với Facebook/Zalo

| | Facebook | Zalo | **GiaPhả** |
|--|---------|------|------------|
| Kết nối | Bạn bè | Danh bạ | **Quan hệ huyết thống** |
| Nhóm | Tự tạo | Tự tạo | **Tự động theo nhánh dòng họ** |
| Profile | Cá nhân | Cá nhân | **Cá nhân + Vị trí trong cây** |
| Nội dung | Mọi thứ | Mọi thứ | **Ký ức gia đình, lịch sử dòng họ** |
| Bối cảnh | Công khai | Riêng tư | **Khép kín trong dòng họ** |

### 1.3 Người Dùng & Vai Trò

| Vai trò | Quyền hạn |
|---------|-----------|
| **Chủ dòng họ (Owner)** | Toàn quyền, cài đặt dòng họ, xoá thành viên |
| **Quản trị (Admin)** | Duyệt thành viên, quản lý nội dung |
| **Thành viên (Member)** | Đăng bài, chat, xem cây, claim node |
| **Khách (Guest)** | Xem profile công khai (nếu được cho phép) |

### 1.4 Nền Tảng

- 🌐 **Landing Page** — Marketing, thu thập early access (cùng repo React)
- 💻 **Web App** — Ứng dụng đầy đủ trên trình duyệt
- 📱 **Mobile App** — iOS & Android (Expo / React Native)

---

## 2. Kiến Trúc Hệ Thống

```
┌──────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                              │
│                                                                    │
│   🌐 Landing (React/Vite)    💻 Web App        📱 Mobile (Expo)  │
│   route: "/"                 route: "/app/*"    iOS / Android     │
│                                                                    │
│   ─────────────────── Shared Packages ──────────────────────────  │
│   @giаpha/ui  │  @giаpha/hooks  │  @giаpha/utils  │  @giаpha/types│
└────────────────────────────┬─────────────────────────────────────┘
                             │  Supabase JS Client (SDK)
                             │  WebSocket (Realtime)
┌────────────────────────────▼─────────────────────────────────────┐
│                        SUPABASE LAYER                             │
│                                                                    │
│  ┌───────────┐  ┌──────────────┐  ┌───────────┐  ┌───────────┐  │
│  │PostgreSQL │  │  Auth        │  │  Storage  │  │ Realtime  │  │
│  │           │  │  OTP Email   │  │  Avatars  │  │ Chat      │  │
│  │  + RLS    │  │  OTP SMS     │  │  Posts    │  │ Notif     │  │
│  │  Policies │  │  Google      │  │  Media    │  │ Presence  │  │
│  └───────────┘  └──────────────┘  └───────────┘  └───────────┘  │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Edge Functions (Deno)                     │ │
│  │  send-invite  │  notify-anniversary  │  auto-create-groups  │ │
│  │  calc-kinship │  export-pdf          │  send-email (Resend) │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Tech Stack

### 3.1 Frontend Web

| Thành phần | Công nghệ | Ghi chú |
|------------|-----------|---------|
| Framework | **React 18 + Vite** | Fast HMR, build nhanh |
| Routing | **React Router v6** | SPA, nested routes |
| State Management | **Zustand** | Nhẹ, đơn giản |
| Server State | **TanStack Query v5** | Cache, sync Supabase |
| UI Components | **shadcn/ui** | Headless, tuỳ chỉnh cao |
| Styling | **Tailwind CSS v3** | Utility-first |
| Cây gia phả | **D3.js + React** | SVG rendering |
| Chat UI | **Custom + Supabase Realtime** | WebSocket |
| Form | **React Hook Form + Zod** | Validation |
| Rich Text | **Tiptap** | Editor bài đăng |
| i18n | **react-i18next** | VI mặc định |
| Icons | **Lucide React** | Nhất quán |

### 3.2 Mobile (React Native)

| Thành phần | Công nghệ |
|------------|-----------|
| Framework | **Expo SDK 51+** |
| Navigation | **Expo Router (file-based)** |
| UI | **NativeWind v4** (Tailwind cho RN) |
| Cây gia phả | **react-native-svg + D3** |
| Chat | **Supabase Realtime** |
| Push Notif | **Expo Notifications + FCM/APNs** |
| Camera/Media | **Expo Image Picker** |
| Offline | **MMKV + React Query persistence** |

### 3.3 Backend

| Thành phần | Công nghệ |
|------------|-----------|
| Database | **Supabase (PostgreSQL 15)** |
| Auth | **Supabase Auth** |
| Realtime | **Supabase Realtime (WebSocket)** |
| Storage | **Supabase Storage** |
| Functions | **Supabase Edge Functions (Deno)** |
| Email | **Resend** |
| Payments | **Stripe + VNPay/MoMo** |

### 3.4 Infrastructure

| Thành phần | Công nghệ |
|------------|-----------|
| Deploy Web | **Vercel** |
| Deploy Mobile | **Expo EAS Build** |
| CI/CD | **GitHub Actions** |
| Monitoring | **Sentry** |
| Analytics | **PostHog** |
| Domain | **giаpha.vn** |

---

## 4. Cấu Trúc Thư Mục

```
giаpha/                              ← Monorepo root
├── apps/
│   ├── web/                         ← React Web App
│   │   ├── public/
│   │   └── src/
│   │       ├── pages/
│   │       │   ├── landing/         ← Marketing (route "/")
│   │       │   │   ├── LandingPage.tsx
│   │       │   │   ├── sections/
│   │       │   │   │   ├── Hero.tsx
│   │       │   │   │   ├── Features.tsx
│   │       │   │   │   ├── HowItWorks.tsx
│   │       │   │   │   ├── Pricing.tsx
│   │       │   │   │   ├── Testimonials.tsx
│   │       │   │   │   └── Waitlist.tsx
│   │       │   │   └── LandingLayout.tsx
│   │       │   │
│   │       │   ├── auth/            ← Authentication
│   │       │   │   ├── Login.tsx
│   │       │   │   ├── Register.tsx
│   │       │   │   └── OtpVerify.tsx
│   │       │   │
│   │       │   └── app/             ← Main App (route "/app")
│   │       │       ├── feed/        ← Bảng tin (News Feed)
│   │       │       │   └── FeedPage.tsx
│   │       │       ├── profile/     ← Profile cá nhân
│   │       │       │   ├── ProfilePage.tsx
│   │       │       │   └── EditProfile.tsx
│   │       │       ├── tree/        ← Cây gia phả
│   │       │       │   ├── TreePage.tsx
│   │       │       │   └── MemberDetail.tsx
│   │       │       ├── messages/    ← Nhắn tin 1-1
│   │       │       │   ├── InboxPage.tsx
│   │       │       │   └── ConversationPage.tsx
│   │       │       ├── groups/      ← Nhóm chat
│   │       │       │   ├── GroupsPage.tsx
│   │       │       │   └── GroupChatPage.tsx
│   │       │       ├── members/     ← Danh sách thành viên
│   │       │       │   └── MembersPage.tsx
│   │       │       ├── notifications/
│   │       │       │   └── NotificationsPage.tsx
│   │       │       └── settings/
│   │       │           └── SettingsPage.tsx
│   │       │
│   │       ├── components/
│   │       │   ├── feed/
│   │       │   │   ├── PostCard.tsx        ← Card bài đăng
│   │       │   │   ├── PostComposer.tsx    ← Soạn bài mới
│   │       │   │   ├── StoryBar.tsx        ← Story (tuỳ chọn)
│   │       │   │   └── ReactionBar.tsx     ← Like, tim, haha...
│   │       │   ├── profile/
│   │       │   │   ├── ProfileHeader.tsx   ← Ảnh bìa + avatar
│   │       │   │   ├── ProfileTimeline.tsx ← Timeline bài đăng
│   │       │   │   └── ProfileInfo.tsx     ← Thông tin cá nhân
│   │       │   ├── tree/
│   │       │   │   ├── TreeCanvas.tsx      ← D3 SVG canvas
│   │       │   │   ├── MemberNode.tsx      ← Node trong cây
│   │       │   │   ├── TreeControls.tsx    ← Zoom, layout
│   │       │   │   └── AddMemberModal.tsx
│   │       │   ├── chat/
│   │       │   │   ├── MessageBubble.tsx
│   │       │   │   ├── ChatInput.tsx
│   │       │   │   ├── ConversationList.tsx
│   │       │   │   └── GroupHeader.tsx
│   │       │   ├── layout/
│   │       │   │   ├── AppLayout.tsx       ← Sidebar + Header
│   │       │   │   ├── Sidebar.tsx
│   │       │   │   └── TopNav.tsx
│   │       │   └── ui/                     ← shadcn/ui components
│   │       │
│   │       ├── hooks/
│   │       │   ├── useAuth.ts
│   │       │   ├── useFeed.ts
│   │       │   ├── useProfile.ts
│   │       │   ├── useFamilyTree.ts
│   │       │   ├── useMessages.ts
│   │       │   ├── useGroups.ts
│   │       │   └── useNotifications.ts
│   │       │
│   │       ├── lib/
│   │       │   ├── supabase.ts             ← Supabase client
│   │       │   └── queryClient.ts          ← TanStack Query config
│   │       │
│   │       └── store/
│   │           ├── authStore.ts
│   │           ├── chatStore.ts            ← Active conversations
│   │           └── notifStore.ts
│   │
│   └── mobile/                      ← Expo React Native
│       └── app/
│           ├── (auth)/
│           │   ├── login.tsx
│           │   └── otp.tsx
│           └── (tabs)/
│               ├── index.tsx         ← Feed
│               ├── tree.tsx          ← Cây gia phả
│               ├── messages.tsx      ← Chat
│               ├── members.tsx       ← Thành viên
│               └── profile.tsx       ← Hồ sơ
│
├── packages/
│   ├── shared/                       ← Dùng chung web + mobile
│   │   ├── types/
│   │   │   ├── user.ts
│   │   │   ├── post.ts
│   │   │   ├── member.ts
│   │   │   ├── message.ts
│   │   │   └── tree.ts
│   │   └── utils/
│   │       ├── kinship.ts            ← Tính vai vế Việt Nam
│   │       ├── lunar.ts              ← Âm lịch
│   │       └── formatters.ts        ← Format ngày, tên...
│   │
│   └── supabase/                     ← DB config
│       ├── migrations/
│       ├── seed/
│       └── functions/
│           ├── send-invite-email/
│           ├── notify-anniversary/
│           ├── auto-create-branch-group/
│           └── export-pdf/
│
└── package.json                      ← pnpm workspaces
```

---

## 5. Database Schema

### 5.1 Sơ Đồ Tổng Quan

```
auth.users
    │
    └── profiles              ← hồ sơ Facebook-style (ảnh bìa, bio, timeline)
            │
            ├── posts         ← bài đăng trên timeline / bảng tin
            │     └── comments, reactions
            │
            ├── friendships   ← kết bạn / theo dõi trong dòng họ
            │
            └── family_tree_members  ← link với node trong cây

family_trees
    └── members               ← node trong cây gia phả
            └── relationships ← cha/mẹ-con, vợ/chồng

conversations                 ← 1-1 và nhóm chat
    ├── conversation_members
    └── messages              ← tin nhắn realtime

groups                        ← nhóm cộng đồng (tự tạo hoặc tự động theo nhánh)
    ├── group_members
    └── group_posts

notifications
waitlist
```

### 5.2 Chi Tiết Các Bảng

#### `profiles` — Hồ Sơ Facebook-Style
```sql
CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Thông tin hiển thị
  full_name       TEXT NOT NULL,
  username        TEXT UNIQUE,              -- @nguyenvana (tuỳ chọn)
  avatar_url      TEXT,
  cover_url       TEXT,                     -- Ảnh bìa (như Facebook)
  bio             TEXT,                     -- Giới thiệu ngắn

  -- Thông tin cá nhân
  date_of_birth   DATE,
  gender          TEXT,                     -- 'male' | 'female' | 'other'
  hometown        TEXT,                     -- Quê quán
  current_city    TEXT,                     -- Nơi ở hiện tại
  occupation      TEXT,
  phone           TEXT,

  -- Cài đặt riêng tư
  profile_privacy TEXT DEFAULT 'family',   -- 'public' | 'family' | 'private'
  dob_privacy     TEXT DEFAULT 'family',

  -- Gói dịch vụ
  plan            TEXT DEFAULT 'free',      -- 'free' | 'pro' | 'enterprise'
  plan_expires_at TIMESTAMPTZ,

  -- Link với cây gia phả
  member_id       UUID,                     -- Node trong cây đã claim

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

#### `posts` — Bài Đăng (Timeline + News Feed)
```sql
CREATE TABLE posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       UUID REFERENCES profiles(id) ON DELETE CASCADE,

  -- Nội dung
  content         TEXT,
  media_urls      TEXT[],                   -- Mảng ảnh/video URLs
  link_preview    JSONB,                    -- { url, title, image, description }

  -- Loại bài
  post_type       TEXT DEFAULT 'normal',
  -- 'normal'     → Bài thường
  -- 'memorial'   → Tưởng nhớ người đã mất
  -- 'milestone'  → Cột mốc: đám cưới, sinh con...
  -- 'anniversary'→ Nhắc ngày giỗ, sinh nhật
  -- 'share'      → Chia sẻ lại bài khác

  -- Phạm vi hiển thị
  visibility      TEXT DEFAULT 'family',
  -- 'public'  → Ai cũng xem được
  -- 'family'  → Chỉ thành viên dòng họ
  -- 'private' → Chỉ mình

  -- Bài được đăng trong nhóm (nếu có)
  group_id        UUID REFERENCES groups(id),

  -- Chia sẻ bài gốc
  shared_post_id  UUID REFERENCES posts(id),

  -- Tag thành viên
  tagged_members  UUID[],                   -- Mảng profile IDs

  -- Thống kê (denormalized để query nhanh)
  reactions_count JSONB DEFAULT '{}',       -- { "like": 5, "love": 3, ... }
  comments_count  INTEGER DEFAULT 0,
  shares_count    INTEGER DEFAULT 0,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

#### `comments` — Bình Luận
```sql
CREATE TABLE comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID REFERENCES posts(id) ON DELETE CASCADE,
  author_id   UUID REFERENCES profiles(id),
  parent_id   UUID REFERENCES comments(id),   -- Reply comment
  content     TEXT NOT NULL,
  media_url   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

#### `reactions` — Cảm Xúc
```sql
CREATE TABLE reactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES profiles(id),
  type        TEXT NOT NULL,
  -- 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry'
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (post_id, user_id)
);
```

#### `family_trees` — Dòng Họ
```sql
CREATE TABLE family_trees (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,              -- "Họ Nguyễn - Bắc Ninh"
  clan_name     TEXT,                       -- "Nguyễn"
  origin_place  TEXT,
  description   TEXT,
  cover_url     TEXT,
  is_public     BOOLEAN DEFAULT FALSE,
  owner_id      UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

#### `members` — Node Trong Cây Gia Phả
```sql
CREATE TABLE members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_tree_id  UUID REFERENCES family_trees(id) ON DELETE CASCADE,

  -- Thông tin cơ bản
  full_name       TEXT NOT NULL,
  birth_name      TEXT,
  alias           TEXT,                     -- Tên thường gọi
  chinese_name    TEXT,                     -- Tên chữ Hán
  gender          TEXT,

  -- Ngày tháng (dương + âm lịch)
  dob_solar       DATE,
  dob_lunar       TEXT,                     -- "15/7/Giáp Thìn"
  dod_solar       DATE,
  dod_lunar       TEXT,                     -- Dùng để tính ngày giỗ
  is_alive        BOOLEAN DEFAULT TRUE,

  -- Địa lý
  birth_place     TEXT,
  hometown        TEXT,
  burial_place    TEXT,

  -- Thế hệ
  generation      INTEGER,                  -- Đời thứ (tự tính)

  -- Thông tin thêm
  occupation      TEXT,
  bio             TEXT,
  avatar_url      TEXT,

  -- Liên kết tài khoản (claim)
  claimed_by      UUID REFERENCES profiles(id),
  invited_email   TEXT,

  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

#### `relationships` — Quan Hệ Trong Cây
```sql
CREATE TABLE relationships (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_tree_id  UUID REFERENCES family_trees(id) ON DELETE CASCADE,
  member_a_id     UUID REFERENCES members(id) ON DELETE CASCADE,
  member_b_id     UUID REFERENCES members(id) ON DELETE CASCADE,
  relation_type   TEXT NOT NULL,
  -- 'parent_child' → a là cha/mẹ của b
  -- 'spouse'       → vợ chồng
  -- 'adopted'      → con nuôi
  marriage_date   DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (member_a_id, member_b_id, relation_type)
);
```

#### `conversations` — Cuộc Hội Thoại (1-1 & Nhóm)
```sql
CREATE TABLE conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type            TEXT NOT NULL,
  -- 'direct'   → Chat 1-1
  -- 'group'    → Nhóm chat

  -- Nhóm chat
  name            TEXT,                     -- Tên nhóm
  avatar_url      TEXT,
  description     TEXT,

  -- Tự động tạo theo nhánh dòng họ
  family_tree_id  UUID REFERENCES family_trees(id),
  auto_group_type TEXT,
  -- 'branch'   → Nhóm theo nhánh cây gia phả
  -- 'manual'   → Tự tạo

  last_message_id UUID,
  last_message_at TIMESTAMPTZ,

  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

#### `conversation_members` — Thành Viên Cuộc Hội Thoại
```sql
CREATE TABLE conversation_members (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id     UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id             UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role                TEXT DEFAULT 'member',   -- 'admin' | 'member'
  last_read_at        TIMESTAMPTZ,             -- Để tính tin chưa đọc
  is_muted            BOOLEAN DEFAULT FALSE,
  joined_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (conversation_id, user_id)
);
```

#### `messages` — Tin Nhắn
```sql
CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID REFERENCES profiles(id),

  content         TEXT,
  media_urls      TEXT[],
  message_type    TEXT DEFAULT 'text',
  -- 'text' | 'image' | 'video' | 'file' | 'voice' | 'sticker'

  -- Reply
  reply_to_id     UUID REFERENCES messages(id),

  -- Reactions (emoji)
  reactions       JSONB DEFAULT '{}',          -- { "❤️": ["uid1", "uid2"] }

  is_deleted      BOOLEAN DEFAULT FALSE,
  deleted_at      TIMESTAMPTZ,

  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index để query tin nhắn theo conversation nhanh
CREATE INDEX messages_conversation_id_created_at
  ON messages (conversation_id, created_at DESC);
```

#### `groups` — Nhóm Cộng Đồng
```sql
CREATE TABLE groups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_tree_id  UUID REFERENCES family_trees(id),
  name            TEXT NOT NULL,
  description     TEXT,
  cover_url       TEXT,
  is_private      BOOLEAN DEFAULT FALSE,
  member_count    INTEGER DEFAULT 0,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

#### `connections` — Kết Nối Thành Viên
```sql
CREATE TABLE connections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES profiles(id),
  target_id   UUID REFERENCES profiles(id),
  status      TEXT DEFAULT 'pending',
  -- 'pending'   → Đã gửi lời mời
  -- 'accepted'  → Đã kết nối
  -- 'blocked'   → Đã chặn
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, target_id)
);
```

#### `notifications`
```sql
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES profiles(id),   -- Người thực hiện hành động
  type        TEXT NOT NULL,
  -- 'post_reaction'     → Ai đó react bài của bạn
  -- 'post_comment'      → Ai đó comment bài của bạn
  -- 'post_tag'          → Bị tag trong bài
  -- 'connection_req'    → Lời mời kết nối
  -- 'connection_accept' → Được chấp nhận kết nối
  -- 'group_invite'      → Được mời vào nhóm
  -- 'anniversary'       → Nhắc ngày giỗ / sinh nhật
  -- 'new_member'        → Thành viên mới trong dòng họ
  -- 'claim_invite'      → Được mời claim node trong cây
  title       TEXT NOT NULL,
  body        TEXT,
  data        JSONB,
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

#### `waitlist` — Early Access
```sql
CREATE TABLE waitlist (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  name        TEXT,
  phone       TEXT,
  referrer    TEXT,                          -- UTM source
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 6. Authentication & Phân Quyền

### 6.1 Phương Thức Đăng Nhập

| Phương thức | Lý do |
|-------------|-------|
| **OTP Email** | Phổ biến, không cần mật khẩu |
| **OTP SMS** | Phù hợp người Việt dùng điện thoại nhiều |
| **Google OAuth** | Đăng nhập nhanh |

### 6.2 Row Level Security (RLS)

```sql
-- Posts: chỉ thành viên cùng dòng họ mới xem được family posts
CREATE POLICY "posts_select" ON posts FOR SELECT
  USING (
    visibility = 'public'
    OR author_id = auth.uid()
    OR (
      visibility = 'family' AND
      EXISTS (
        SELECT 1 FROM family_tree_roles ftr1
        JOIN family_tree_roles ftr2 ON ftr1.family_tree_id = ftr2.family_tree_id
        WHERE ftr1.user_id = auth.uid()
          AND ftr2.user_id = (
            SELECT member_id FROM profiles WHERE id = posts.author_id
          )
      )
    )
  );

-- Messages: chỉ thành viên conversation mới đọc được
CREATE POLICY "messages_select" ON messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT conversation_id FROM conversation_members
      WHERE user_id = auth.uid()
    )
  );

-- Members trong cây: chỉ thành viên dòng họ xem được
CREATE POLICY "members_select" ON members FOR SELECT
  USING (
    family_tree_id IN (
      SELECT family_tree_id FROM family_tree_roles
      WHERE user_id = auth.uid()
    )
  );
```

### 6.3 Luồng "Claim Node" — Liên Kết Tài Khoản Với Cây

```
[Admin] Thêm "Nguyễn Văn B" vào cây → nhập email
    ↓
Edge Function gửi email: "Bạn được thêm vào gia phả Họ Nguyễn"
    ↓
[Nguyễn Văn B] Click link → đăng ký / đăng nhập
    ↓
Xác nhận thông tin: "Đây có phải là bạn không?"
    ↓
profiles.member_id = members.id  (claim thành công)
    ↓
Tự động: join dòng họ, join nhóm chat nhánh, nhận thông báo
```

---

## 7. Tính Năng — Mạng Xã Hội

### 7.1 Profile Cá Nhân (Facebook-Style)

```
┌─────────────────────────────────────────────────────────┐
│  [             Ảnh bìa (cover photo)               ]    │
│                                                         │
│  [Avatar]  Nguyễn Văn An                               │
│            @nguyenvana                                  │
│            "Sinh ra ở Hà Nội, lớn lên ở Sài Gòn"      │
│                                                         │
│  [Kết nối]  [Nhắn tin]  [...]                          │
├────────────┬────────────────────────────────────────────┤
│  Giới      │                                            │
│  thiệu     │  Timeline bài đăng                         │
│            │  ┌──────────────────────────────────────┐  │
│  Ở: HCM   │  │ 📷 Ảnh gia đình ngày Tết...          │  │
│  Quê: HN  │  │ ❤️ 24   💬 8   ↗️ 2                   │  │
│            │  └──────────────────────────────────────┘  │
│  Trong cây:│  ┌──────────────────────────────────────┐  │
│  Đời thứ 3 │  │ 🌳 Vừa thêm con trai vào gia phả... │  │
│  Con của:  │  └──────────────────────────────────────┘  │
│  Nguyễn A  │                                            │
└────────────┴────────────────────────────────────────────┘
```

**Điểm đặc biệt:** Panel bên trái hiển thị **vị trí trong cây gia phả** — đây là thứ Facebook không có.

### 7.2 News Feed — Bảng Tin Dòng Họ

- Thuật toán: ưu tiên bài của người thân gần, bài có nhiều tương tác
- Loại nội dung: bài đăng, ảnh, video, milestone, share
- Reactions: Like ❤️ Yêu thích 😂 Haha 😮 Wow 😢 Buồn
- Comment thread (reply nested 1 cấp)
- Tag thành viên trong bài: `@NguyenVanAn`
- Đăng bài vào nhóm từ Feed

### 7.3 Soạn Bài Đăng

```
┌────────────────────────────────────────────┐
│  [Avatar]  Bạn đang nghĩ gì?              │
│                                            │
│  [Ảnh/Video]  [Tag người]  [Cảm xúc]     │
│  [Địa điểm]   [Ngày giỗ]  [Milestone]    │
│                                            │
│  Hiển thị với: [Dòng họ ▼]               │
│                                            │
│                          [Đăng bài]       │
└────────────────────────────────────────────┘
```

### 7.4 Kết Nối Thành Viên

- **Gửi lời mời kết nối** (như Facebook friends)
- **Gợi ý kết nối** dựa trên cùng dòng họ, cùng chi
- Sau khi kết nối: xem được bài đăng của nhau, nhắn tin
- **Theo dõi** (không cần đối phương chấp nhận) — xem bài công khai

---

## 8. Tính Năng — Cây Gia Phả

### 8.1 Giao Diện Cây Trực Quan

```
Controls: [+ Zoom] [- Zoom] [Fit] [Dọc ↕] [Ngang ↔] [Tìm kiếm 🔍]

                    ┌─────────────┐
                    │  [Ảnh]      │
                    │ Nguyễn A    │  ← Tổ (Đời 1)
                    │ 1920–1990   │
                    └──────┬──────┘
              ┌────────────┼────────────┐
        ┌─────┴────┐  ┌────┴─────┐  ┌──┴──────┐
        │ [Ảnh]   │  │ [Ảnh]   │  │ [Ảnh]  │
        │Nguyễn B │  │Nguyễn C │  │Nguyễn D│  ← Đời 2
        │1945–    │  │1948–    │  │1952–   │
        └────┬────┘  └─────────┘  └────────┘
        ┌────┴────┐
        │ [Ảnh]  │
        │Nguyễn E│   ← Đời 3 (bạn)
        │1975–   │
        │[Ông nội]│  ← Vai vế với người xem
        └─────────┘
```

**Tương tác:**
- Click node → Drawer/Panel hồ sơ chi tiết
- Right-click / Long press → Menu: Thêm con, Thêm vợ/chồng, Xem hồ sơ
- Hover → Tooltip: tên, năm sinh, vai vế
- Search → Highlight node, scroll đến vị trí

### 8.2 Hồ Sơ Member Trong Cây

Khi click vào node, hiện panel bên phải:
- Ảnh, tên, năm sinh/mất
- Vai vế với người đang đăng nhập
- Quan hệ trực tiếp: cha, mẹ, vợ/chồng, con
- Nút: "Xem Profile đầy đủ" (nếu đã claim)
- Nút: "Mời tham gia" (nếu chưa claim)

### 8.3 Thêm Thành Viên Vào Cây

```
Từ node đã có → Click "Thêm con" / "Thêm vợ/chồng"
    ↓
Modal nhập thông tin:
  • Họ tên (*)
  • Giới tính (*)
  • Ngày sinh dương lịch → tự convert sang âm
  • Ngày mất (nếu đã mất) → tính ngày giỗ
  • Quê quán
  • Ảnh
  • Email (để gửi lời mời claim)
    ↓
Lưu → Node xuất hiện trên cây ngay lập tức
```

---

## 9. Tính Năng — Nhắn Tin & Nhóm Chat

### 9.1 Chat 1-1 (Direct Message)

Giống Messenger / Zalo:
- Gửi text, ảnh, video, file, voice message
- Emoji reactions trên từng tin nhắn
- Reply tin nhắn cụ thể (quote)
- Trạng thái: đã gửi ✓, đã nhận ✓✓, đã xem (avatar)
- Online/Offline indicator
- Typing indicator ("Đang nhập...")

### 9.2 Nhóm Chat — 2 Loại

#### Loại 1: Nhóm Tự Động Theo Nhánh Dòng Họ

Khi admin tạo dòng họ, Edge Function tự động tạo nhóm:

```
Dòng họ: Họ Nguyễn
    ├── 💬 Nhóm: Toàn dòng họ Nguyễn    ← Tất cả thành viên
    ├── 💬 Nhóm: Chi Nguyễn Văn B       ← Con cháu ông B
    └── 💬 Nhóm: Chi Nguyễn Văn C       ← Con cháu ông C
```

Khi thành viên mới claim node → **tự động join** nhóm phù hợp.

#### Loại 2: Nhóm Tự Tạo

- Bất kỳ thành viên nào cũng tạo được nhóm
- Đặt tên, ảnh đại diện, mô tả
- Mời thành viên
- Nhóm riêng tư hoặc công khai trong dòng họ

### 9.3 Tính Năng Nhóm Chat

- Gửi tin nhắn, ảnh, video, file
- @mention thành viên
- Ghim tin nhắn quan trọng (admin)
- Thông báo sự kiện trong nhóm (giỗ chạp, họp họ)
- Phân quyền: admin nhóm, thành viên
- Tắt thông báo theo nhóm

---

## 10. Tính Năng — Liên Kết Thành Viên

### 10.1 Gợi Ý Kết Nối Thông Minh

Hệ thống gợi ý dựa trên:

| Tiêu chí | Điểm ưu tiên |
|----------|-------------|
| Cùng dòng họ | ⭐⭐⭐⭐⭐ |
| Cùng chi (nhánh) | ⭐⭐⭐⭐ |
| Cùng thế hệ | ⭐⭐⭐ |
| Có bạn chung | ⭐⭐ |
| Cùng quê quán | ⭐ |

### 10.2 Danh Sách Thành Viên Dòng Họ

```
Tìm kiếm: [_______________🔍]
Lọc: [Tất cả ▼]  [Đời ▼]  [Chi ▼]  [Tỉnh/Thành ▼]

┌──────────────────────────────────────────────┐
│ [Ảnh] Nguyễn Văn An                          │
│       Đời thứ 3 · Con của Nguyễn Văn B       │
│       Hà Nội · Kỹ sư phần mềm               │
│       [Kết nối]  [Nhắn tin]                  │
└──────────────────────────────────────────────┘
```

### 10.3 Trang "Họ Hàng Của Tôi"

Tab đặc biệt hiển thị:
- Danh sách bạn bè đã kết nối
- Họ hàng trong cây (ông bà, chú dì, anh chị em...)
- Gợi ý kết nối với họ hàng chưa kết nối

---

## 11. Landing Page

### 11.1 Cấu Trúc (Route "/")

```
Header
  Logo + Nav: [Tính năng] [Giá] [Đăng nhập] [Bắt đầu miễn phí]

Hero
  Headline: "Mạng Xã Hội Của Dòng Họ Bạn"
  Sub: "Kết nối họ hàng, lưu giữ gia phả, chia sẻ ký ức — tất cả trong một nơi"
  CTA: [Tạo tài khoản miễn phí] [Xem demo]
  Visual: Animation cây gia phả + chat bubbles

Vấn đề & Giải pháp
  "Gia phả thất lạc, họ hàng xa cách, ký ức phai mờ..."
  → GiaPhả giải quyết tất cả

Tính Năng (4 cards)
  🌳 Cây gia phả trực quan
  📱 Mạng xã hội dòng họ
  💬 Nhóm chat tự động
  🔔 Nhắc giỗ theo âm lịch

Demo
  Screenshot / GIF của app thực tế

Pricing (Freemium)
  Free | Pro | Dòng Họ

Waitlist
  "Đăng ký nhận thông báo ra mắt sớm"
  [Tên] [Email] [Đăng ký ngay]

Footer
  © GiaPhả · Liên hệ · CSBT · Điều khoản · Facebook · Zalo
```

### 11.2 SEO Keywords

- "gia phả online", "phần mềm gia phả", "cây gia phả"
- "mạng xã hội gia đình", "kết nối họ hàng"
- "lưu ký ức gia đình", "họ Nguyễn/Trần/Lê..."

---

## 12. Mobile App

### 12.1 Tab Navigation (Bottom Tabs)

```
┌───┬───┬───┬───┬───┐
│🏠 │🌳 │➕ │💬 │👤 │
│Feed│Cây│Post│Chat│Tôi│
└───┴───┴───┴───┴───┘
```

| Tab | Nội dung |
|-----|----------|
| 🏠 Feed | Bảng tin, Stories, gợi ý kết nối |
| 🌳 Cây | Cây gia phả, thêm thành viên |
| ➕ Post | Nút đăng bài nhanh (center FAB) |
| 💬 Chat | Danh sách chat 1-1 và nhóm |
| 👤 Tôi | Profile, cài đặt, thông báo |

### 12.2 Push Notifications

| Sự kiện | Thời điểm |
|---------|-----------|
| Ngày giỗ sắp đến | 3 ngày trước (âm lịch) |
| Sinh nhật họ hàng | Sáng ngày sinh nhật |
| Bài đăng mới của bạn bè | Realtime |
| Có người react/comment | Realtime |
| Tin nhắn mới | Realtime |
| Lời mời kết nối | Realtime |
| Thành viên mới trong dòng họ | Realtime |

### 12.3 Offline Mode

- Cache danh sách thành viên & cây gia phả
- Đọc tin nhắn đã tải offline
- Draft bài đăng khi mất mạng → tự gửi khi có mạng

---

## 13. Mô Hình Freemium

### 13.1 Bảng Gói

| Tính năng | 🆓 Free | ⭐ Pro (99k/tháng) | 🏛️ Dòng Họ (499k/tháng) |
|-----------|---------|-------------------|------------------------|
| Thành viên trong cây | 50 | Không giới hạn | Không giới hạn |
| Lưu trữ media | 500 MB | 5 GB | 50 GB |
| Bài đăng / tháng | Không giới hạn | Không giới hạn | Không giới hạn |
| Chat 1-1 | ✅ | ✅ | ✅ |
| Nhóm chat | 3 nhóm | Không giới hạn | Không giới hạn |
| App mobile | ✅ | ✅ | ✅ |
| Xuất PDF gia phả | ❌ | ✅ | ✅ |
| Nhóm tự động theo nhánh | ❌ | ✅ | ✅ |
| Phân quyền nâng cao | ❌ | ❌ | ✅ |
| Tên miền riêng | ❌ | ❌ | ✅ |
| Priority support | ❌ | ✅ | ✅ |

### 13.2 Thanh Toán

- **Stripe** — thẻ Visa/Master quốc tế
- **VNPay / MoMo** — ví điện tử Việt Nam
- Chu kỳ: tháng hoặc năm (giảm 20%)
- Hoàn tiền 7 ngày

---

## 14. Đặc Thù Văn Hoá Việt Nam

### 14.1 Tính Vai Vế Tự Động

```typescript
// packages/shared/utils/kinship.ts

type KinshipLabel = {
  label: string;       // "Ông nội", "Dì ruột", "Anh họ"
  side: 'paternal' | 'maternal' | 'spouse';
  generation: number;  // -2: ông bà, -1: cha mẹ, 0: cùng thế hệ, +1: con...
}

// Hiển thị dưới avatar trong cây:
// Người đang xem là "An" → click vào node "B" → hiện "Ông nội của bạn"
```

**Bảng vai vế chính:**

| Quan hệ | Phía nội | Phía ngoại |
|---------|----------|------------|
| Cha của cha | Ông nội | — |
| Mẹ của cha | Bà nội | — |
| Cha của mẹ | Ông ngoại | — |
| Mẹ của mẹ | Bà ngoại | — |
| Anh/chị của cha | Bác | — |
| Em trai của cha | Chú | — |
| Em gái của cha | Cô | — |
| Anh/em của mẹ | Cậu | — |
| Chị/em gái của mẹ | Dì | — |

### 14.2 Âm Lịch & Ngày Giỗ

```typescript
// Lưu ngày mất âm lịch khi nhập
dod_lunar: "10/3"  // 10 tháng 3 âm lịch

// Edge Function chạy hàng ngày 6:00 sáng:
// → Tìm tất cả ngày giỗ trong 3 ngày tới
// → Gửi notification đến các thành viên dòng họ
```

### 14.3 Họ Và Tên Việt Nam

- Tìm kiếm không dấu: "nguyen van an" → tìm được "Nguyễn Văn An"
- Tìm kiếm linh hoạt: "van an", "an nguyen" đều ra kết quả
- Hiển thị đầy đủ: Họ + Tên đệm + Tên

### 14.4 Thế Hệ (Đời)

- Đời 1: Tổ tiên khai sáng dòng họ
- Tự động tính: con = cha + 1 đời
- Hiển thị trên node cây và profile: "Đời thứ 5"
- Lọc thành viên theo đời

---

## 15. API & Realtime Design

### 15.1 Supabase Queries Chính

```typescript
// --- FEED ---
// Lấy bài đăng của bạn bè và dòng họ
const { data: posts } = await supabase
  .from('posts')
  .select(`*, profiles(full_name, avatar_url), reactions(type, user_id)`)
  .order('created_at', { ascending: false })
  .range(0, 19)  // Pagination 20 bài/lần

// --- CHAT ---
// Lấy tin nhắn của conversation (realtime)
const { data: messages } = await supabase
  .from('messages')
  .select(`*, profiles(full_name, avatar_url)`)
  .eq('conversation_id', conversationId)
  .order('created_at', { ascending: false })
  .limit(50)

// Realtime — lắng nghe tin nhắn mới
supabase
  .channel(`conv:${conversationId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `conversation_id=eq.${conversationId}`
  }, (payload) => addMessageToStore(payload.new))
  .subscribe()

// Realtime — Typing indicator (Presence)
const channel = supabase.channel(`typing:${conversationId}`)
channel
  .on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState()
    setTypingUsers(Object.values(state).flat())
  })
  .subscribe()

// Broadcast typing
await channel.track({ user_id: myId, is_typing: true })

// --- CÂY GIA PHẢ ---
// Lấy toàn bộ cây (members + relationships)
const { data: treeData } = await supabase
  .from('members')
  .select(`
    *,
    relationships_as_parent:relationships!member_a_id(
      id, relation_type, member_b_id
    ),
    relationships_as_child:relationships!member_b_id(
      id, relation_type, member_a_id
    )
  `)
  .eq('family_tree_id', treeId)
```

### 15.2 Edge Functions

```
/functions/
├── send-invite-email/
│   POST { member_id, email }
│   → Gửi email mời claim node qua Resend
│
├── notify-anniversary/
│   Cron: 0 6 * * *  (6:00 sáng mỗi ngày)
│   → Tìm ngày giỗ/sinh nhật trong 3 ngày tới
│   → Gửi push notification + email
│
├── auto-create-branch-group/
│   Trigger: sau khi thêm member vào cây
│   → Tự tạo nhóm chat cho chi/nhánh mới
│   → Auto-add thành viên vào nhóm phù hợp
│
├── calculate-kinship/
│   POST { viewer_id, target_member_id }
│   → Tính vai vế (BFS trên graph relationships)
│   → Return: "Ông nội của bạn"
│
└── export-family-pdf/
    POST { family_tree_id }
    → Generate PDF gia phả đẹp (Pro feature)
```

---

## 16. Kế Hoạch Phát Triển

### Giai Đoạn 1 — Foundation (Tuần 1–2)
**Mục tiêu:** Landing page live + Supabase setup

- [ ] Khởi tạo monorepo (pnpm workspaces)
- [ ] Setup Supabase: schema, RLS, auth
- [ ] Landing Page hoàn chỉnh + deploy
- [ ] Waitlist form + Edge Function gửi email
- [ ] Deploy lên Vercel, setup domain giаpha.vn

### Giai Đoạn 2 — Auth & Profile (Tuần 3–5)
**Mục tiêu:** Đăng nhập + hồ sơ cơ bản

- [ ] Auth: OTP email/SMS, Google OAuth
- [ ] Profile cá nhân (Facebook-style): ảnh bìa, bio, edit
- [ ] Tạo / tham gia dòng họ
- [ ] Onboarding flow cho user mới
- [ ] Upload ảnh (Supabase Storage)

### Giai Đoạn 3 — Cây Gia Phả (Tuần 6–9)
**Mục tiêu:** Core gia phả hoạt động

- [ ] Render cây bằng D3.js
- [ ] CRUD members (thêm, sửa, xoá node)
- [ ] Thêm quan hệ: cha/mẹ-con, vợ/chồng
- [ ] Tính thế hệ, tính vai vế tự động
- [ ] Luồng "claim node" + gửi email mời
- [ ] Âm lịch + ngày giỗ

### Giai Đoạn 4 — Mạng Xã Hội (Tuần 10–13)
**Mục tiêu:** Facebook-style feed hoạt động

- [ ] Đăng bài (text, ảnh, video)
- [ ] News Feed với thuật toán cơ bản
- [ ] Reactions (6 loại)
- [ ] Comments (nested 1 cấp)
- [ ] Hệ thống kết nối (gửi, chấp nhận, gợi ý)
- [ ] Notifications realtime

### Giai Đoạn 5 — Chat (Tuần 14–16)
**Mục tiêu:** Nhắn tin đầy đủ

- [ ] Chat 1-1 realtime (text, ảnh)
- [ ] Nhóm chat: tạo tay và tự động theo nhánh
- [ ] Typing indicator, online presence
- [ ] Đọc/chưa đọc, badge count
- [ ] Push notification cho tin nhắn

### Giai Đoạn 6 — Mobile App (Tuần 17–20)
**Mục tiêu:** iOS & Android

- [ ] Expo setup, Expo Router
- [ ] Port tất cả màn hình sang React Native
- [ ] Cây gia phả mobile (react-native-svg)
- [ ] Push notifications (FCM + APNs)
- [ ] Offline mode
- [ ] Submit App Store & Google Play

### Giai Đoạn 7 — Monetisation (Tuần 21–24)
**Mục tiêu:** Ra mắt freemium

- [ ] Stripe + VNPay integration
- [ ] Enforce giới hạn Free tier
- [ ] Tính năng Pro: xuất PDF, nhóm tự động
- [ ] Tính năng Enterprise: phân quyền nâng cao
- [ ] Analytics, A/B testing

---

## 17. Môi Trường & Deploy

### 17.1 Biến Môi Trường

```env
# apps/web/.env.local
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_APP_URL=https://giаpha.vn

# packages/supabase/functions/.env
RESEND_API_KEY=re_xxx
STRIPE_SECRET_KEY=sk_live_xxx
VNPAY_SECRET=xxx
FCM_SERVER_KEY=xxx
```

### 17.2 CI/CD Pipeline

```
git push → GitHub Actions
    ↓
Type Check (tsc --noEmit)
ESLint
Unit Tests (Vitest)
    ↓
Preview Deploy (Vercel) — cho mỗi PR
    ↓
Merge to main
    ↓
Production Deploy (Vercel)
Supabase Migrations (supabase db push)
    ↓
Sentry release tracking
PostHog deploy event
```

### 17.3 Environments

| | Development | Staging | Production |
|--|-------------|---------|------------|
| Web URL | localhost:5173 | staging.giаpha.vn | giаpha.vn |
| Supabase | Local (docker) | Supabase staging | Supabase prod |
| Branch | feature/* | develop | main |

---

## Phụ Lục A — Từ Điển Thuật Ngữ

| Thuật ngữ | Giải thích |
|-----------|------------|
| **Dòng họ** | Một gia tộc = 1 `family_tree` + không gian MXH riêng |
| **Member / Node** | Một người trong cây gia phả (chưa cần có tài khoản) |
| **Profile** | Tài khoản MXH của người dùng thực |
| **Claim node** | Liên kết profile với node trong cây |
| **Chi / Nhánh** | Một nhánh con trong cây (descendants của 1 node) |
| **Đời / Thế hệ** | Cấp độ trong cây gia phả (generation) |
| **Vai vế** | Danh xưng quan hệ Việt Nam (ông, bà, chú, dì...) |
| **Ngày giỗ** | Ngày mất tính theo âm lịch, tổ chức hàng năm |

## Phụ Lục B — Tham Khảo

- [Supabase Docs](https://supabase.com/docs)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [D3 Hierarchy](https://d3js.org/d3-hierarchy)
- [Expo Docs](https://docs.expo.dev)
- [Reingold-Tilford Tree Algorithm](https://reingold.co/tidier-drawings.pdf)
- [Âm Lịch Việt Nam](https://www.informatik.uni-leipzig.de/~duc/amlich)

---

*Tài liệu GiaPhả System v2.0 — Cập nhật theo tiến độ phát triển*
