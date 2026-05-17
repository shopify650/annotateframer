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

  // Element Selection & Screenshot properties
  private isSelectionMode = false
  private hoveredEl: HTMLElement | null = null
  private selectedEl: HTMLElement | null = null
  private triggerBtn: HTMLElement | null = null
  private highlightOverlay: HTMLElement | null = null
  private currentScreenshot: string = ""

  constructor() {
    console.log("[AF] Initializing AnnotateFrame...");
    const w = window as any
    this.projectId  = w.ANNOTATEFRAME_PROJECT_ID   || ""
    this.supabaseUrl = w.ANNOTATEFRAME_SUPABASE_URL || ""
    this.anonKey    = w.ANNOTATEFRAME_ANON_KEY      || ""

    if (!this.projectId || !this.supabaseUrl || !this.anonKey) {
      console.error("[AF] Missing configuration. Check if the script is properly injected.");
      return
    }

    this.init()
  }

  private init() {
    console.log("[AF] Script loaded for project:", this.projectId);
    const params = new URLSearchParams(window.location.search)
    const token = params.get("af_token")
    if (token) {
      console.log("[AF] af_token detected, validating...");
      this.validateToken(token)
      const clean = new URL(window.location.href)
      clean.searchParams.delete("af_token")
      history.replaceState({}, "", clean.toString())
    }

    if (localStorage.getItem("af_active") === "true") {
      this.activate()
      const highlightId = params.get("highlight_id")
      if (highlightId) {
        // Delay scroll slightly to ensure page layout is finished
        setTimeout(() => this.highlightCommentOnLoad(highlightId), 800)
      }
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
        // Check if there is an active highlight in url too
        const highlightId = new URLSearchParams(window.location.search).get("highlight_id")
        if (highlightId) {
          setTimeout(() => this.highlightCommentOnLoad(highlightId), 800)
        }
      } else {
        this.showToast("❌ Invalid review link", "#ef4444")
      }
    } catch (e) {
      console.error("[AF] Token validation failed error:", e);
    }
  }

  private loadHtml2Canvas(): Promise<any> {
    return new Promise((resolve) => {
      const w = window as any
      if (w.html2canvas) {
        resolve(w.html2canvas)
        return
      }
      const script = document.createElement("script")
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"
      script.onload = () => resolve(w.html2canvas)
      document.head.appendChild(script)
    })
  }

  private activate() {
    this.injectStyles()
    this.createTriggerButton()
    this.loadExistingPins()
  }

  private deactivate() {
    this.stopSelectionMode()
    localStorage.removeItem("af_active")
    this.triggerBtn?.remove()
    document.querySelectorAll(".af-pin").forEach(p => p.remove())
    if (this.highlightOverlay) this.highlightOverlay.remove()
  }

  private createTriggerButton() {
    this.triggerBtn?.remove()
    const btn = document.createElement("button")
    btn.id = "af-feedback-trigger"
    btn.textContent = "Leave Feedback"
    document.body.appendChild(btn)
    this.triggerBtn = btn
    btn.addEventListener("click", (e) => {
      e.stopPropagation()
      this.toggleSelectionMode()
    })
  }

  private toggleSelectionMode() {
    if (this.isSelectionMode) {
      this.stopSelectionMode()
    } else {
      this.startSelectionMode()
    }
  }

  private startSelectionMode() {
    this.isSelectionMode = true
    this.isActive = true
    this.modal?.remove()
    
    this.createToolbar()
    
    if (this.triggerBtn) {
      this.triggerBtn.textContent = "Cancel Selection"
      this.triggerBtn.style.background = "#ef4444"
      this.triggerBtn.style.boxShadow = "0 4px 20px rgba(239, 68, 68, 0.4)"
    }
    
    document.body.style.cursor = "crosshair"
    
    // Listeners for element selection
    document.addEventListener("mouseover", this.handleMouseOver, true)
    document.addEventListener("mouseout", this.handleMouseOut, true)
    
    this.clickHandler = (e: MouseEvent) => this.handleClick(e)
    document.addEventListener("click", this.clickHandler, true)
  }

  private stopSelectionMode() {
    this.isSelectionMode = false
    this.isActive = false
    document.body.style.cursor = ""
    this.toolbar?.remove()
    this.modal?.remove()
    this.clearHoverHighlight()
    if (this.selectedEl) {
      this.selectedEl.classList.remove("af-selected-element")
      this.selectedEl = null
    }
    
    if (this.triggerBtn) {
      this.triggerBtn.textContent = "Leave Feedback"
      this.triggerBtn.style.background = "#8b5cf6"
      this.triggerBtn.style.boxShadow = "0 4px 20px rgba(139, 92, 246, 0.4)"
    }
    
    document.removeEventListener("mouseover", this.handleMouseOver, true)
    document.removeEventListener("mouseout", this.handleMouseOut, true)
    if (this.clickHandler) document.removeEventListener("click", this.clickHandler, true)
  }

  private handleMouseOver = (e: MouseEvent) => {
    if (!this.isSelectionMode) return
    const target = e.target as HTMLElement
    if (
      target.closest("#af-toolbar") ||
      target.closest("#af-modal-wrap") ||
      target.closest(".af-pin") ||
      target.closest("#af-feedback-trigger") ||
      target === document.body ||
      target === document.documentElement
    ) return

    this.clearHoverHighlight()
    this.hoveredEl = target
    target.classList.add("af-hovered-element")
  }

  private handleMouseOut = (e: MouseEvent) => {
    this.clearHoverHighlight()
  }

  private clearHoverHighlight() {
    if (this.hoveredEl) {
      this.hoveredEl.classList.remove("af-hovered-element")
      this.hoveredEl = null
    }
  }

  private injectStyles() {
    if (document.getElementById("af-styles")) return
    const style = document.createElement("style")
    style.id = "af-styles"
    style.textContent = `
      #af-feedback-trigger {
        position: fixed; top: 24px; right: 24px; z-index: 2147483647;
        background: #8b5cf6; color: #fff; padding: 12px 24px;
        border-radius: 100px; font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
        font-size: 14px; font-weight: 700; border: none; cursor: pointer;
        box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4), 0 0 0 1px rgba(255,255,255,0.1) inset;
        transition: transform 0.2s, background 0.2s, box-shadow 0.2s;
      }
      #af-feedback-trigger:hover {
        background: #7c3aed;
        transform: translateY(-2px);
        box-shadow: 0 6px 24px rgba(139, 92, 246, 0.5), 0 0 0 1px rgba(255,255,255,0.2) inset;
      }
      #af-feedback-trigger:active {
        transform: translateY(0);
      }

      .af-hovered-element {
        outline: 2px dashed #8b5cf6 !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.15) !important;
        cursor: pointer !important;
      }
      
      .af-selected-element {
        outline: 2px dashed #8b5cf6 !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.3) !important;
      }

      @keyframes af-pulse-ring {
        0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
        100% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; }
      }
      .af-highlight-radar {
        position: absolute; width: 64px; height: 64px;
        border: 3px dashed #8b5cf6; border-radius: 50%;
        z-index: 2147483637; pointer-events: none;
        box-shadow: 0 0 20px rgba(139, 92, 246, 0.4);
        animation: af-pulse-ring 2s infinite ease-out;
      }

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
      .af-field:focus { border-color: #8b5cf6; }
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
        padding: 7px 16px; background: #8b5cf6; border: none;
        color: #fff; border-radius: 8px; cursor: pointer;
        font-size: 13px; font-weight: 600; font-family: inherit;
        transition: opacity 0.2s;
      }
      .af-btn-submit:hover   { opacity: 0.85; }
      .af-btn-submit:disabled{ opacity: 0.45; cursor: not-allowed; }

      .af-pin {
        position: absolute;
        width: 28px; height: 28px; border-radius: 50%;
        background: linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%);
        color: #ffffff; border: 2.5px solid #ffffff;
        z-index: 2147483638; cursor: pointer; pointer-events: auto;
        box-shadow: 0 4px 20px rgba(124, 58, 237, 0.45), inset 0 2px 4px rgba(255,255,255,0.3);
        display: flex; align-items: center; justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
        font-size: 11px; font-weight: 800;
        animation: af-pin-drop 0.3s cubic-bezier(0.34,1.56,0.64,1);
        transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s;
      }
      .af-pin:hover {
        transform: scale(1.15) translateY(-2px);
        box-shadow: 0 8px 24px rgba(124, 58, 237, 0.6), inset 0 2px 4px rgba(255,255,255,0.3);
      }
      .af-pin.resolved {
        background: linear-gradient(135deg, #34d399 0%, #059669 100%);
        box-shadow: 0 4px 20px rgba(5, 150, 105, 0.45), inset 0 2px 4px rgba(255,255,255,0.3);
      }
      .af-pin.resolved:hover {
        box-shadow: 0 8px 24px rgba(5, 150, 105, 0.6), inset 0 2px 4px rgba(255,255,255,0.3);
      }

      /* Thread Styles */
      .af-thread-scroll {
        overflow-y: auto; padding-right: 4px; margin-bottom: 12px;
        display: flex; flex-direction: column; gap: 12px;
      }
      .af-message {
        background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
        padding: 10px; border-radius: 8px;
      }
      .af-message.agency { background: rgba(139,92,246,0.1); border-color: rgba(139,92,246,0.2); }
      .af-msg-header { display: flex; justify-content: space-between; font-size: 11px; color: rgba(255,255,255,0.4); margin-bottom: 4px; }
      .af-msg-author { font-weight: 600; color: #e8e8ed; }
      .af-message.agency .af-msg-author { color: #c084fc; }
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
      <span class="af-label">Move mouse & click any element to comment</span>
      <button id="af-exit-btn">Cancel</button>
    `
    document.body.appendChild(t)
    this.toolbar = t
    document.getElementById("af-exit-btn")?.addEventListener("click", e => {
      e.stopPropagation()
      this.stopSelectionMode()
    })
  }

  private async handleClick(e: MouseEvent) {
    if (!this.isActive || !this.isSelectionMode) return
    const target = e.target as HTMLElement
    if (
      target.closest("#af-toolbar") ||
      target.closest("#af-modal-wrap") ||
      target.closest(".af-pin") ||
      target.closest("#af-feedback-trigger")
    ) return

    e.preventDefault()
    e.stopPropagation()

    // Lock selection outline
    this.selectedEl = target
    target.classList.add("af-selected-element")

    // Show instant toast
    this.showToast("📸 Capturing screenshot...", "#8b5cf6")

    // Capture screenshot
    let screenshotBase64 = ""
    try {
      const h2c = await this.loadHtml2Canvas()
      const canvas = await h2c(target, {
        useCORS: true,
        backgroundColor: null,
        logging: false
      })
      screenshotBase64 = canvas.toDataURL("image/jpeg", 0.6)
    } catch (err) {
      console.error("[AF] Screenshot capture failed:", err)
    }

    this.currentScreenshot = screenshotBase64

    const xPct = (e.clientX / window.innerWidth) * 100
    const yPct = ((e.clientY + window.scrollY) / document.documentElement.scrollHeight) * 100
    
    // Stop element highlight hover listeners while filling details
    document.removeEventListener("mouseover", this.handleMouseOver, true)
    document.removeEventListener("mouseout", this.handleMouseOut, true)

    this.showNewCommentModal(xPct, yPct, e.clientX, e.clientY)
  }

  private showNewCommentModal(xPct: number, yPct: number, cx: number, cy: number) {
    this.modal?.remove()

    const safeLeft = Math.min(cx + 14, window.innerWidth  - 336)
    const safeTop  = Math.min(cy + 14, window.innerHeight - 340)

    const wrap = document.createElement("div")
    wrap.id = "af-modal-wrap"
    wrap.style.left = `${safeLeft}px`
    wrap.style.top  = `${safeTop}px`
    
    const savedName = localStorage.getItem("af_name") || ""
    const savedEmail = localStorage.getItem("af_email") || ""

    const screenshotHtml = this.currentScreenshot 
      ? `<div style="margin-bottom: 8px;">
           <span style="font-size: 11px; color: rgba(255,255,255,0.4); display: block; margin-bottom: 4px;">📸 Target Element Snapshot</span>
           <img src="${this.currentScreenshot}" style="width: 100%; max-height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12);" />
         </div>`
      : "";

    wrap.innerHTML = `
      <h3>
        <span style="display: flex; align-items: center; gap: 4px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" class="lucide lucide-pin" style="color: #8b5cf6;"><line x1="12" x2="12" y1="17" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.78-3.61A2 2 0 0 1 15 9.17V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4.17a2 2 0 0 1-.78 1.58L5.44 14a2 2 0 0 0-.44 1.24Z"/></svg>
          Leave Feedback
        </span>
      </h3>
      ${screenshotHtml}
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

    document.getElementById("af-cancel")?.addEventListener("click", () => {
      wrap.remove()
      this.stopSelectionMode()
    })
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

    const screenshotHtml = comment.screenshot
      ? `<div style="margin-top: 8px; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08);">
           <img src="${comment.screenshot}" style="width: 100%; max-height: 90px; object-fit: cover; display: block;" />
         </div>`
      : "";

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
          ${screenshotHtml}
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

    const payload: any = {
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

    if (this.currentScreenshot) {
      payload.screenshot = this.currentScreenshot
    }

    try {
      let res = await fetch(`${this.supabaseUrl}/rest/v1/comments`, {
        method: "POST",
        headers: {
          apikey: this.anonKey,
          Authorization: `Bearer ${this.anonKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation", // Get the created record back
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok && payload.screenshot) {
        console.warn("[AF] Post failed, retrying without screenshot...");
        delete payload.screenshot
        res = await fetch(`${this.supabaseUrl}/rest/v1/comments`, {
          method: "POST",
          headers: {
            apikey: this.anonKey,
            Authorization: `Bearer ${this.anonKey}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify(payload),
        })
      }

      if (res.ok) {
        const data = await res.json()
        if (data && data[0]) {
          const newComment = { ...data[0], replies: [] }
          this.comments.push(newComment)
          modal.remove()
          this.dropPin(newComment, this.comments.length)
          this.showToast("✅ Comment sent!", "#22c55e")
          this.stopSelectionMode()
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

  private dropPin(comment: any, index: number) {
    const pin = document.createElement("div")
    pin.className = "af-pin " + (comment.status === 'resolved' ? 'resolved' : '')
    pin.textContent = String(index)
    const absY = (comment.y_percent / 100) * document.documentElement.scrollHeight
    pin.style.cssText = "left: calc(" + comment.x_percent + "% - 14px); top: " + (absY - 14) + "px;"
    
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
        // Sort comments chronologically so pin numbers match creation order perfectly
        this.comments.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        this.comments.forEach((c: any, index: number) => this.dropPin(c, index + 1))
      }
    } catch (e) { 
      console.error("[AF] Failed to load pins", e)
    }
  }

  private highlightCommentOnLoad(highlightId: string) {
    const checkExist = setInterval(() => {
      const comment = this.comments.find(c => c.id === highlightId)
      if (comment) {
        clearInterval(checkExist)
        
        // Scroll smoothly to pin location
        const absY = (comment.y_percent / 100) * document.documentElement.scrollHeight
        const absX = (comment.x_percent / 100) * window.innerWidth
        
        window.scrollTo({
          top: absY - window.innerHeight / 2,
          left: absX - window.innerWidth / 2,
          behavior: "smooth"
        })
        
        // Draw pulsing radar rings on the spot to grab client/agency attention!
        if (this.highlightOverlay) this.highlightOverlay.remove()
        
        const radar = document.createElement("div")
        radar.className = "af-highlight-radar"
        radar.style.left = `calc(${comment.x_percent}% - 32px)`
        radar.style.top = `${absY - 32}px`
        document.body.appendChild(radar)
        this.highlightOverlay = radar
        
        // Clean up radar overlay after 8 seconds
        setTimeout(() => radar.remove(), 8000)
      }
    }, 200)

    // Timeout check after 10 seconds to avoid infinite loop
    setTimeout(() => clearInterval(checkExist), 10000)
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
