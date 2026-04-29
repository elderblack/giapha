/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly NEXT_PUBLIC_SUPABASE_URL: string
  readonly NEXT_PUBLIC_SUPABASE_ANON_KEY: string
  readonly NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: string | undefined
  /** Optional — redirect auth; mặc định dùng window.location.origin */
  readonly NEXT_PUBLIC_SITE_URL: string | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
