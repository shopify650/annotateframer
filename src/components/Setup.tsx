import { useState } from "react"
import { supabase } from "../lib/supabase"

interface Props {
  onAuth: (session: any) => void
}

export function Setup({ onAuth }: Props) {
  const [mode, setMode] = useState<"login" | "signup" | "forgot" | "verify_reset">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  function extractToken(input: string): string {
    const trimmed = input.trim()
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      try {
        const url = new URL(trimmed)
        const tokenHash = url.searchParams.get("token_hash")
        if (tokenHash) return tokenHash
        const token = url.searchParams.get("token")
        if (token) return token
      } catch (e) {
        // Fallback
      }
    }
    return trimmed
  }

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
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email)
        if (error) throw error
        setSuccessMsg("Check your email for a password reset link/code.")
        setMode("verify_reset")
      } else if (mode === "verify_reset") {
        const verifiedToken = extractToken(code)
        
        let verifyResult
        if (verifiedToken.length > 10) {
          // Paste a long token_hash from the link!
          verifyResult = await supabase.auth.verifyOtp({
            token_hash: verifiedToken,
            type: "recovery"
          })
        } else {
          // Paste a short 6-digit OTP code!
          verifyResult = await supabase.auth.verifyOtp({
            email,
            token: verifiedToken,
            type: "recovery"
          })
        }

        const { data, error: verifyError } = verifyResult
        if (verifyError) throw verifyError

        const { error: updateError } = await supabase.auth.updateUser({
          password: newPassword
        })
        if (updateError) throw updateError

        setSuccessMsg("Password reset successfully! Logging in...")
        setTimeout(() => {
          onAuth(data.session)
        }, 1000)
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

  async function handleGoogleLogin() {
    setLoading(true)
    setError(null)
    try {
      const loginId = crypto.randomUUID()
      
      // Actively poll the secure database for the handoff from the popup
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        if (attempts > 120) { // 3 minutes timeout
          clearInterval(poll)
          setLoading(false)
          setError("Login timed out. Please try again.")
          return
        }

        const { data, error } = await supabase.from('login_sessions').select('*').eq('id', loginId).single()
        
        // If we hit a database error (like table doesn't exist), fail gracefully
        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
           clearInterval(poll)
           setLoading(false)
           setError("Database error. Did you run the SQL script to create login_sessions?")
           return
        }

        if (data) {
          clearInterval(poll)
          // We found the token! Destroy the evidence and log in.
          await supabase.from('login_sessions').delete().eq('id', loginId)
          await supabase.auth.setSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token
          })
        }
      }, 1500)

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          skipBrowserRedirect: true, // Crucial for Framer plugins (iframes)
          redirectTo: `${window.location.origin}/callback.html?loginId=${loginId}&supabaseUrl=${encodeURIComponent(import.meta.env.VITE_SUPABASE_URL)}&supabaseKey=${encodeURIComponent(import.meta.env.VITE_SUPABASE_ANON_KEY)}`,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      })
      
      if (error) {
        clearInterval(poll)
        throw error
      }
      
      if (data.url) {
        window.open(data.url, 'google_login', 'width=500,height=600,left=200,top=200')
      }
    } catch (err: any) {
      setError(err.message || "Google login failed")
      setLoading(false)
    }
  }

  return (
    <div className="setup-screen">
      <div className="setup-logo">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" rx="6" fill="var(--accent)"/>
          <path d="M7 12.5L10 15.5L17 8.5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="logo-text">Remark</span>
      </div>
      <p className="setup-tagline">Client feedback, automated screenshots, zero hassle.</p>

      <form className="auth-form" onSubmit={handleSubmit}>
        {(mode === "login" || mode === "signup") ? (
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
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600 }}>
              {mode === "forgot" ? "Reset Password" : "Verify Reset"}
            </span>
            <button
              type="button"
              className="btn-link"
              style={{
                background: "none",
                border: "none",
                color: "var(--accent)",
                fontSize: "10.5px",
                padding: 0,
                cursor: "pointer",
                textDecoration: "underline",
                fontWeight: 500
              }}
              onClick={() => {
                setMode("login")
                setError(null)
                setSuccessMsg(null)
              }}
            >
              Back to Log In
            </button>
          </div>
        )}

        {(mode === "login" || mode === "signup") && (
          <div className="oauth-buttons" style={{ display: 'flex', flexDirection: 'column', marginBottom: '12px' }}>
            <button
              type="button"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                width: '100%', padding: '10px', borderRadius: 'var(--radius)',
                border: '1px solid var(--border)', background: 'transparent',
                color: 'var(--text)', cursor: 'pointer', fontWeight: 500, fontSize: '13px',
                transition: 'background 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-dim)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
            <div style={{ display: 'flex', alignItems: 'center', margin: '16px 0 4px 0', color: 'var(--text-sub)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
              <span style={{ padding: '0 10px' }}>or email</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
            </div>
          </div>
        )}

        {mode !== "verify_reset" && (
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
        )}

        {mode === "verify_reset" && (
          <>
            <div style={{ background: "var(--accent-dim)", padding: "10px", borderRadius: "var(--radius)", fontSize: "10.5px", color: "var(--text-sub)", lineHeight: "1.4", border: "1px solid var(--border)", marginBottom: "4px" }}>
              <strong style={{ color: "var(--text)", display: "block", marginBottom: "4px" }}>💡 Quick Instructions:</strong>
              1. Check your email for the reset link.<br />
              2. <strong style={{ color: "var(--text)" }}>Do not click the link in your email!</strong> (This makes it expire immediately).<br />
              3. Copy the recovery link and paste it into the field below.<br />
              4. Enter your new password and click Reset!
            </div>
            <div className="field-group">
              <label className="field-label">Email Address</label>
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
              <label className="field-label">Verification Code or Email Link</label>
              <input
                className="field-input"
                type="text"
                placeholder="6-digit code or paste entire email link"
                value={code}
                onChange={e => setCode(e.target.value)}
                required
              />
            </div>
            <div className="field-group">
              <label className="field-label">New Password</label>
              <input
                className="field-input"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
              />
            </div>
          </>
        )}

        {(mode === "login" || mode === "signup") && (
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
        )}

        {mode === "login" && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "-6px" }}>
            <button
              type="button"
              className="btn-link"
              style={{
                background: "none",
                border: "none",
                color: "var(--accent)",
                fontSize: "10.5px",
                padding: 0,
                cursor: "pointer",
                textDecoration: "underline",
                fontWeight: 500
              }}
              onClick={() => {
                setMode("forgot")
                setError(null)
                setSuccessMsg(null)
              }}
            >
              Forgot Password?
            </button>
          </div>
        )}

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
          {loading ? "Please wait…" : mode === "login" ? "Log In" : mode === "signup" ? "Create Account" : mode === "forgot" ? "Send Reset Code" : "Reset Password & Log In"}
        </button>
      </form>

      <p className="setup-footer">
        Zero hassle feedback management platform.
      </p>
    </div>
  )
}
