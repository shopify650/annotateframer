// ==============================================
// ANNOTATEFRAME CLIENT SCRIPT v1.1
// Self-contained vanilla TS — injected into live Framer sites
// Build: npx esbuild src/index.ts --bundle --minify --outfile=build/annotateframe.min.js --platform=browser
// ==============================================

interface CommentPayload {
  project_id: string
  x_percent: number
  y_percent: number
  page_path: string
  client_name: string
  client_email: string
  body: string
  browser: string
  viewport_w: number
}

class AnnotateFrame {
  private projectId: string
  private supabaseUrl: string
  private anonKey: string
  private isActive = false
  private clickHandler: ((e: MouseEvent) => void) | null = null
  private toolbar: HTMLElement | null = null
  private modal: HTMLElement | null = null
  private comments: any[] = [] // Store loaded comments

  constructor() {
    console.log("[AF] Initializing AnnotateFrame...");
    const w = window as any
    this.projectId  = w.ANNOTATEFRAME_PROJECT_ID   || ""
    this.supabaseUrl = w.ANNOTATEFRAME_SUPABASE_URL || ""
    this.anonKey    = w.ANNOTATEFRAME_ANON_KEY      || ""

    if (!this.projectId || !this.supabaseUrl || !this.anonKey) {
      console.error("[AF] Missing configuration. Check if the script is properly injected.");
      console.log("[AF] Debug - Project ID:", this.projectId);
      console.log("[AF] Debug - Supabase URL:", this.supabaseUrl);
      console.log("[AF] Debug - Anon Key:", this.anonKey ? "Present (Length: " + this.anonKey.length + ")" : "MISSING");
      return
    }

    console.log("[AF] Debug - Supabase URL:", this.supabaseUrl);
    console.log("[AF] Debug - Anon Key:", this.anonKey ? this.anonKey.substring(0, 15) + "..." : "MISSING");
    this.init()
  }

  private init() {
    console.log("[AF] Script loaded for project:", this.projectId);
    const token = new URLSearchParams(window.location.search).get("af_token")
    if (token) {
      console.log("[AF] af_token detected, validating...");
      this.validateToken(token)
      const clean = new URL(window.location.href)
      clean.searchParams.delete("af_token")
      history.replaceState({}, "", clean.toString())
    }

    if (localStorage.getItem("af_active") === "true") {
      this.activate()
    }

    this.loadExistingPins()
  }

  private async validateToken(token: string) {
    try {
      const res = await fetch(
        `${this.supabaseUrl}/rest/v1/projects?invite_token=eq.${encodeURIComponent(token)}&select=id`,
        { headers: { apikey: this.anonKey, Authorization: `Bearer ${this.anonKey}` } }
      )
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        localStorage.setItem("af_active", "true")
        this.activate()
      } else {
        this.showToast("❌ Invalid review link", "#ef4444")
      }
    } catch (e) {
      console.error("[AF] Token validation failed error:", e);
    }
  }

  private activate() {
    this.isActive = true
    this.injectStyles()
    this.createToolbar()
    document.body.style.cursor = "crosshair"
    this.clickHandler = (e: MouseEvent) => this.handleClick(e)
    document.addEventListener("click", this.clickHandler, true)
    this.loadExistingPins() // Reload pins when activated
  }

  private deactivate() {
    this.isActive = false
    localStorage.removeItem("af_active")
    document.body.style.cursor = ""
    this.toolbar?.remove()
    this.modal?.remove()
    if (this.clickHandler) document.removeEventListener("click", this.clickHandler, true)
    document.querySelectorAll(".af-pin").forEach(p => p.remove())
  }

  private injectStyles() {
    if (document.getElementById("af-styles")) return
    const style = document.createElement("style")
    style.id = "af-styles"
    style.textContent = `
      #af-toolbar {
        position: fixed; bottom: 24px; right: 24px; z-index: 2147483640;
        display: flex; align-items: center; gap: 10px;
        background: rgba(15,15,20,0.92); backdrop-filter: blur(12px);
        color: #e8e8ed; padding: 10px 16px;
        border-radius: 100px; font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
        font-size: 13px; font-weight: 500;
        box-shadow: 0 4px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08);
        user-select: none;
      }
      #af-toolbar .af-pin-icon { font-size: 16px; }
      #af-toolbar .af-label    { flex: 1; }
      #af-exit-btn {
        background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.12);
        color: #e8e8ed; padding: 4px 10px; border-radius: 100px;
        cursor: pointer; font-size: 11px; font-family: inherit;
        transition: background 0.2s;
      }
      #af-exit-btn:hover { background: rgba(255,255,255,0.18); }

      #af-modal-wrap {
        position: fixed; z-index: 2147483641;
        background: rgba(22,22,28,0.97); backdrop-filter: blur(16px);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 16px; padding: 18px; width: 320px;
        box-shadow: 0 8px 48px rgba(0,0,0,0.6);
        font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
        max-height: 80vh; display: flex; flex-direction: column;
      }
      #af-modal-wrap h3 {
        font-size: 14px; font-weight: 700; color: #e8e8ed; margin: 0 0 12px 0;
        display: flex; justify-content: space-between; align-items: center;
      }
      .af-status-pill {
        font-size: 10px; padding: 2px 8px; border-radius: 100px; font-weight: 600; text-transform: uppercase;
      }
      .af-status-open { background: rgba(245, 158, 11, 0.2); color: #fcd34d; border: 1px solid rgba(245, 158, 11, 0.3); }
      .af-status-resolved { background: rgba(34, 197, 94, 0.2); color: #86efac; border: 1px solid rgba(34, 197, 94, 0.3); }

      .af-field {
        width: 100%; padding: 8px 10px;
        background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px; color: #e8e8ed; font-size: 13px; font-family: inherit;
        box-sizing: border-box; outline: none; margin-bottom: 8px;
        transition: border-color 0.2s;
      }
      .af-field:focus { border-color: #6c63ff; }
      .af-field::placeholder { color: rgba(255,255,255,0.3); }
      .af-textarea { resize: none; }
      
      .af-modal-actions {
        display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;
      }
      .af-btn-cancel, .af-btn-close {
        padding: 7px 14px; background: transparent;
        border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.6);
        border-radius: 8px; cursor: pointer; font-size: 13px; font-family: inherit;
      }
      .af-btn-submit {
        padding: 7px 16px; background: #6c63ff; border: none;
        color: #fff; border-radius: 8px; cursor: pointer;
        font-size: 13px; font-weight: 600; font-family: inherit;
        transition: opacity 0.2s;
      }
      .af-btn-submit:hover   { opacity: 0.85; }
      .af-btn-submit:disabled{ opacity: 0.45; cursor: not-allowed; }

      .af-pin {
        position: absolute;
        width: 24px; height: 24px; border-radius: 50% 50% 50% 0;
        background: #6c63ff; transform: rotate(-45deg);
        z-index: 2147483638; cursor: pointer; pointer-events: auto;
        box-shadow: 0 2px 12px rgba(108,99,255,0.6);
        animation: af-pin-drop 0.3s cubic-bezier(0.34,1.56,0.64,1);
        transition: transform 0.2s, background 0.2s;
      }
      .af-pin:hover { transform: rotate(-45deg) scale(1.1); }
      .af-pin.resolved { background: #22c55e; box-shadow: 0 2px 12px rgba(34,197,94,0.6); }

      /* Thread Styles */
      .af-thread-scroll {
        overflow-y: auto; padding-right: 4px; margin-bottom: 12px;
        display: flex; flex-direction: column; gap: 12px;
      }
      .af-message {
        background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
        padding: 10px; border-radius: 8px;
      }
      .af-message.agency { background: rgba(108,99,255,0.1); border-color: rgba(108,99,255,0.2); }
      .af-msg-header { display: flex; justify-content: space-between; font-size: 11px; color: rgba(255,255,255,0.4); margin-bottom: 4px; }
      .af-msg-author { font-weight: 600; color: #e8e8ed; }
      .af-message.agency .af-msg-author { color: #a5b4fc; }
      .af-msg-body { font-size: 13px; line-height: 1.4; color: rgba(255,255,255,0.85); margin: 0; white-space: pre-wrap; }

      .af-toast {
        position: fixed; bottom: 80px; right: 24px; z-index: 2147483645;
        color: #fff; padding: 10px 18px; border-radius: 100px;
        font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
        font-size: 13px; font-weight: 500;
        box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        animation: af-toast-in 0.3s ease;
      }
      @keyframes af-toast-in {
        from { opacity: 0; transform: translateY(12px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `
    document.head.appendChild(style)
  }

  private createToolbar() {
    this.toolbar?.remove()
    const t = document.createElement("div")
    t.id = "af-toolbar"
    t.innerHTML = `
      <span class="af-pin-icon">📌</span>
      <span class="af-label">Click anywhere to comment</span>
      <button id="af-exit-btn">Exit</button>
    `
    document.body.appendChild(t)
    this.toolbar = t
    document.getElementById("af-exit-btn")?.addEventListener("click", e => {
      e.stopPropagation()
      this.deactivate()
    })
  }

  private handleClick(e: MouseEvent) {
    if (!this.isActive) return
    const target = e.target as HTMLElement
    if (target.closest("#af-toolbar") || target.closest("#af-modal-wrap") || target.closest(".af-pin")) return

    e.preventDefault()
    e.stopPropagation()

    const xPct = (e.clientX / window.innerWidth) * 100
    const yPct = ((e.clientY + window.scrollY) / document.documentElement.scrollHeight) * 100
    this.showNewCommentModal(xPct, yPct, e.clientX, e.clientY)
  }

  private showNewCommentModal(xPct: number, yPct: number, cx: number, cy: number) {
    this.modal?.remove()

    const safeLeft = Math.min(cx + 14, window.innerWidth  - 336)
    const safeTop  = Math.min(cy + 14, window.innerHeight - 280)

    const wrap = document.createElement("div")
    wrap.id = "af-modal-wrap"
    wrap.style.left = `${safeLeft}px`
    wrap.style.top  = `${safeTop}px`
    
    // Auto-fill previous name/email if stored
    const savedName = localStorage.getItem("af_name") || ""
    const savedEmail = localStorage.getItem("af_email") || ""

    wrap.innerHTML = `
      <h3>📌 Leave a Comment</h3>
      <input  id="af-name"  class="af-field" placeholder="Your name" value="${savedName}" />
      <input  id="af-email" class="af-field" type="email" placeholder="Your email" value="${savedEmail}" />
      <textarea id="af-body" class="af-field af-textarea" rows="3" placeholder="What would you like to change?"></textarea>
      <div class="af-modal-actions">
        <button class="af-btn-cancel" id="af-cancel">Cancel</button>
        <button class="af-btn-submit" id="af-submit">Submit →</button>
      </div>
    `
    document.body.appendChild(wrap)
    this.modal = wrap
    ;(document.getElementById("af-body") as HTMLTextAreaElement)?.focus()

    document.getElementById("af-cancel")?.addEventListener("click", () => wrap.remove())
    document.getElementById("af-submit")?.addEventListener("click", () =>
      this.submitComment(xPct, yPct, wrap)
    )
  }

  private showThreadModal(commentId: string, cx: number, cy: number) {
    this.modal?.remove()
    const comment = this.comments.find(c => c.id === commentId)
    if (!comment) return

    const safeLeft = Math.min(cx + 14, window.innerWidth  - 336)
    const safeTop  = Math.min(cy + 14, window.innerHeight - 380)

    const wrap = document.createElement("div")
    wrap.id = "af-modal-wrap"
    wrap.style.left = `${safeLeft}px`
    wrap.style.top  = `${safeTop}px`
    
    const isResolved = comment.status === "resolved"
    const statusPill = isResolved 
      ? '<span class="af-status-pill af-status-resolved">✅ Resolved</span>'
      : '<span class="af-status-pill af-status-open">⏳ Open</span>'

    let repliesHtml = ""
    if (comment.replies && comment.replies.length > 0) {
      repliesHtml = comment.replies.map((r: any) => {
        return '<div class="af-message ' + (r.author === 'Agency' ? 'agency' : '') + '">' +
          '<div class="af-msg-header">' +
            '<span class="af-msg-author">' + r.author + '</span>' +
            '<span>' + new Date(r.created_at).toLocaleDateString() + '</span>' +
          '</div>' +
          '<p class="af-msg-body">' + r.body + '</p>' +
        '</div>';
      }).join("")
    }

    const replyInputHtml = !isResolved ? '<textarea id="af-reply-body" class="af-field af-textarea" rows="2" placeholder="Write a reply..."></textarea>' : '';
    const replyBtnHtml = !isResolved ? '<button class="af-btn-submit" id="af-send-reply">Reply →</button>' : '';

    wrap.innerHTML = `
      <h3>
        <span>Thread</span>
        ${statusPill}
      </h3>
      
      <div class="af-thread-scroll">
        <div class="af-message">
          <div class="af-msg-header">
            <span class="af-msg-author">${comment.client_name}</span>
            <span>${new Date(comment.created_at).toLocaleDateString()}</span>
          </div>
          <p class="af-msg-body">${comment.body}</p>
        </div>
        ${repliesHtml}
      </div>

      ${replyInputHtml}
      
      <div class="af-modal-actions">
        <button class="af-btn-close" id="af-close">Close</button>
        ${replyBtnHtml}
      </div>
    `
    document.body.appendChild(wrap)
    this.modal = wrap

    document.getElementById("af-close")?.addEventListener("click", () => wrap.remove())
    if (!isResolved) {
      document.getElementById("af-send-reply")?.addEventListener("click", () => this.submitReply(comment.id, wrap))
    }
  }

  private async submitComment(xPct: number, yPct: number, modal: HTMLElement) {
    const name  = (document.getElementById("af-name")  as HTMLInputElement)?.value.trim()
    const email = (document.getElementById("af-email") as HTMLInputElement)?.value.trim()
    const body  = (document.getElementById("af-body")  as HTMLTextAreaElement)?.value.trim()

    if (!name || !email || !body) { this.showToast("⚠️ Please fill all fields", "#f59e0b"); return }

    // Save for next time
    localStorage.setItem("af_name", name)
    localStorage.setItem("af_email", email)

    const btn = document.getElementById("af-submit") as HTMLButtonElement
    btn.disabled = true; btn.textContent = "Sending…"

    const payload: CommentPayload = {
      project_id:  this.projectId,
      x_percent:   xPct,
      y_percent:   yPct,
      page_path:   window.location.pathname,
      client_name: name,
      client_email: email,
      body,
      browser:     navigator.userAgent.slice(0, 120),
      viewport_w:  window.innerWidth,
    }

    try {
      const res = await fetch(`${this.supabaseUrl}/rest/v1/comments`, {
        method: "POST",
        headers: {
          apikey: this.anonKey,
          Authorization: `Bearer ${this.anonKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation", // Get the created record back
        },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const data = await res.json()
        if (data && data[0]) {
          const newComment = { ...data[0], replies: [] }
          this.comments.push(newComment)
          modal.remove()
          this.dropPin(newComment)
          this.showToast("✅ Comment sent!", "#22c55e")
        }
      } else {
        this.showToast("❌ Failed to send. Try again.", "#ef4444")
        btn.disabled = false; btn.textContent = "Submit →"
      }
    } catch {
      this.showToast("❌ Network error. Try again.", "#ef4444")
      btn.disabled = false; btn.textContent = "Submit →"
    }
  }

  private async submitReply(commentId: string, modal: HTMLElement) {
    const body = (document.getElementById("af-reply-body") as HTMLTextAreaElement)?.value.trim()
    if (!body) return
    
    const btn = document.getElementById("af-send-reply") as HTMLButtonElement
    btn.disabled = true; btn.textContent = "Sending…"
    
    const clientName = localStorage.getItem("af_name") || "Client"

    try {
      const res = await fetch(`${this.supabaseUrl}/rest/v1/replies`, {
        method: "POST",
        headers: {
          apikey: this.anonKey,
          Authorization: `Bearer ${this.anonKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          comment_id: commentId,
          author: clientName,
          body: body
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data && data[0]) {
          // Update local memory
          const comment = this.comments.find(c => c.id === commentId)
          if (comment) {
            comment.replies = comment.replies || []
            comment.replies.push(data[0])
          }
          modal.remove()
          this.showToast("✅ Reply sent!", "#22c55e")
        }
      } else {
        this.showToast("❌ Failed to send. Try again.", "#ef4444")
        btn.disabled = false; btn.textContent = "Reply →"
      }
    } catch {
      this.showToast("❌ Network error. Try again.", "#ef4444")
      btn.disabled = false; btn.textContent = "Reply →"
    }
  }

  private dropPin(comment: any) {
    const pin = document.createElement("div")
    pin.className = "af-pin " + (comment.status === 'resolved' ? 'resolved' : '')
    const absY = (comment.y_percent / 100) * document.documentElement.scrollHeight
    pin.style.cssText = "left: calc(" + comment.x_percent + "% - 12px); top: " + (absY - 12) + "px;"
    
    // Add click listener to pin
    pin.addEventListener("click", (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.showThreadModal(comment.id, e.clientX, e.clientY)
    })
    
    document.body.appendChild(pin)
  }

  private async loadExistingPins() {
    if (localStorage.getItem("af_active") !== "true") return
    
    // Clear existing pins
    document.querySelectorAll(".af-pin").forEach(p => p.remove())
    this.comments = []

    try {
      // Fetch ALL comments for this project AND this specific page path, along with their replies
      const currentPath = window.location.pathname
      const url = this.supabaseUrl + "/rest/v1/comments?select=*,replies(*)&project_id=eq." + this.projectId + "&page_path=eq." + currentPath
      
      const res = await fetch(url, { 
        headers: { apikey: this.anonKey, Authorization: "Bearer " + this.anonKey } 
      })
      
      const data = await res.json()
      if (Array.isArray(data)) {
        this.comments = data
        this.comments.forEach((c: any) => this.dropPin(c))
      }
    } catch (e) { 
      console.error("[AF] Failed to load pins", e)
    }
  }

  private showToast(msg: string, bg: string) {
    const t = document.createElement("div")
    t.className = "af-toast"
    t.style.background = bg
    t.textContent = msg
    document.body.appendChild(t)
    setTimeout(() => t.remove(), 3500)
  }
}

// Auto-init on DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => new AnnotateFrame())
} else {
  new AnnotateFrame()
}
