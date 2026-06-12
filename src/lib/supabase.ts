import { createClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[Remark] Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env"
  )
}

export const supabase = createClient(
  supabaseUrl || "https://rajchwlaxdomhvlqjfxy.supabase.co",
  supabaseAnonKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhamNod2xheGRvbWh2bHFqZnh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NDg4ODMsImV4cCI6MjA5NDUyNDg4M30.FH2oIZAz7C1CD1gkXRkUWk16wavTt_a-kV5i9wy_mBc"
)

// OAuth callback URL configuration
const isDevelopment = import.meta.env.DEV
export const OAUTH_CALLBACK_URL = isDevelopment
  ? "http://localhost:3000/oauth.html"
  : "https://annotateframe-auth.vercel.app/oauth.html"
