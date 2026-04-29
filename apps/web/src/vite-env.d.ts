/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  /** Legacy anon JWT — dùng cho Edge Functions + API */
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Optional — redirect auth; mặc định dùng window.location.origin */
  readonly VITE_SITE_URL: string | undefined
  readonly VITE_APP_URL: string
  readonly NEXT_PUBLIC_SUPABASE_URL: string
  readonly NEXT_PUBLIC_SUPABASE_ANON_KEY: string
  readonly NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
