import { useState } from "react"
import { supabase } from "../lib/supabase"
import type { Comment, Reply } from "../types"

interface Props {
  comment: Comment
  onResolve: () => void
}

export function CommentThread({ comment, onResolve }: Props) {
  const [reply, setReply] = useState("")
  const [sending, setSending] = useState(false)
  const [expanded, setExpanded] = useState(true)

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

  return (
    <div className={`comment-card ${comment.status}`}>
      {/* Header Row */}
      <div className="comment-header" onClick={() => setExpanded(p => !p)} style={{ cursor: "pointer" }}>
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
          {/* Page & Position */}
          <div className="comment-meta-row">
            <span className="meta-tag" style={{ display: "inline-flex", alignItems: "center" }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-file-text" style={{ marginRight: "3px" }}><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
              {comment.page_path}
            </span>
            <span className="meta-tag" style={{ display: "inline-flex", alignItems: "center" }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-map-pin" style={{ marginRight: "3px" }}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="12" r="3"/></svg>
              {Math.round(comment.x_percent)}% × {Math.round(comment.y_percent)}%
            </span>
          </div>

          {/* Body */}
          <p className="comment-body">"{comment.body}"</p>

          {/* Client email */}
          <a href={`mailto:${comment.client_email}`} className="client-email">
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
