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
      "Email notifications",
      "Reply to clients",
      "Comment export",
    ],
    highlight: true,
    checkoutUrl: "https://annotateframe.lemonsqueezy.com/checkout/buy/PRO_VARIANT_ID",
  },
  {
    id: "agency",
    label: "Agency",
    price: "$59/mo",
    features: [
      "Everything in Pro",
      "3 team seats",
      "White-label modal",
      "Zapier / webhooks",
      "Slack notifications",
    ],
    highlight: false,
    checkoutUrl: "https://annotateframe.lemonsqueezy.com/checkout/buy/AGENCY_VARIANT_ID",
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
  onProjectDelete
}: Props) {
  const [siteName, setSiteName] = useState(project?.name ?? "")
  const [siteUrl, setSiteUrl] = useState(project?.site_url ?? "")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

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
        <button className="btn-ghost btn-sm" onClick={onSignOut}>
          Sign Out
        </button>
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
