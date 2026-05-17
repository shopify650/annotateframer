import { useState } from "react"
import { supabase } from "../lib/supabase"

interface Props {
  onAuth: (session: any) => void
}

export function Setup({ onAuth }: Props) {
  const [mode, setMode] = useState<"login" | "signup">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)
    setLoading(true)

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setSuccessMsg("Check your email to confirm your account, then log in.")
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        onAuth(data.session)
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="setup-screen">
      <div className="setup-logo">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pin" style={{ color: "var(--accent)" }}><line x1="12" x2="12" y1="17" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.78-3.61A2 2 0 0 1 15 9.17V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4.17a2 2 0 0 1-.78 1.58L5.44 14a2 2 0 0 0-.44 1.24Z"/></svg>
        <span className="logo-text">AnnotateFrame</span>
      </div>
      <p className="setup-tagline">Client feedback, directly on your Framer site.</p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="tab-switch">
          <button
            type="button"
            className={mode === "login" ? "tab-btn active" : "tab-btn"}
            onClick={() => { setMode("login"); setError(null); setSuccessMsg(null) }}
          >
            Log In
          </button>
          <button
            type="button"
            className={mode === "signup" ? "tab-btn active" : "tab-btn"}
            onClick={() => { setMode("signup"); setError(null); setSuccessMsg(null) }}
          >
            Sign Up
          </button>
        </div>

        <div className="field-group">
          <label className="field-label">Email</label>
          <input
            className="field-input"
            type="email"
            placeholder="you@agency.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="field-group">
          <label className="field-label">Password</label>
          <input
            className="field-input"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </div>

        {error && (
          <div className="auth-error" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-alert-triangle"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
            {error}
          </div>
        )}
        {successMsg && (
          <div className="auth-success" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check"><polyline points="20 6 9 17 4 12"/></svg>
            {successMsg}
          </div>
        )}

        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? "Please wait…" : mode === "login" ? "Log In" : "Create Account"}
        </button>
      </form>

      <p className="setup-footer">
        Free plan includes 1 project &amp; 10 comments/month.
      </p>
    </div>
  )
}
