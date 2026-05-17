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
    // Restore existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
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
        <p>Loading clientflow…</p>
      </div>
    )
  }

  if (!session) {
    return <Setup onAuth={setSession} />
  }

  return <Dashboard session={session} onSignOut={handleSignOut} />
}
