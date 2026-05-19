import { useState, useEffect } from "react"
import { framer } from "framer-plugin"
import { supabase } from "../lib/supabase"
import type { Project, PlanType } from "../types"

interface Props {
  session: any
  project: Project | null
  projects: Project[]
  plan: PlanType
  onSignOut: () => void
  onProjectUpdate: (p: Project) => void
  onSelectProject: (p: Project) => void
  onProjectDelete: (id: string) => void
  autoClean: boolean
  onAutoCleanChange: (val: boolean) => void
  installed: boolean
  installing: boolean
  onInstall: () => void
  onRemove: () => void
  showManualSetup: boolean
  onHideManualSetup: () => void
  permissionError: string | null
}

const PLANS = [
  {
    id: "free",
    label: "Free",
    price: "$0",
    features: ["1 project", "10 comments/month", "Invite link", "Resolve comments"],
    highlight: false,
    checkoutUrl: null,
  },
  {
    id: "pro",
    label: "Pro",
    price: "$25/mo",
    features: [
      "Unlimited projects",
      "Unlimited comments",
      "Reply to clients",
    ],
    highlight: true,
    checkoutUrl: "https://whop.com/buildhaus-templates/annotate-framer-15/",
  },
  {
    id: "agency",
    label: "Agency",
    price: "Coming Soon",
    features: [
      "Everything in Pro",
      "CSV comment export",
      "3 team seats",
      "White-label modal",
      "Zapier / webhooks",
      "Slack notifications",
    ],
    highlight: false,
    checkoutUrl: null,
  },
]

export function Settings({
  session,
  project,
  projects,
  plan,
  onSignOut,
  onProjectUpdate,
  onSelectProject,
  onProjectDelete,
  autoClean,
  onAutoCleanChange,
  installed,
  installing,
  onInstall,
  onRemove,
  showManualSetup,
  onHideManualSetup,
  permissionError
}: Props) {
  const [siteName, setSiteName] = useState(project?.name ?? "")
  const [siteUrl, setSiteUrl] = useState(project?.site_url ?? "")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [restoring, setRestoring] = useState(false)

  async function handleRestorePurchase() {
    setRestoring(true)
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (!currentSession) throw new Error("No session found.")

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-membership`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentSession.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error("Failed to verify membership.")
      }

      const res = await response.json()
      if (res.success) {
        if (res.active) {
          framer.notify("Pro plan restored! Refreshing project...", { variant: "success", durationMs: 4000 })
        } else {
          framer.notify(res.message, { variant: "warning", durationMs: 4000 })
        }

        // ALWAYS refresh the local project data to instantly update the plan badge!
        const { data: updatedProject } = await supabase
          .from("projects")
          .select("*")
          .eq("id", project?.id)
          .single()
        if (updatedProject) {
          onProjectUpdate(updatedProject)
        }
      } else {
        framer.notify(res.error || "Could not restore purchase.", { variant: "error" })
      }
    } catch (err: any) {
      console.error("[AF] Restore purchase failed:", err)
      framer.notify(err.message || "Failed to restore purchase.", { variant: "error" })
    } finally {
      setRestoring(false)
    }
  }

  // Sync state if active project changes
  useEffect(() => {
    setSiteName(project?.name ?? "")
    setSiteUrl(project?.site_url ?? "")
  }, [project])

  async function saveProject() {
    if (!project) return
    setSaving(true)
    const { data } = await supabase
      .from("projects")
      .update({ name: siteName, site_url: siteUrl })
      .eq("id", project.id)
      .select()
      .single()
    if (data) {
      onProjectUpdate(data)
      framer.notify("Project settings saved!", { variant: "success", durationMs: 2500 })
    } else {
      framer.notify("Failed to save settings.", { variant: "error" })
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function deleteProject() {
    if (!project) return

    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", project.id)

    if (error) {
      console.error("[AF] Delete project failed:", error)
      framer.notify(`Failed to delete project: ${error.message}`, { variant: "error" })
    } else {
      framer.notify("Project deleted.", { variant: "info", durationMs: 2500 })
      onProjectDelete(project.id)
    }
  }

  function upgrade(url: string) {
    window.open(url, "_blank")
  }

  return (
    <div className="settings-panel">
      {/* Script Installation Section */}
      <section className="settings-section">
        <h4 className="settings-section-title">Site Script</h4>
        
        {!installed && (
          <div className="install-banner" style={{ borderRadius: "10px", border: "1px solid var(--accent-dim)", marginBottom: "10px" }}>
            <div className="install-banner-text">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent)" }}><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              <div>
                <strong>Script not installed</strong>
                <p style={{ fontSize: "9px" }}>Inject AnnotateFrame script into your live site to collect feedback.</p>
              </div>
            </div>
            <button className="btn-install" style={{ padding: "4px 8px", fontSize: "10px" }} onClick={onInstall} disabled={installing}>
              {installing ? "Installing…" : "Install"}
            </button>
          </div>
        )}

        {installed && (
          <div className="installed-banner" style={{ borderRadius: "8px", border: "1px solid var(--green-dim)", marginBottom: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--green)" }}><polyline points="20 6 9 17 4 12"/></svg>
              <span style={{ fontSize: "10px" }}>Live on site</span>
            </div>
            <button className="btn-ghost" style={{ padding: "2px 6px", fontSize: "9px" }} onClick={onRemove}>Pause</button>
          </div>
        )}

        {(showManualSetup || permissionError) && project && (
          <div className="manual-setup-card" style={{
            padding: "12px",
            borderRadius: "10px",
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            marginBottom: "10px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "10px", fontWeight: "700", color: "var(--yellow)", textTransform: "uppercase", letterSpacing: "0.5px" }}>⚠️ Manual Setup Required</span>
              <button className="btn-ghost" style={{ padding: "2px 6px", fontSize: "9px" }} onClick={onHideManualSetup}>Hide</button>
            </div>
            <p style={{ fontSize: "9px", color: "var(--text-sub)", margin: 0, lineHeight: "1.3" }}>
              Your Framer user role lacks permission to publish site scripts automatically. You can easily manage this manually:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "9px", color: "var(--text-sub)", paddingLeft: "4px", borderLeft: "2px solid var(--border)" }}>
              <div><strong>🟢 To Activate:</strong> Copy the code below, paste it in <strong>Framer Settings → Custom Code → End of &lt;body&gt; tag</strong>, and Publish.</div>
              <div><strong>🔴 To Pause:</strong> Go to <strong>Framer Settings → Custom Code</strong>, delete the AnnotateFrame code block, and Publish.</div>
            </div>
            <div style={{ position: "relative", marginTop: "4px" }}>
              <textarea
                readOnly
                value={`<!-- AnnotateFrame Start -->\n<script>\n  window.ANNOTATEFRAME_PROJECT_ID = "${project.id}";\n  window.ANNOTATEFRAME_SUPABASE_URL = "${import.meta.env.VITE_SUPABASE_URL}";\n  window.ANNOTATEFRAME_ANON_KEY = "${import.meta.env.VITE_SUPABASE_ANON_KEY}";\n</script>\n<script src="https://project-pymvu.vercel.app/annotateframe.min.js" defer></script>\n<!-- AnnotateFrame End -->`}
                style={{
                  width: "100%",
                  height: "80px",
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  color: "var(--accent)",
                  fontFamily: "monospace",
                  fontSize: "8.5px",
                  padding: "6px",
                  resize: "none",
                  outline: "none",
                  boxSizing: "border-box"
                }}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              />
              <button
                onClick={() => {
                  const code = `<!-- AnnotateFrame Start -->\n<script>\n  window.ANNOTATEFRAME_PROJECT_ID = "${project.id}";\n  window.ANNOTATEFRAME_SUPABASE_URL = "${import.meta.env.VITE_SUPABASE_URL}";\n  window.ANNOTATEFRAME_ANON_KEY = "${import.meta.env.VITE_SUPABASE_ANON_KEY}";\n</script>\n<script src="https://project-pymvu.vercel.app/annotateframe.min.js" defer></script>\n<!-- AnnotateFrame End -->`
                  navigator.clipboard.writeText(code)
                  framer.notify("Manual script copied!", { variant: "success", durationMs: 2000 })
                }}
                style={{
                  position: "absolute",
                  bottom: "6px",
                  right: "6px",
                  background: "var(--accent)",
                  border: "none",
                  borderRadius: "4px",
                  color: "#fff",
                  fontSize: "9px",
                  padding: "3px 6px",
                  cursor: "pointer",
                  fontWeight: "600"
                }}
              >
                Copy Code
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Account Section */}
      <section className="settings-section">
        <h4 className="settings-section-title">Account</h4>
        <div className="settings-row">
          <span className="settings-label">Email</span>
          <span className="settings-value">{session.user.email}</span>
        </div>
        <div className="settings-row">
          <span className="settings-label">Plan</span>
          <span className={`plan-badge plan-${plan}`}>{plan.toUpperCase()}</span>
        </div>
        <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
          <button className="btn-ghost btn-sm" onClick={onSignOut}>
            Sign Out
          </button>
          <button 
            className="btn-ghost btn-sm" 
            onClick={handleRestorePurchase} 
            disabled={restoring}
            style={{ color: "var(--accent)", borderColor: "var(--accent)" }}
          >
            {restoring ? "Syncing..." : plan === "pro" || plan === "agency" ? "Sync Subscription" : "Restore Purchase"}
          </button>
        </div>
      </section>

      {/* Project Section */}
      {project && (
        <section className="settings-section">
          <h4 className="settings-section-title">Project</h4>
          <div className="field-group">
            <label className="field-label">Project Name</label>
            <input
              className="field-input"
              value={siteName}
              onChange={e => setSiteName(e.target.value)}
              placeholder="My Framer Site"
            />
          </div>
          <div className="field-group">
            <label className="field-label">Published Site URL</label>
            <input
              className="field-input"
              value={siteUrl}
              onChange={e => setSiteUrl(e.target.value)}
              placeholder="https://mysite.framer.website"
            />
          </div>

          <div className="field-group" style={{ flexDirection: "row", alignItems: "center", gap: "8px", marginTop: "16px", marginBottom: "8px", background: "var(--surface2)", padding: "12px", borderRadius: "var(--radius)" }}>
            <input 
              type="checkbox" 
              id="autoClean" 
              checked={autoClean}
              onChange={e => onAutoCleanChange(e.target.checked)}
              style={{ accentColor: "var(--accent)", cursor: "pointer", width: "16px", height: "16px" }}
            />
            <label htmlFor="autoClean" className="field-label" style={{ margin: 0, cursor: "pointer", display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontSize: "12px", color: "var(--text)" }}>Auto-clean resolved comments</span>
              <span style={{ fontSize: "10.5px", color: "var(--text-sub)", fontWeight: 400 }}>Automatically delete older resolved comments when total done messages exceed 100.</span>
            </label>
          </div>
          <div style={{ display: "flex", gap: "8px", marginTop: "12px", alignItems: "center" }}>
            <button className="btn-primary btn-sm" onClick={saveProject} disabled={saving}>
              {saved ? "✅ Saved!" : saving ? "Saving…" : "Save Changes"}
            </button>
            {confirmDelete ? (
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <span style={{ fontSize: "10px", color: "var(--red)", fontWeight: "600" }}>Sure?</span>
                <button 
                  className="btn-primary btn-sm" 
                  onClick={deleteProject} 
                  style={{ background: "var(--red)", borderColor: "var(--red)", color: "#fff", padding: "4px 8px", fontSize: "10.5px" }}
                >
                  Yes
                </button>
                <button 
                  className="btn-ghost btn-sm" 
                  onClick={() => setConfirmDelete(false)}
                  style={{ padding: "4px 8px", fontSize: "10.5px" }}
                >
                  No
                </button>
              </div>
            ) : (
              <button className="btn-ghost btn-sm" onClick={() => setConfirmDelete(true)} style={{ color: "var(--red)", borderColor: "var(--red)" }}>
                Delete Project
              </button>
            )}
          </div>
        </section>
      )}

      {/* Pricing Section */}
      <section className="settings-section">
        <h4 className="settings-section-title">Upgrade Plan</h4>
        <div className="pricing-grid">
          {PLANS.map(p => (
            <div key={p.id} className={`pricing-card ${p.highlight ? "pricing-highlight" : ""} ${plan === p.id ? "pricing-current" : ""}`}>
              <div className="pricing-header">
                <span className="pricing-name">{p.label}</span>
                <span className="pricing-price">{p.price}</span>
              </div>
              <ul className="pricing-features">
                {p.features.map(f => (
                  <li key={f}>✓ {f}</li>
                ))}
              </ul>
              {plan === p.id ? (
                <div className="pricing-current-badge">Current Plan</div>
              ) : p.checkoutUrl ? (
                <button
                  className={`btn-upgrade ${p.highlight ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => upgrade(p.checkoutUrl!)}
                >
                  Upgrade →
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
