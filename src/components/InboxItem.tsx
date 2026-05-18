import type { Comment } from "../types"

interface Props {
  comment: Comment
  onClick: () => void
}

export function InboxItem({ comment, onClick }: Props) {
  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return "just now"
    if (mins < 60) return `${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h`
    return `${Math.floor(hrs / 24)}d`
  }

  // Determine latest message
  const lastMessage = comment.replies && comment.replies.length > 0 
    ? comment.replies[comment.replies.length - 1].body 
    : comment.body

  const unread = comment.status === "open" // For visual pop

  return (
    <div 
      className={`inbox-item ${comment.status}`} 
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "10px",
        padding: "12px",
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        cursor: "pointer",
        transition: "background 0.2s"
      }}
    >
      <div className="avatar" style={{ width: "32px", height: "32px", fontSize: "14px", flexShrink: 0 }}>
        {comment.client_name.charAt(0).toUpperCase()}
      </div>
      
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "12px", fontWeight: unread ? "700" : "600", color: unread ? "var(--text)" : "var(--text-sub)" }}>
            {comment.client_name}
          </span>
          <span style={{ fontSize: "10px", color: "var(--text-sub)" }}>
            {timeAgo(comment.created_at)}
          </span>
        </div>
        
        <span style={{ 
          fontSize: "11px", 
          color: unread ? "var(--text)" : "var(--text-sub)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          lineHeight: "1.4"
        }}>
          {lastMessage}
        </span>
        
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
          <span className={`status-pill ${comment.status}`} style={{ fontSize: "8.5px", padding: "1px 6px" }}>
            {comment.status === "open" ? "Open" : "Resolved"}
          </span>
          <span style={{ fontSize: "9px", color: "var(--text-sub)" }}>
            {comment.page_path}
          </span>
        </div>
      </div>
    </div>
  )
}
