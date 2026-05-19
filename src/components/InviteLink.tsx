import { useState } from "react"
import { framer } from "framer-plugin"
import { supabase } from "../lib/supabase"

interface Props {
  token: string
  projectId: string
  siteUrl: string | null
  plan?: string
}

export function InviteLink({ token, projectId, siteUrl, plan = "free" }: Props) {
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  // Build the correct invite URL using the user's settings
  const baseUrl = siteUrl ? (siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`) : ""
  const inviteUrl = baseUrl ? `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}af_token=${token}` : ""

  function copyLink() {
    if (!inviteUrl) return
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    framer.notify("Review link copied to clipboard!", { variant: "success", durationMs: 2000 })
    setTimeout(() => setCopied(false), 2500)
  }

  async function regenerateToken() {
    if (plan === "free") {
      framer.notify("⚠️ Regenerating review tokens is a Pro feature! Upgrade to revoke links.", { variant: "info" })
      return
    }
    setRegenerating(true)
    const newToken = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("")

    await supabase
      .from("projects")
      .update({ invite_token: newToken })
      .eq("id", projectId)

    setRegenerating(false)
    window.location.reload()
  }

  return (
    <div className="invite-panel">
      <div className="invite-header">
        <h3 className="invite-title" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-link" style={{ color: "var(--accent)" }}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          Client Review Link
        </h3>
        <p className="invite-desc">
          Share this with your client. They click it, land on your live site, and can
          immediately start pinning comments — <strong>no account needed.</strong>
        </p>
      </div>

      {/* Link Box */}
      {inviteUrl ? (
        <div className="link-box">
          <span className="link-text">{inviteUrl}</span>
          <button className={`btn-copy ${copied ? "copied" : ""}`} onClick={copyLink} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
            {copied ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check"><polyline points="20 6 9 17 4 12"/></svg>
                Copied!
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                Copy
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="auth-error" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-alert-triangle"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
          <span><strong>Site URL not set.</strong> Please go to the <strong>Settings</strong> tab and enter your published Framer site URL first.</span>
        </div>
      )}

      {/* How it works */}
      <div className="how-it-works">
        <div className="step-item">
          <span className="step-num">1</span>
          <span className="step-text">Client opens the link</span>
        </div>
        <div className="step-item">
          <span className="step-num">2</span>
          <span className="step-text">A toolbar appears on the live site</span>
        </div>
        <div className="step-item">
          <span className="step-num">3</span>
          <span className="step-text">They click anything to leave a pin comment</span>
        </div>
        <div className="step-item">
          <span className="step-num">4</span>
          <span className="step-text">You get notified instantly here</span>
        </div>
      </div>

      {/* Tips */}
      <div className="invite-tips" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <div className="tip" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-lightbulb" style={{ color: "var(--yellow)" }}><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A5 5 0 0 0 8 8c0 1 .5 2.2 1.5 3.5.7.7 1.5 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
          Send via email, Slack, or Notion
        </div>
        <div className="tip" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-lock" style={{ color: "var(--text-sub)" }}><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Only link holders can comment
        </div>
      </div>

      {/* Regenerate */}
      <button
        className="btn-ghost btn-sm"
        onClick={regenerateToken}
        disabled={regenerating}
        style={{ 
          display: "inline-flex", 
          alignItems: "center", 
          gap: "6px", 
          justifyContent: "center",
          opacity: plan === "free" ? 0.75 : 1,
          cursor: plan === "free" ? "default" : "pointer"
        }}
      >
        {plan === "free" ? (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent)" }}><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <span>🔒 Regenerate token (Pro Plan)</span>
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-refresh-cw"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
            <span>{regenerating ? "Regenerating…" : "Regenerate token (revokes old link)"}</span>
          </>
        )}
      </button>
    </div>
  )
}
