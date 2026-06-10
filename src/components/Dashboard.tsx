import { useEffect, useState, useCallback } from "react"
import { supabase } from "../lib/supabase"
import { framer } from "framer-plugin"
import { injectAnnotateFrameScript, removeAnnotateFrameScript, isScriptInstalled } from "../lib/inject"
import { InboxItem } from "./InboxItem"
import { ChatView } from "./ChatView"
import { InviteLink } from "./InviteLink"
import { Settings } from "./Settings"
import type { Comment, Project, TabType, PlanType } from "../types"

interface Props {
  session: any
  onSignOut: () => void
}

export function Dashboard({ session, onSignOut }: Props) {
  const [project, setProject] = useState<Project | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [installed, setInstalled] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [tab, setTab] = useState<TabType>("projects")
  const [filter, setFilter] = useState<"open" | "resolved" | "all">("open")
  const plan: PlanType = project?.plan ?? "free"
  const [loading, setLoading] = useState(true)
  const [autoClean, setAutoClean] = useState(false)
  const [currentMonthCommentCount, setCurrentMonthCommentCount] = useState(0)
  const [commentLimitWarning, setCommentLimitWarning] = useState(false)
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null)
  const [detectedSiteUrl, setDetectedSiteUrl] = useState("")
  const [lastViewedTime, setLastViewedTime] = useState<string>(() => {
    return localStorage.getItem("af_last_viewed_default") || new Date().toISOString()
  })

  // Manual installation states
  const [showManualSetup, setShowManualSetup] = useState(false)
  const [permissionError, setPermissionError] = useState<string | null>(null)

  // Project Creation Modal State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")

  // Load last viewed time for project to track new notifications
  useEffect(() => {
    if (project) {
      const stored = localStorage.getItem(`af_last_viewed_${project.id}`)
      if (stored) {
        setLastViewedTime(stored)
      } else {
        const now = new Date().toISOString()
        localStorage.setItem(`af_last_viewed_${project.id}`, now)
        setLastViewedTime(now)
      }
    }
  }, [project])

  // Count new notifications dynamically
  const newCommentsCount = comments.filter(c => {
    const isNewComment = new Date(c.created_at) > new Date(lastViewedTime)
    const hasNewReply = c.replies && c.replies.some(r => new Date(r.created_at) > new Date(lastViewedTime))
    return isNewComment || hasNewReply
  }).length

  const hasNewNotifications = newCommentsCount > 0

  // Automatically mark comments as read after 4 seconds of viewing the projects tab
  useEffect(() => {
    if (tab === "projects" && hasNewNotifications && project) {
      const timer = setTimeout(() => {
        const now = new Date().toISOString()
        setLastViewedTime(now)
        localStorage.setItem(`af_last_viewed_${project.id}`, now)
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [tab, hasNewNotifications, project])

  // Find the single comment that has the newest activity
  const getNewestActiveComment = (): Comment | null => {
    if (comments.length === 0) return null
    let newestComment: Comment = comments[0]
    let newestTime = 0

    comments.forEach(c => {
      const cTime = new Date(c.created_at).getTime()
      if (cTime > newestTime) {
        newestTime = cTime
        newestComment = c
      }

      if (c.replies) {
        c.replies.forEach(r => {
          const rTime = new Date(r.created_at).getTime()
          if (rTime > newestTime) {
            newestTime = rTime
            newestComment = c
          }
        })
      }
    })

    return newestComment
  }

  function handleNotificationClick() {
    const newest = getNewestActiveComment()

    if (hasNewNotifications) {
      framer.notify(`Opening your latest feedback update! 🎉`, { variant: "success", durationMs: 3000 })
      const now = new Date().toISOString()
      setLastViewedTime(now)
      if (project) {
        localStorage.setItem(`af_last_viewed_${project.id}`, now)
      }
      setTab("projects")
      if (newest) {
        setActiveCommentId(newest.id)
      }
    } else {
      if (newest) {
        framer.notify("Opening your most recent comment thread...", { variant: "info", durationMs: 2500 })
        setTab("projects")
        setActiveCommentId(newest.id)
      } else {
        framer.notify("You're all caught up! No comments have been made yet.", { variant: "info", durationMs: 3000 })
      }
    }
  }

  const isDomainMismatched = useCallback(() => {
    if (plan !== "free" || !project?.site_url || !detectedSiteUrl) return false
    const clean = (url: string) => {
      return url.replace(/^(https?:\/\/)?(www\.)?/, "").replace(/\/$/, "").trim().toLowerCase()
    }
    return clean(project.site_url) !== clean(detectedSiteUrl)
  }, [plan, project, detectedSiteUrl])

  // Load project list & install status
  useEffect(() => {
    loadOrCreateProject()
    checkInstallStatus()
  }, [])

  // Store plan in sessionStorage for client script
  useEffect(() => {
    sessionStorage.setItem("af_plan", plan)
  }, [plan])

  async function loadOrCreateProject() {
    setLoading(true)
    const { data: existing } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })

    let activeProj: Project | null = null

    // Automatically detect published URL from Framer workspace!
    let detectedUrl = ""
    try {
      const publishInfo = await framer.getPublishInfo()
      detectedUrl = publishInfo?.production?.url || publishInfo?.staging?.url || ""
    } catch (err) {
      console.warn("[AF] Could not detect publish info:", err)
    }

    setDetectedSiteUrl(detectedUrl)

    if (existing && existing.length > 0) {
      setProjects(existing)
      const firstProj = existing[0]
      activeProj = firstProj

      // For FREE users, auto-sync the URL ONLY when the site_url is empty!
      // Once it is set/filled, it is locked permanently to that specific Framer project.
      if (firstProj.plan === "free" && detectedUrl && !firstProj.site_url) {
        const { data: updated } = await supabase
          .from("projects")
          .update({ site_url: detectedUrl })
          .eq("id", firstProj.id)
          .select()
          .single()
        if (updated) {
          activeProj = updated
          setProjects(prev => prev.map(p => p.id === updated.id ? updated : p))
        }
      }

      setProject(activeProj) // Load the latest project
    } else {
      const { data: created } = await supabase
        .from("projects")
        .insert({ 
          user_id: session.user.id, 
          name: "Project one", 
          site_url: detectedUrl || null 
        })
        .select()
        .single()
      if (created) {
        setProjects([created])
        activeProj = created
        setProject(created)
      }
    }
    setLoading(false)

    // Automatically check user plan when they open the plugin!
    if (activeProj) {
      silentSyncSubscription(activeProj)
    }
  }

  async function checkInstallStatus() {
    const ok = await isScriptInstalled()
    setInstalled(ok)
  }

  async function silentSyncSubscription(activeProj: Project) {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (!currentSession) return

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-membership`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentSession.access_token}`
        }
      })

      if (response.ok) {
        const res = await response.json()
        if (res.success) {
          // If the plan changed in the background, reload projects to update UI plan badge!
          const { data: updatedProjects } = await supabase
            .from("projects")
            .select("*")
            .eq("user_id", session.user.id)
            .order("created_at", { ascending: false })

          if (updatedProjects && updatedProjects.length > 0) {
            setProjects(updatedProjects)
            // Sync active project plan state with absolute precision
            const matched = updatedProjects.find(p => p.id === activeProj.id)
            if (matched) {
              setProject(matched)
              if (matched.plan !== activeProj.plan) {
                framer.notify(`Subscription status updated: ${matched.plan.toUpperCase()} plan active.`, { variant: "success", durationMs: 4000 })
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn("[AF] Silent subscription sync failed:", err)
    }
  }

  function handleExportComments() {
    // Upsell check: block if they are not on the agency plan!
    if (plan !== "agency") {
      framer.notify("Exporting comments is exclusive to the AGENCY plan. Upgrade to export review checklists!", { variant: "warning" })
      return
    }

    if (comments.length === 0) {
      framer.notify("No comments available to export in this project.", { variant: "info" })
      return
    }

    try {
      // 1. Define CSV headers
      const headers = ["Comment ID", "Content", "Status", "Created At", "Coordinates (X%)", "Coordinates (Y%)", "Device"]
      
      // 2. Map comments to rows (sanitizing commas and quotes)
      const rows = comments.map(c => [
        c.id,
        `"${(c.body || "").replace(/"/g, '""')}"`,
        c.status === "resolved" ? "Resolved" : "Open",
        new Date(c.created_at).toLocaleString(),
        `${c.x_percent}%`,
        `${c.y_percent}%`,
        c.browser || "Desktop"
      ])

      // 3. Construct CSV raw content
      const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n")

      // 4. Create and trigger download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.setAttribute("href", url)
      link.setAttribute("download", `remark_comments_${project?.name || "project"}.csv`)
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      framer.notify("Comments checklist exported as CSV successfully!", { variant: "success" })
    } catch (err) {
      framer.notify("Failed to export comments.", { variant: "error" })
    }
  }

  // Create new project
async function handleCreateProject() {
  if (!newProjectName.trim()) return

  // Check project limit for free plan
  if (plan === "free" && projects.length >= 1) {
    framer.notify("Free plan limited to 1 project. Upgrade to Pro or Agency for unlimited projects.", { variant: "warning" })
    return
  }

  setLoading(true)
  try {
    const { data: created, error } = await supabase
      .from("projects")
      .insert({ user_id: session.user.id, name: newProjectName.trim() })
      .select()
      .single()

    if (error) throw error
    if (created) {
      setProjects(prev => [created, ...prev])
      setProject(created)
      setShowCreateModal(false)
      setNewProjectName("")
      framer.notify(`Project "${created.name}" created!`, { variant: "success", durationMs: 3000 })
    }
  } catch (err) {
    framer.notify("Failed to create project.", { variant: "error" })
  } finally {
    setLoading(false)
  }
}

  // Load comments
  const loadComments = useCallback(async () => {
    if (!project) return
    const { data } = await supabase
      .from("comments")
      .select("*, replies(*)")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
    if (data) setComments(data as Comment[])
  }, [project])

  useEffect(() => {
    if (!project) return
    loadComments()

    const channel = supabase
      .channel(`af-comments-${project.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments", filter: `project_id=eq.${project.id}` },
        () => loadComments()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "replies" },
        () => loadComments()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [project, loadComments])

  // Load auto-clean setting for current project
  useEffect(() => {
    if (project) {
      const stored = localStorage.getItem(`af_autoclean_${project.id}`)
      setAutoClean(stored === "true")
    }
  }, [project])

  // Auto-cleanup logic: if autoClean is true and resolved > 100, delete oldest resolved
  useEffect(() => {
    if (!project || !autoClean) return
    const resolved = comments.filter(c => c.status === "resolved").sort((a,b) => new Date(b.resolved_at || b.created_at).getTime() - new Date(a.resolved_at || a.created_at).getTime())
    
    if (resolved.length > 100) {
      const toDelete = resolved.slice(100)
      const idsToDelete = toDelete.map(c => c.id)
      
      if (idsToDelete.length > 0) {
        supabase.from("comments").delete().in("id", idsToDelete).then(({ error }) => {
          if (!error) {
            setComments(prev => prev.filter(c => !idsToDelete.includes(c.id)))
            framer.notify(`Auto-cleaned ${idsToDelete.length} old resolved comments`)
          }
        })
      }
    }
  }, [comments, project, autoClean])

  // Update comment count for current month whenever comments changes
  useEffect(() => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const count = comments.filter(c => new Date(c.created_at) >= startOfMonth).length
    setCurrentMonthCommentCount(count)
  }, [comments])

  // Framer Menu Integration
  useEffect(() => {
    if (!project) return
    framer.setMenu([
      {
        label: "Open Live Site",
        enabled: !!project.site_url,
        onAction: () => {
          if (project.site_url) {
            window.open(project.site_url.startsWith("http") ? project.site_url : `https://${project.site_url}`, "_blank")
          }
        }
      },
      { type: "separator" },
      {
        label: installed ? "Pause Comments" : "Activate Comments",
        onAction: () => {
          if (installed) {
            handleRemove()
          } else {
            handleInstall()
          }
        }
      },
      { type: "separator" },
      { label: "Log Out", onAction: onSignOut }
    ])
  }, [project, installed, onSignOut])

  async function handleInstall() {
    if (!project) return
    setInstalling(true)
    setPermissionError(null)
    try {
      await injectAnnotateFrameScript(
        project.id,
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      )
      setInstalled(true)
      framer.notify("AnnotateFrame comments are now active!", { variant: "success", durationMs: 3000 })
    } catch (err) {
      console.error("[AF] Install failed:", err)
      const errMsg = (err as Error).message || String(err)
      setPermissionError(errMsg)
      setShowManualSetup(true)
      framer.notify(`Failed to install: ${errMsg}`, { variant: "error" })
    } finally {
      setInstalling(false)
    }
  }

  async function handleRemove() {
    setPermissionError(null)
    try {
      await removeAnnotateFrameScript()
      setInstalled(false)
      framer.notify("Comments paused successfully.", { variant: "info", durationMs: 3000 })
    } catch (err) {
      console.error("[AF] Pause failed:", err)
      const errMsg = (err as Error).message || String(err)
      setPermissionError(errMsg)
      setShowManualSetup(true)
      framer.notify(`Failed to pause: ${errMsg}`, { variant: "error" })
    }
  }

  async function resolveComment(commentId: string) {
    await supabase
      .from("comments")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", commentId)
    loadComments()
  }

  const displayed = comments.filter(c => filter === "all" ? true : c.status === filter)
  const openCount = comments.filter(c => c.status === "open").length
  const resolvedCount = comments.filter(c => c.status === "resolved").length

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="framer-spinner-large" />
        <p>Loading your workspace…</p>
      </div>
    )
  }

  return (
    <div className="dashboard">
      {/* ── main content view ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        
        {/* TAB: PROJECTS (Main view showing the AnnotateFrame specs) */}
        {tab === "projects" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            
            {/* Elegant Header */}
            <div className="dash-header" style={{ padding: "14px 16px 8px" }}>
              <span style={{ fontSize: "17px", fontWeight: "700", letterSpacing: "-0.4px" }}>Dashboard</span>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "var(--text-sub)" }}>
                {/* Notification Bell Icon */}
                <div style={{ position: "relative", cursor: "pointer", display: "flex", alignItems: "center" }} onClick={handleNotificationClick}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ color: hasNewNotifications ? "var(--red)" : "currentColor", transition: "color 0.2s" }}
                  >
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  {hasNewNotifications && (
                    <span style={{
                      position: "absolute",
                      top: "-1px",
                      right: "-1px",
                      width: "7px",
                      height: "7px",
                      background: "var(--red)",
                      borderRadius: "50%",
                      boxShadow: "0 0 0 2px var(--bg), 0 0 6px var(--red)"
                    }} />
                  )}
                </div>

                {/* Plus add icon */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ cursor: "pointer", transition: "color 0.2s" }}
                  className="add-project-icon"
                  onClick={() => setShowCreateModal(true)}
                >
                  <line x1="12" x2="12" y1="5" y2="19"/>
                  <line x1="5" x2="19" y1="12" y2="12"/>
                </svg>
              </div>
            </div>

            {/* Unified Mesh Gradient Active Project Card */}
            {project && (
              <div className="project-card" style={{ cursor: "default", margin: "0 12px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-sub)" }}>Projects:</span>
                    <select
                      value={project.id}
                      onChange={(e) => {
                        const selected = projects.find(p => p.id === e.target.value)
                        if (selected) setProject(selected)
                      }}
                      style={{
                        background: "var(--surface2)",
                        border: "1px solid var(--border-hi)",
                        borderRadius: "6px",
                        color: "var(--text)",
                        fontSize: "11px",
                        fontWeight: "700",
                        padding: "2px 6px",
                        cursor: "pointer",
                        outline: "none"
                      }}
                    >
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Live review shortcut button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      const baseUrl = project.site_url ? (project.site_url.startsWith("http") ? project.site_url : `https://${project.site_url}`) : ""
                      if (baseUrl) {
                        const reviewUrl = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}af_token=${project.invite_token}`
                        window.open(reviewUrl, "_blank")
                      } else {
                        framer.notify("Please configure your Site URL in Settings first to open the review live chats!", { variant: "info" })
                      }
                    }}
                    style={{
                      background: "var(--surface2)",
                      border: "none",
                      borderRadius: "6px",
                      width: "22px",
                      height: "22px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--text)",
                      cursor: "pointer",
                      transition: "background 0.2s"
                    }}
                    title="Open Live Chat Feedback"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                  </button>
                </div>

                <div style={{ marginTop: "12px", cursor: "pointer", display: "flex", flexDirection: "column", gap: "2px" }} onClick={() => {
                  const baseUrl = project.site_url ? (project.site_url.startsWith("http") ? project.site_url : `https://${project.site_url}`) : ""
                  if (baseUrl) {
                    const reviewUrl = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}af_token=${project.invite_token}`
                    window.open(reviewUrl, "_blank")
                  }
                }}>
                  <div className="project-card-title">
                    {project.name}
                  </div>
                  <div className="project-card-url" style={{ opacity: 0.7 }}>
                    {project.site_url || "remark.framer.website"}
                  </div>
                </div>
              </div>
            )}

            {/* Monthly Limit Warning Banner for Free Plan */}
            {plan === "free" && currentMonthCommentCount >= 10 && (
              <div style={{
                margin: "0 12px 10px",
                borderRadius: "12px",
                border: "1px solid rgba(59,130,246,0.2)",
                background: "linear-gradient(135deg, rgba(59,130,246,0.06), rgba(139,92,246,0.03))",
                padding: "14px",
                display: "flex",
                flexDirection: "column",
                gap: "10px"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{
                    width: "28px", height: "28px", borderRadius: "8px",
                    background: "rgba(59,130,246,0.12)",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                  }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 6v6l4 2"/></svg>
                  </div>
                  <div>
                    <span style={{ fontSize: "12px", fontWeight: "700", color: "#3b82f6", display: "block" }}>Monthly Limit Reached</span>
                    <span style={{ fontSize: "10px", color: "var(--text-sub)", lineHeight: "1.4" }}>
                      Free plan allows 10 comments/month. Upgrade for unlimited.
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setTab("settings")}
                  style={{
                    width: "100%", padding: "8px", borderRadius: "8px",
                    background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                    border: "none", color: "#fff", fontSize: "11px",
                    fontWeight: "700", cursor: "pointer", letterSpacing: "0.3px"
                  }}
                >
                  Upgrade to Pro →
                </button>
              </div>
            )}

            {/* Comments listing feed */}
            <div className="comments-tab" style={{ flex: 1 }}>
              {/* Filter pills */}
              <div className="filter-bar" style={{ padding: "6px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: "4px" }}>
                  {(["open", "resolved", "all"] as const).map(f => (
                    <button
                      key={f}
                      className={`filter-pill ${filter === f ? "active" : ""}`}
                      onClick={() => setFilter(f)}
                    >
                      {f === "open" && `Open (${openCount})`}
                      {f === "resolved" && `Done (${resolvedCount})`}
                      {f === "all" && `All (${comments.length})`}
                    </button>
                  ))}
                </div>
                
                {/* Premium CSV Export Button */}
                <button
                  onClick={handleExportComments}
                  className="filter-pill"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "3px 8px",
                    background: "transparent",
                    borderColor: "var(--border)",
                    color: "var(--text-sub)",
                    fontSize: "10px",
                    fontWeight: "600",
                    cursor: "pointer"
                  }}
                  title="Export comments to CSV (Agency Plan)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Export
                </button>
              </div>

              {/* Comments list feed scrollable */}
              {displayed.length === 0 ? (
                <div className="empty-state">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--green)", marginBottom: "4px" }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  <p className="empty-title">
                    {filter === "open" ? "No open comments" : `No ${filter} comments`}
                  </p>
                  <p className="empty-sub">
                    {filter === "open"
                      ? "Share the invite link with your client to collect feedback."
                      : "Comments will appear here once clients start writing."}
                  </p>
                </div>
              ) : (
                <div className="comments-list" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
                  {displayed.map(c => (
                    <InboxItem
                      key={c.id}
                      comment={c}
                      onClick={() => setActiveCommentId(c.id)}
                    />
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB: PROFILE (User details, copy invite link, subscription, log out) */}
        {tab === "profile" && (
          <div className="invite-panel">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "8px", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: "16px", fontWeight: "700" }}>Profile Details</span>
              <span className={`plan-chip plan-${plan}`}>{plan}</span>
            </div>

            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "9px", color: "var(--text-sub)", textTransform: "uppercase", fontWeight: "700" }}>Account Email</span>
              <span style={{ fontSize: "12px", fontWeight: "600" }}>{session?.user?.email || "user@agency.com"}</span>
            </div>

            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "9px", color: "var(--text-sub)", textTransform: "uppercase", fontWeight: "700" }}>Monthly Usage</span>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", fontWeight: "600" }}>
                <span>Comments this month:</span>
                <span style={{ color: plan === "free" && currentMonthCommentCount >= 10 ? "var(--red)" : "var(--text)" }}>
                  {plan === "free" ? `${currentMonthCommentCount} / 10` : `${currentMonthCommentCount} / ∞`}
                </span>
              </div>
            </div>

            {project && (
              <InviteLink
                token={project.invite_token}
                projectId={project.id}
                siteUrl={project.site_url}
                plan={plan}
              />
            )}

            <button className="btn-primary" style={{ width: "100%", marginTop: "12px", background: "var(--red)", borderColor: "var(--red)", color: "#fff" }} onClick={onSignOut}>
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
              Log Out
            </button>
          </div>
        )}

        {/* TAB: SETTINGS (Project configurations, billing plans details) */}
        {tab === "settings" && (
          <Settings
            session={session}
            project={project}
            projects={projects}
            plan={plan}
            autoClean={autoClean}
            detectedSiteUrl={detectedSiteUrl}
            onAutoCleanChange={(val) => {
              setAutoClean(val)
              if (project) localStorage.setItem(`af_autoclean_${project.id}`, String(val))
            }}
            installed={installed}
            installing={installing}
            onInstall={handleInstall}
            onRemove={handleRemove}
            showManualSetup={showManualSetup}
            onHideManualSetup={() => {
              setShowManualSetup(false)
              setPermissionError(null)
            }}
            permissionError={permissionError}
            onSignOut={onSignOut}
            onProjectUpdate={(updated) => {
              setProject(updated)
              setProjects(prev => prev.map(p => p.id === updated.id ? updated : p))
            }}
            onSelectProject={setProject}
            onProjectDelete={(deletedId) => {
              const remaining = projects.filter(p => p.id !== deletedId)
              setProjects(remaining)
              if (remaining.length > 0) {
                setProject(remaining[0])
              } else {
                setProject(null)
                loadOrCreateProject()
              }
            }}
          />
        )}

      </div>

      {/* Dynamic Inline Project Creation Modal overlay */}
      {showCreateModal && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(10, 10, 12, 0.8)",
          backdropFilter: "blur(12px)",
          zIndex: 2147483647,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px"
        }}>
          <div style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            padding: "20px",
            width: "100%",
            maxWidth: "280px",
            boxShadow: "0 12px 48px rgba(0,0,0,0.5)",
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }}>
            <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--text)" }}>Create New Project</span>
            <input
              type="text"
              className="field-input"
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              placeholder="e.g. Agency Website"
              style={{ width: "100%", padding: "8px 12px", fontSize: "12px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text)", outline: "none" }}
              autoFocus
              onKeyDown={e => {
                if (e.key === "Enter") handleCreateProject()
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
              <button
                className="btn-ghost"
                style={{ padding: "6px 12px", fontSize: "11px" }}
                onClick={() => {
                  setShowCreateModal(false)
                  setNewProjectName("")
                }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                style={{ padding: "6px 14px", fontSize: "11px" }}
                onClick={handleCreateProject}
                disabled={!newProjectName.trim()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom Custom Tabs Navigation Bar ── */}
      <div className="bottom-nav">
        {/* Profile tab button */}
        <button className={`bottom-nav-btn ${tab === "profile" ? "active" : ""}`} onClick={() => setTab("profile")}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span>Profile</span>
        </button>

        {/* Projects tab button */}
        <button className={`bottom-nav-btn ${tab === "projects" ? "active" : ""}`} onClick={() => setTab("projects")}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
          <span>Projects</span>
        </button>

        {/* Settings tab button */}
        <button className={`bottom-nav-btn ${tab === "settings" ? "active" : ""}`} onClick={() => setTab("settings")}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
          <span>Settings</span>
        </button>
      </div>

      {/* Chat View Overlay */}
      {activeCommentId && (
        <ChatView
          comment={comments.find(c => c.id === activeCommentId)!}
          onClose={() => setActiveCommentId(null)}
          onResolve={() => resolveComment(activeCommentId)}
          siteUrl={project?.site_url}
          inviteToken={project?.invite_token}
        />
      )}
    </div>
  )
}
