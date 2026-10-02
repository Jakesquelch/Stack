import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY (see .env.example)')
}

export const supabase = createClient<Database>(url, key)

/** Signs this phone in anonymously the first time. After that the session is kept in storage. */
export async function ensureSession() {
  const { data } = await supabase.auth.getSession()
  if (data.session) return data.session

  const res = await supabase.auth.signInAnonymously()
  if (res.error) throw res.error
  return res.data.session!
}

type DbError = { message: string; code?: string }

/**
 * Supabase returns errors instead of throwing them; this throws so TanStack Query sees them.
 * Returns the data with the type it has when the call succeeded.
 */
export function must<R extends { data: unknown; error: DbError | null }>(res: R): Extract<R, { error: null }>['data'] {
  if (res.error) throw res.error
  return res.data
}

/** Turns database errors people might actually hit into something readable */
export function friendlyError(error: unknown): string {
  const e = error as DbError
  const message = e?.message ?? String(error)
  if (message.includes('players_name_ci')) return 'Someone with that name already exists'
  if (message.includes('one_live_game')) return 'A game is already running'
  if (message.includes('game_players_pkey')) return "They're already in the game"
  if (message === 'Failed to fetch' || message.includes('NetworkError')) {
    return "Couldn't reach the server. Check your signal and try again"
  }
  return message
}
