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
          <span className={`status-pill ${comment.status}`}>
            {comment.status === "open" ? "Open" : "✅ Done"}
          </span>
          <span className="expand-icon">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {expanded && (
        <>
          {/* Page & Position */}
          <div className="comment-meta-row">
            <span className="meta-tag">📄 {comment.page_path}</span>
            <span className="meta-tag">
              📍 {Math.round(comment.x_percent)}% × {Math.round(comment.y_percent)}%
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
                <button className="btn-resolve" onClick={onResolve}>
                  ✅ Resolve
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
