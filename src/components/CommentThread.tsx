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

          {/* Chat Feed */}
          <div className="chat-feed">
            {/* Initial Comment (Client) */}
            <div className="chat-bubble-row client">
              <div className="chat-bubble">
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

          {/* Reply Input */}
          {comment.status === "open" && (
            <div className="reply-section">
              <div className="reply-input-wrapper">
                <textarea
                  className="reply-textarea"
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a reply... (⌘+Enter)"
                  rows={1}
                  style={{ minHeight: "32px" }}
                />
                <button
                  className="chat-send-btn"
                  onClick={sendReply}
                  disabled={sending || !reply.trim()}
                  title="Send Reply"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" x2="11" y1="2" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
              </div>
              <button className="chat-resolve-btn" onClick={onResolve} title="Mark as Done">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--green)" }}><polyline points="20 6 9 17 4 12"/></svg>
                Done
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
