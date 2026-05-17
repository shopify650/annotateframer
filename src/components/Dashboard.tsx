import { useEffect, useState, useCallback } from "react"
import { supabase } from "../lib/supabase"
import { framer } from "framer-plugin"
import { injectAnnotateFrameScript, removeAnnotateFrameScript, isScriptInstalled } from "../lib/inject"
import { CommentThread } from "./CommentThread"
import { InviteLink } from "./InviteLink"
import { Settings } from "./Settings"
import type { Comment, Project, TabType, PlanType } from "../types"

interface Props {
  session: any
  onSignOut: () => void
}

export function Dashboard({ session, onSignOut }: Props) {
  const [project, setProject] = useState<Project | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [installed, setInstalled] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [tab, setTab] = useState<TabType>("comments")
  const [filter, setFilter] = useState<"open" | "resolved" | "all">("open")
  const [plan] = useState<PlanType>("free") // Replace with real subscription check
  const [loading, setLoading] = useState(true)

  // ─── Load / create project ────────────────────────────────────────────────
  useEffect(() => {
    loadOrCreateProject()
    checkInstallStatus()
  }, [])

  async function loadOrCreateProject() {
    setLoading(true)
    const { data: existing } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", session.user.id)
      .limit(1)
      .single()

    if (existing) {
      setProject(existing)
    } else {
      const { data: created } = await supabase
        .from("projects")
        .insert({ user_id: session.user.id, name: "My Framer Project" })
        .select()
        .single()
      if (created) setProject(created)
    }
    setLoading(false)
  }

  async function checkInstallStatus() {
    const ok = await isScriptInstalled()
    setInstalled(ok)
  }

  // ─── Load comments when project is ready ─────────────────────────────────
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

    // Realtime subscription
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

  // Register native Framer Header Menu
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
      {
        type: "separator"
      },
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
      {
        type: "separator"
      },
      {
        label: "Log Out",
        onAction: onSignOut
      }
    ])
  }, [project, installed, onSignOut])

  // ─── Install / remove script ──────────────────────────────────────────────
  async function handleInstall() {
    if (!project) return
    setInstalling(true)
    try {
      await injectAnnotateFrameScript(
        project.id,
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      )
      setInstalled(true)
      framer.notify("AnnotateFrame is now live on your site!", { variant: "success", durationMs: 3000 })
    } catch (err) {
      framer.notify("Failed to install script. Try again.", { variant: "error" })
    } finally {
      setInstalling(false)
    }
  }

  async function handleRemove() {
    try {
      await removeAnnotateFrameScript()
      setInstalled(false)
      framer.notify("Script removed/paused successfully.", { variant: "info", durationMs: 3000 })
    } catch (err) {
      framer.notify("Failed to remove script.", { variant: "error" })
    }
  }

  // ─── Resolve comment ──────────────────────────────────────────────────────
  async function resolveComment(commentId: string) {
    await supabase
      .from("comments")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", commentId)
    loadComments()
  }

  // ─── Filtered comments ────────────────────────────────────────────────────
  const displayed = comments.filter(c =>
    filter === "all" ? true : c.status === filter
  )
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
      {/* ── Top Header ── */}
      <div className="dash-header">
        <div className="dash-logo">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pin" style={{ color: "var(--accent)" }}><line x1="12" x2="12" y1="17" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.78-3.61A2 2 0 0 1 15 9.17V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4.17a2 2 0 0 1-.78 1.58L5.44 14a2 2 0 0 0-.44 1.24Z"/></svg>
          <span className="logo-label">AnnotateFrame</span>
        </div>
        <div className="dash-badges">
          {openCount > 0 && <span className="badge-open">{openCount} open</span>}
          <span className={`plan-chip plan-${plan}`}>{plan}</span>
        </div>
      </div>

      {/* ── Install Banner ── */}
      {!installed && (
        <div className="install-banner">
          <div className="install-banner-text">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-zap" style={{ color: "var(--accent)", marginTop: "2px" }}><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            <div>
              <strong>Script not installed</strong>
              <p>Inject AnnotateFrame into your live site to start collecting feedback.</p>
            </div>
          </div>
          <button className="btn-install" onClick={handleInstall} disabled={installing}>
            {installing ? "Installing…" : "Install Now"}
          </button>
        </div>
      )}

      {installed && (
        <div className="installed-banner" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check" style={{ color: "var(--green)" }}><polyline points="20 6 9 17 4 12"/></svg>
            <span>Live on site</span>
          </div>
          <button className="btn-ghost btn-xs" onClick={handleRemove}>Pause</button>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="tabs-bar">
        {(["comments", "invite", "settings"] as TabType[]).map(t => (
          <button
            key={t}
            className={`tab-btn ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}
            style={{ display: "inline-flex", alignItems: "center", gap: "4px", justifyContent: "center" }}
          >
            {t === "comments" && (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-message-square"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <span>Comments{openCount > 0 ? ` (${openCount})` : ""}</span>
              </>
            )}
            {t === "invite" && (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-link"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                <span>Invite</span>
              </>
            )}
            {t === "settings" && (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-settings"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                <span>Settings</span>
              </>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Comments ── */}
      {tab === "comments" && (
        <div className="comments-tab">
          {/* Filter pills */}
          <div className="filter-bar">
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

          {/* Comment list */}
          {displayed.length === 0 ? (
            <div className="empty-state">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check-circle" style={{ color: "var(--green)", marginBottom: "4px" }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              <p className="empty-title">
                {filter === "open" ? "No open comments" : `No ${filter} comments`}
              </p>
              <p className="empty-sub">
                {filter === "open"
                  ? "Share the invite link with your client to get started."
                  : "Comments will appear here once clients start reviewing."}
              </p>
            </div>
          ) : (
            <div className="comments-list">
              {displayed.map(c => (
                <CommentThread
                  key={c.id}
                  comment={c}
                  onResolve={() => resolveComment(c.id)}
                  siteUrl={project?.site_url}
                  inviteToken={project?.invite_token}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Invite ── */}
      {tab === "invite" && project && (
        <InviteLink
          token={project.invite_token}
          projectId={project.id}
          siteUrl={project.site_url}
        />
      )}

      {/* ── Tab: Settings ── */}
      {tab === "settings" && (
        <Settings
          session={session}
          project={project}
          plan={plan}
          onSignOut={onSignOut}
          onProjectUpdate={setProject}
        />
      )}
    </div>
  )
}
