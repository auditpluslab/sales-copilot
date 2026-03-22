import { createClient as createSupabaseClient } from "@supabase/supabase-js"

// 環境変数の検証
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing required Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
  )
}

// URL形式の検証
try {
  new URL(supabaseUrl)
} catch {
  throw new Error(`Invalid NEXT_PUBLIC_SUPABASE_URL format: ${supabaseUrl}`)
}

export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey)

// Client factory for server-side usage
export const createClient = () => {
  return createSupabaseClient(supabaseUrl, supabaseAnonKey)
}

// Alias for server-side usage (Inngest functions用)
export const createServerClient = createClient

