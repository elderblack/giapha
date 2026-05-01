import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { StateStorage } from 'zustand/middleware'

const PERSIST_NAME = 'giapha_supabase_auth_kv'

/** Web (expo start --web): SecureStore không có native — dùng RAM cho dev. */
const memory = new Map<string, string>()
const platformStorage: StateStorage =
  Platform.OS === 'web'
    ? {
        getItem: async (name) => memory.get(name) ?? null,
        setItem: async (name, value) => {
          memory.set(name, value)
        },
        removeItem: async (name) => {
          memory.delete(name)
        },
      }
    : {
        getItem: (name) => SecureStore.getItemAsync(name),
        setItem: (name, value) => SecureStore.setItemAsync(name, value),
        removeItem: (name) => SecureStore.deleteItemAsync(name),
      }

export type AuthKvStore = {
  /** Các key/session mà @supabase/supabase-js ghi (vd. sb-...auth-token). */
  byKey: Record<string, string>
  setKey: (key: string, value: string) => void
  removeKey: (key: string) => void
}

export const useAuthKvStore = create<AuthKvStore>()(
  persist(
    (set, get) => ({
      byKey: {},
      setKey: (key, value) => set({ byKey: { ...get().byKey, [key]: value } }),
      removeKey: (key) => {
        const next = { ...get().byKey }
        delete next[key]
        set({ byKey: next })
      },
    }),
    {
      name: PERSIST_NAME,
      storage: createJSONStorage(() => platformStorage),
      partialize: (s) => ({ byKey: s.byKey }),
    },
  ),
)

/** Adapter khớp `auth.storage` của Supabase client (async get/set/remove). */
export function getSupabaseAuthStorage() {
  return {
    getItem: async (key: string): Promise<string | null> =>
      Promise.resolve(useAuthKvStore.getState().byKey[key] ?? null),
    setItem: async (key: string, value: string): Promise<void> => {
      useAuthKvStore.getState().setKey(key, value)
    },
    removeItem: async (key: string): Promise<void> => {
      useAuthKvStore.getState().removeKey(key)
    },
  }
}
