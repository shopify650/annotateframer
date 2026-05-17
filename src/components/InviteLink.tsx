import { useState } from "react"
import { supabase } from "../lib/supabase"

interface Props {
  token: string
  projectId: string
  siteUrl: string | null
}

export function InviteLink({ token, projectId, siteUrl }: Props) {
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  // Build the correct invite URL using the user's settings
  const baseUrl = siteUrl ? (siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`) : ""
  const inviteUrl = baseUrl ? `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}af_token=${token}` : ""

  function copyLink() {
    if (!inviteUrl) return
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  async function regenerateToken() {
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
        <h3 className="invite-title">🔗 Client Review Link</h3>
        <p className="invite-desc">
          Share this with your client. They click it, land on your live site, and can
          immediately start pinning comments — <strong>no account needed.</strong>
        </p>
      </div>

      {/* Link Box */}
      {inviteUrl ? (
        <div className="link-box">
          <span className="link-text">{inviteUrl}</span>
          <button className={`btn-copy ${copied ? "copied" : ""}`} onClick={copyLink}>
            {copied ? "✅ Copied!" : "📋 Copy"}
          </button>
        </div>
      ) : (
        <div className="auth-error">
          ⚠️ <strong>Site URL not set.</strong> Please go to the <strong>Settings</strong> tab and enter your published Framer site URL first.
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
      <div className="invite-tips">
        <div className="tip">💡 Send via email, Slack, or Notion</div>
        <div className="tip">🔒 Only link holders can comment</div>
      </div>

      {/* Regenerate */}
      <button
        className="btn-ghost btn-sm"
        onClick={regenerateToken}
        disabled={regenerating}
      >
        {regenerating ? "Regenerating…" : "♻️ Regenerate token (revokes old link)"}
      </button>
    </div>
  )
}
