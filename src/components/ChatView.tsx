import { useState, useEffect, useRef } from "react"
import { supabase } from "../lib/supabase"
import type { Comment, Reply } from "../types"

interface Props {
  comment: Comment
  onClose: () => void
  onResolve: () => void
  onReply: () => void
  siteUrl?: string | null
  inviteToken?: string
}

export function ChatView({ comment, onClose, onResolve, onReply, siteUrl, inviteToken }: Props) {
  const [reply, setReply] = useState("")
  const [sending, setSending] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const feedRef = useRef<HTMLDivElement>(null)

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return "just now"
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  // Scroll to bottom when replies update
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [comment.replies])

  async function sendReply() {
    if (!reply.trim()) return
    setSending(true)
    try {
      const { data: insertedReply, error: insertError } = await supabase.from("replies").insert({
        comment_id: comment.id,
        author: "Agency",
        body: reply.trim(),
      }).select()

      if (insertError) throw insertError

      // If comment is synced to ClickUp, sync the reply as a comment
      if (comment.clickup_synced && comment.clickup_task_id) {
        const { data: { session: authSession } } = await supabase.auth.getSession()
        if (authSession && insertedReply && insertedReply.length > 0) {
          await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clickup-api`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${authSession.access_token}`
            },
            body: JSON.stringify({
              action: "create-comment",
              replyId: insertedReply[0].id
            })
          })
        }
      }

      onReply() // Call onReply callback!
    } catch (err) {
      console.error("[AF] Failed to send reply:", err)
    } finally {
      setReply("")
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendReply()
  }

  const baseUrl = siteUrl ? (siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`) : ""
  const deepLink = baseUrl ? `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}af_token=${inviteToken}&highlight_id=${comment.id}` : ""

  return (
    <div className="chat-view-container" style={{
      position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
      background: "var(--bg)", zIndex: 100, display: "flex", flexDirection: "column"
    }}>
      {/* Header */}
      <div className="chat-view-header" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px", borderBottom: "1px solid var(--border)", background: "var(--surface)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button className="btn-ghost" onClick={onClose} style={{ padding: "4px", display: "flex", alignItems: "center" }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <div className="avatar" style={{ width: "24px", height: "24px", fontSize: "11px" }}>
            {comment.client_name.charAt(0).toUpperCase()}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "12px", fontWeight: "600" }}>{comment.client_name}</span>
            <span style={{ fontSize: "9px", color: "var(--text-sub)" }}>{comment.page_path}</span>
          </div>
        </div>
        
        {comment.status === "open" ? (
          <button className="chat-resolve-btn" onClick={() => { onResolve(); onClose(); }} title="Mark as Done" style={{ height: "26px", padding: "0 10px", fontSize: "10px" }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--green)" }}><polyline points="20 6 9 17 4 12"/></svg>
            Resolve
          </button>
        ) : (
          <span className="status-pill resolved" style={{ padding: "2px 6px" }}>Resolved</span>
        )}
      </div>

      {/* Chat Feed */}
      <div className="chat-feed" ref={feedRef} style={{ flex: 1, overflowY: "auto", borderTop: "none", background: "var(--bg)", gap: "12px", padding: "16px 12px" }}>
        
        {/* Context metadata block */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px", justifyContent: "center" }}>
          <span className="meta-tag" style={{ display: "inline-flex", alignItems: "center" }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-map-pin" style={{ marginRight: "3px" }}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="12" r="3"/></svg>
            {Math.round(comment.x_percent)}% × {Math.round(comment.y_percent)}%
          </span>
          {deepLink && (
            <a href={deepLink} target="_blank" rel="noreferrer" className="meta-tag view-site-tag" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none", color: "var(--accent)", fontWeight: "600", background: "var(--accent-dim)", border: "1px solid var(--accent-dim)" }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-external-link" style={{ marginRight: "3px" }}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              View on Site
            </a>
          )}
        </div>

        {/* Initial Comment (Client) */}
        <div className="chat-bubble-row client">
          <div className="chat-bubble">
            {comment.screenshot && (
              <div onClick={() => setLightboxOpen(true)} style={{ marginBottom: "6px", position: "relative", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border)", cursor: "pointer" }}>
                <img src={comment.screenshot} style={{ width: "100%", height: "80px", objectFit: "cover", display: "block" }} alt="Snapshot" />
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", padding: "2px 6px", fontSize: "9px", color: "#fff", display: "flex", alignItems: "center", gap: "4px" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/></svg>
                  Click to enlarge
                </div>
              </div>
            )}
            {comment.body}
            <span className="chat-time">{timeAgo(comment.created_at)}</span>
          </div>
        </div>

        {/* Replies */}
        {comment.replies && comment.replies.map((r: Reply) => (
          <div key={r.id} className={`chat-bubble-row ${r.author === "Agency" ? "agency" : "client"}`}>
            <div className="chat-bubble">
              {r.body}
              <span className="chat-time">{timeAgo(r.created_at)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Reply Input Sticky Footer */}
      {comment.status === "open" && (
        <div className="reply-section" style={{ borderTop: "1px solid var(--border)", padding: "12px", background: "var(--surface)" }}>
          <div className="reply-input-wrapper">
            <textarea
              className="reply-textarea"
              value={reply}
              onChange={e => setReply(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a reply... (⌘+Enter)"
              rows={1}
              style={{ minHeight: "36px", padding: "10px 0" }}
            />
            <button className="chat-send-btn" onClick={sendReply} disabled={sending || !reply.trim()} title="Send Reply">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" x2="11" y1="2" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxOpen && comment.screenshot && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 2147483647, background: "var(--bg)", backdropFilter: "blur(20px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px" }} onClick={() => setLightboxOpen(false)}>
          <div style={{ position: "absolute", top: "20px", right: "20px", background: "var(--surface2)", border: "none", color: "var(--text)", padding: "8px 16px", borderRadius: "100px", fontSize: "12px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
            Close
          </div>
          <img src={comment.screenshot} style={{ maxWidth: "95%", maxHeight: "80vh", borderRadius: "12px", border: "1px solid var(--border-hi)", boxShadow: "0 12px 64px rgba(0,0,0,0.5)" }} alt="Full Snapshot" />
        </div>
      )}
    </div>
  )
}
