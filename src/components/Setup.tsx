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
        <span className="logo-icon">📌</span>
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

        {error && <div className="auth-error">⚠️ {error}</div>}
        {successMsg && <div className="auth-success">✅ {successMsg}</div>}

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
