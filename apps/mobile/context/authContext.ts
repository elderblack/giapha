import type { Session, User } from '@supabase/supabase-js'
import { createContext } from 'react'

export type AuthContextValue = {
  session: Session | null
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
