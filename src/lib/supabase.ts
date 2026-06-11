import { createClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[Remark] Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env"
  )
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key"
)

// OAuth callback URL configuration
const isDevelopment = import.meta.env.DEV
export const OAUTH_CALLBACK_URL = isDevelopment
  ? "http://localhost:3000/oauth.html"
  : "https://annotateframe-auth.vercel.app/oauth.html"
