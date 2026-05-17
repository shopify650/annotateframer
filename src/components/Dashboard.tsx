import { useEffect, useState, useCallback } from "react"
import { supabase } from "../lib/supabase"
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

  // ─── Install / remove script ──────────────────────────────────────────────
  async function handleInstall() {
    if (!project) return
    setInstalling(true)
    await injectAnnotateFrameScript(
      project.id,
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY
    )
    setInstalled(true)
    setInstalling(false)
  }

  async function handleRemove() {
    await removeAnnotateFrameScript()
    setInstalled(false)
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
        <div className="spinner" />
        <p>Loading your workspace…</p>
      </div>
    )
  }

  return (
    <div className="dashboard">
      {/* ── Top Header ── */}
      <div className="dash-header">
        <div className="dash-logo">
          <span className="logo-pin">📌</span>
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
            <span className="install-icon">⚡</span>
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
        <div className="installed-banner">
          <span>✅ Live on site</span>
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
          >
            {t === "comments" && `💬 Comments${openCount > 0 ? ` (${openCount})` : ""}`}
            {t === "invite" && "🔗 Invite"}
            {t === "settings" && "⚙️ Settings"}
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
              <div className="empty-icon">🎉</div>
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
