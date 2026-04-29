# Vai trò giao diện — `DESIGN.md` (Airbnb)

Tài liệu này ánh xạ **theme tokens** trong `DESIGN.md` (repo root) sang **Tailwind** và **`src/design/roles.ts`**.

## Màu (`abnb-*`)

| Token Tailwind | YAML trong DESIGN.md | Hex |
|----------------|----------------------|-----|
| `abnb-primary` | `colors.primary` | `#ff385c` |
| `abnb-primaryActive` | `primary-active` | `#e00b41` |
| `abnb-ink` | `ink` | `#222222` |
| `abnb-body` | `body` | `#3f3f3f` |
| `abnb-muted` | `muted` | `#6a6a6a` |
| `abnb-hairline` | `hairline` | `#dddddd` |
| `abnb-canvas` | `canvas` | `#ffffff` |
| `abnb-surfaceSoft` | `surface-soft` | `#f7f7f7` |
| `abnb-surfaceStrong` | `surface-strong` | `#f2f2f2` |
| `abnb-error` | `primary-error-text` | `#c13515` |
| `abnb-legalLink` | `legal-link` | `#428bff` |

## Bo góc (`rounded-abnb-*`)

Khớp `rounded` trong front-matter: `xs` 4px · `sm` 8px · `md` 14px · `lg` 20px · `xl` 32px · `full`.

## Đổ bóng

Một tầng: `shadow-abnb` (định nghĩa trong `tailwind.config.js`).

## Font

**Airbnb Cereal / Circular** không public — dùng **Inter** làm substitute (theo mục *Font Substitutes* trong `DESIGN.md`).

## Component strings

Ưu tiên `role.btnPrimary`, `role.card`, `role.input`, … trong `roles.ts` thay vì lặp class raw.

## Tham chiếu thêm

Landing được cấu trúc gần [giaphadaiviet.vn](https://giaphadaiviet.vn/) (hero + bước + lưới tính năng + giá + CTA), **màu & typography** bám **Airbnb** trong `DESIGN.md`.
