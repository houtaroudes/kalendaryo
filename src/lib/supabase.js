import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * The client is created only when both env vars are present. When they are not,
 * the app runs on the local demo store in api.js instead, so the booking flow is
 * usable before any backend exists.
 */
export const supabase = url && anonKey ? createClient(url, anonKey) : null

export const backend = supabase ? 'supabase' : 'local'
