import type { Comment } from "../types"

interface Props {
  comment: Comment
  onClick: () => void
  onDelete?: (id: string) => void
  plan: string
}

export function InboxItem({ comment, onClick, onDelete, plan }: Props) {
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

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onDelete) {
      onDelete(comment.id)
    }
  }

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
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "10px", color: "var(--text-sub)" }}>
              {timeAgo(comment.created_at)}
            </span>
            {comment.status === "resolved" && plan !== "free" && (
              <button
                onClick={handleDeleteClick}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--red)",
                  cursor: "pointer",
                  padding: "2px 4px",
                  fontSize: "10px",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  gap: "2px"
                }}
                title="Delete comment"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            )}
          </div>
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
