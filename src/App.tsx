import { framer } from "framer-plugin"
import { useEffect, useState } from "react"
import { supabase } from "./lib/supabase"
import { Setup } from "./components/Setup"
import { Dashboard } from "./components/Dashboard"
import "./globals.css"

// Show the plugin panel in Framer editor
framer.showUI({
  position: "top right",
  width: 360,
  height: 600,
  resizable: true,
})

export function App() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // ── Handle email-confirmation redirects ──────────────────
    const hash = window.location.hash
    if (hash && hash.includes('access_token')) {
      const params = new URLSearchParams(hash.substring(1)) // strip leading '#'
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      if (accessToken && refreshToken) {
        // Hydrate the Supabase client with the tokens
        supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          .then(({ data, error }) => {
            if (!error && data.session) {
              setSession(data.session)
            }
          })
          .finally(() => {
            // Clean the ugly tokens out of the address bar
            window.history.replaceState(null, '', window.location.pathname)
          })
      }
    }
    // ─────────────────────────────────────────────────────────────────────

    // Restore existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    setSession(null)
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="framer-spinner-large" />
        <p>Loading Remark…</p>
      </div>
    )
  }

  if (!session) {
    return <Setup onAuth={setSession} />
  }

  return <Dashboard session={session} onSignOut={handleSignOut} />
}
