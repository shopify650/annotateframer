import { useState } from "react"
import { supabase } from "../lib/supabase"
import type { Comment, Reply } from "../types"

interface Props {
  comment: Comment
  onResolve: () => void
  siteUrl?: string | null
  inviteToken?: string
}

export function CommentThread({ comment, onResolve, siteUrl, inviteToken }: Props) {
  const [reply, setReply] = useState("")
  const [sending, setSending] = useState(false)
  const [expanded, setExpanded] = useState(comment.status !== "resolved")
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return "just now"
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  async function sendReply() {
    if (!reply.trim()) return
    setSending(true)
    await supabase.from("replies").insert({
      comment_id: comment.id,
      author: "Agency",
      body: reply.trim(),
    })
    setReply("")
    setSending(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendReply()
  }

  const baseUrl = siteUrl ? (siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`) : ""
  const deepLink = baseUrl ? `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}af_token=${inviteToken}&highlight_id=${comment.id}` : ""

  return (
    <div className={`comment-card ${comment.status}`}>
      {/* Header Row */}
      <div
        className="comment-header"
        onClick={() => setExpanded(p => !p)}
        style={{ cursor: "pointer", borderBottom: expanded ? "1px solid var(--border)" : "none" }}
      >
        <div className="comment-header-left">
          <div className="avatar">{comment.client_name.charAt(0).toUpperCase()}</div>
          <div className="comment-meta">
            <span className="client-name">{comment.client_name}</span>
            <span className="comment-time">{timeAgo(comment.created_at)}</span>
          </div>
        </div>
        <div className="comment-header-right">
          <span className={`status-pill ${comment.status}`} style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
            {comment.status === "open" ? (
              "Open"
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check"><polyline points="20 6 9 17 4 12"/></svg>
                Done
              </>
            )}
          </span>
          <span className="expand-icon" style={{ display: "inline-flex", alignItems: "center" }}>
            {expanded ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-up"><path d="m18 15-6-6-6 6"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-down"><path d="m6 9 6 6 6-6"/></svg>
            )}
          </span>
        </div>
      </div>

      {expanded && (
        <>
          {/* Page, Position & View on Site */}
          <div className="comment-meta-row" style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            <span className="meta-tag" style={{ display: "inline-flex", alignItems: "center" }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-file-text" style={{ marginRight: "3px" }}><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
              {comment.page_path}
            </span>
            <span className="meta-tag" style={{ display: "inline-flex", alignItems: "center" }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-map-pin" style={{ marginRight: "3px" }}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="12" r="3"/></svg>
              {Math.round(comment.x_percent)}% × {Math.round(comment.y_percent)}%
            </span>
            {deepLink && (
              <a
                href={deepLink}
                target="_blank"
                rel="noreferrer"
                className="meta-tag view-site-tag"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  textDecoration: "none",
                  color: "var(--accent)",
                  fontWeight: "600",
                  background: "var(--accent-dim)",
                  border: "1px solid var(--accent-dim)"
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-external-link" style={{ marginRight: "3px" }}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                View on Site
              </a>
            )}
          </div>

          {/* Body */}
          <p className="comment-body">"{comment.body}"</p>

          {/* Screenshot Preview Element */}
          {comment.screenshot && (
            <div
              className="comment-screenshot-preview"
              onClick={() => setLightboxOpen(true)}
              style={{
                marginTop: "10px",
                position: "relative",
                borderRadius: "8px",
                overflow: "hidden",
                border: "1px solid var(--border)",
                cursor: "pointer",
                maxHeight: "120px"
              }}
            >
              <img
                src={comment.screenshot}
                style={{ width: "100%", height: "120px", objectFit: "cover", display: "block" }}
                alt="Element Snapshot"
              />
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: "var(--surface)",
                  backdropFilter: "blur(4px)",
                  padding: "4px 8px",
                  fontSize: "10px",
                  color: "var(--text-sub)",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-zoom-in"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/></svg>
                Target Element Screenshot (Click to enlarge)
              </div>
            </div>
          )}

          {/* Lightbox Modal */}
          {lightboxOpen && comment.screenshot && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 2147483647,
                background: "var(--bg)",
                backdropFilter: "blur(20px)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "24px"
              }}
              onClick={() => setLightboxOpen(false)}
            >
              <div
                style={{
                  position: "absolute",
                  top: "20px",
                  right: "20px",
                  background: "var(--surface2)",
                  border: "none",
                  color: "var(--text)",
                  padding: "8px 16px",
                  borderRadius: "100px",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
                Close
              </div>
              <img
                src={comment.screenshot}
                style={{
                  maxWidth: "95%",
                  maxHeight: "80vh",
                  borderRadius: "12px",
                  border: "1px solid var(--border-hi)",
                  boxShadow: "0 12px 64px rgba(0,0,0,0.5)"
                }}
                alt="Full Snapshot"
              />
              <p style={{ marginTop: "16px", color: "var(--text-sub)", fontSize: "12px", textAlign: "center" }}>
                Target element snapshot for comment by <strong>{comment.client_name}</strong>
              </p>
            </div>
          )}

          {/* Client email */}
          <a href={`mailto:${comment.client_email}`} className="client-email" style={{ marginTop: "10px", display: "inline-block" }}>
            {comment.client_email}
          </a>

          {/* Replies */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="replies-list">
              {comment.replies.map((r: Reply) => (
                <div key={r.id} className={`reply-item ${r.author === "Agency" ? "reply-agency" : "reply-client"}`}>
                  <span className="reply-author">{r.author}</span>
                  <span className="reply-body">{r.body}</span>
                  <span className="reply-time">{timeAgo(r.created_at)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Reply Input */}
          {comment.status === "open" && (
            <div className="reply-section">
              <textarea
                className="reply-textarea"
                value={reply}
                onChange={e => setReply(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Reply to client… (⌘+Enter to send)"
                rows={2}
              />
              <div className="reply-actions">
                <button
                  className="btn-reply"
                  onClick={sendReply}
                  disabled={sending || !reply.trim()}
                >
                  {sending ? "Sending…" : "Reply"}
                </button>
                <button className="btn-resolve" onClick={onResolve} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check"><polyline points="20 6 9 17 4 12"/></svg>
                  Resolve
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
