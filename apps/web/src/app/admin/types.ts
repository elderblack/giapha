export type AdminDashboardSummary = {
  error?: string
  profiles?: number
  trees?: number
  tree_members?: number
  tree_roles?: number
  waitlist?: number
  feed_posts?: number
  chat_conversations?: number
  waitlist_rows?: WaitlistAdminRow[]
}

export type WaitlistAdminRow = {
  id: string
  email: string
  name: string | null
  phone: string | null
  referrer: string | null
  created_at: string
}
