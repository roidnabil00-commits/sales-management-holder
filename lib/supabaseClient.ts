import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL atau Anon Key belum diset di .env.local')
}

// Gunakan createBrowserClient agar token otomatis masuk Cookies
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)