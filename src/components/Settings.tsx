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
  detectedSiteUrl?: string
}

const PRO_CHECKOUT_URL = "https://whop.com/buildhaus-templates/annotate-framer-15/"

interface ClickUpWorkspace {
  id: string
  name: string
}

interface ClickUpSpace {
  id: string
  name: string
}

interface ClickUpFolder {
  id: string
  name: string
}

interface ClickUpList {
  id: string
  name: string
}

interface ClickUpMember {
  id: number
  user: {
    username: string
    email: string
  }
}

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
  permissionError,
  detectedSiteUrl = ""
}: Props) {
  const [siteName, setSiteName] = useState(project?.name ?? "")
  const [siteUrl, setSiteUrl] = useState(project?.site_url ?? "")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [showRefund, setShowRefund] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [clickUpWorkspaces, setClickUpWorkspaces] = useState<ClickUpWorkspace[]>([])
  const [clickUpSpaces, setClickUpSpaces] = useState<ClickUpSpace[]>([])
  const [clickUpFolders, setClickUpFolders] = useState<ClickUpFolder[]>([])
  const [clickUpLists, setClickUpLists] = useState<ClickUpList[]>([])
  const [clickUpMembers, setClickUpMembers] = useState<ClickUpMember[]>([])
  const [clickUpLoading, setClickUpLoading] = useState(false)
  const [oauthWindow, setOauthWindow] = useState<Window | null>(null)

  const clean = (url: string) => {
    return url.replace(/^(https?:\/\/)?(www\.)?/, "").replace(/\/$/, "").trim().toLowerCase()
  }
  const isMismatched = plan === "free" && !!detectedSiteUrl && !!project?.site_url && clean(project.site_url) !== clean(detectedSiteUrl)

  const fetchClickUpWorkspaces = async () => {
    if (!project?.clickup_api_token || !session) return
    setClickUpLoading(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clickup-api`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action: "fetch-workspaces",
          token: project.clickup_api_token
        })
      })
      if (!response.ok) throw new Error("Failed to fetch workspaces")
      const data = await response.json()
      setClickUpWorkspaces(data.workspaces || [])
    } catch (err) {
      console.error("[AF] Fetch ClickUp workspaces failed:", err)
      framer.notify("Failed to fetch ClickUp workspaces", { variant: "error" })
    } finally {
      setClickUpLoading(false)
    }
  }

  const fetchClickUpSpaces = async () => {
    if (!project?.clickup_api_token || !project?.clickup_workspace_id || !session) return
    setClickUpLoading(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clickup-api`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action: "fetch-spaces",
          token: project.clickup_api_token,
          workspaceId: project.clickup_workspace_id
        })
      })
      if (!response.ok) throw new Error("Failed to fetch spaces")
      const data = await response.json()
      setClickUpSpaces(data.spaces || [])
    } catch (err) {
      console.error("[AF] Fetch ClickUp spaces failed:", err)
      framer.notify("Failed to fetch ClickUp spaces", { variant: "error" })
    } finally {
      setClickUpLoading(false)
    }
  }

  const fetchClickUpFolders = async () => {
    if (!project?.clickup_api_token || !project?.clickup_space_id || !session) return
    setClickUpLoading(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clickup-api`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action: "fetch-folders",
          token: project.clickup_api_token,
          spaceId: project.clickup_space_id
        })
      })
      if (!response.ok) throw new Error("Failed to fetch folders")
      const data = await response.json()
      setClickUpFolders(data.folders || [])
    } catch (err) {
      console.error("[AF] Fetch ClickUp folders failed:", err)
      framer.notify("Failed to fetch ClickUp folders", { variant: "error" })
    } finally {
      setClickUpLoading(false)
    }
  }

  const fetchClickUpLists = async () => {
    if (!project?.clickup_api_token || !project?.clickup_space_id || !session) return
    setClickUpLoading(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clickup-api`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action: "fetch-lists",
          token: project.clickup_api_token,
          spaceId: project.clickup_space_id,
          folderId: project.clickup_folder_id
        })
      })
      if (!response.ok) throw new Error("Failed to fetch lists")
      const data = await response.json()
      setClickUpLists(data.lists || [])
    } catch (err) {
      console.error("[AF] Fetch ClickUp lists failed:", err)
      framer.notify("Failed to fetch ClickUp lists", { variant: "error" })
    } finally {
      setClickUpLoading(false)
    }
  }

  const fetchClickUpMembers = async () => {
    if (!project?.clickup_api_token || !project?.clickup_workspace_id || !session) return
    setClickUpLoading(true)
    try {
      console.log("[AF] Fetching ClickUp members for workspace:", project.clickup_workspace_id);
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clickup-api`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action: "fetch-members",
          token: project.clickup_api_token,
          workspaceId: project.clickup_workspace_id
        })
      })
      console.log("[AF] ClickUp members response status:", response.status);
      if (!response.ok) {
        const errorData = await response.json();
        console.error("[AF] ClickUp API error:", errorData);
        throw new Error(errorData.error || 'Failed to fetch members');
      }
      const data = await response.json()
      console.log("[AF] ClickUp members data:", data);
      setClickUpMembers(data.members || [])
    } catch (err) {
      console.error("[AF] Fetch ClickUp members failed:", err)
      framer.notify(`Failed to fetch ClickUp members: ${(err as Error).message}`, { variant: "error" })
    } finally {
      setClickUpLoading(false)
    }
  }

  const startClickUpOAuth = async () => {
    try {
      console.log("[AF] Session:", session);
      console.log("[AF] Starting ClickUp OAuth...");
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clickup-oauth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ action: "get-auth-url" })
      })
      
      console.log("[AF] OAuth URL response status:", response.status);
      if (!response.ok) {
        const errorData = await response.json();
        console.error("[AF] OAuth URL error:", errorData);
        throw new Error(errorData.error || "Failed to get auth URL");
      }
      const { authUrl } = await response.json();
      console.log("[AF] Got auth URL:", authUrl);
      
      // Open OAuth window
      const width = 600, height = 700;
      const left = window.screenLeft + (window.outerWidth - width) / 2;
      const top = window.screenTop + (window.outerHeight - height) / 2;
      const newWindow = window.open(authUrl, "ClickUp OAuth", `width=${width},height=${height},top=${top},left=${left}`);
      setOauthWindow(newWindow);
      
      // Listen for message from callback page
      const handleMessage = async (event: MessageEvent) => {
        console.log("[AF] Received message from callback:", event);
        // Only accept messages from our own origin (where clickup-callback.html is hosted)
        if (event.origin !== window.location.origin && !event.origin.includes('supabase.co') && !event.origin.includes('vercel.app')) return;
        
        if (event.data.type === 'CLICKUP_OAUTH_CODE') {
          const code = event.data.code;
          console.log("[AF] Got OAuth code:", code);
          
          // Exchange code for access token
          const tokenResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clickup-oauth`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ action: "exchange-code", code })
          });
          
          console.log("[AF] Token exchange response status:", tokenResponse.status);
          if (tokenResponse.ok) {
            const { accessToken } = await tokenResponse.json();
            console.log("[AF] Got access token!");
            onProjectUpdate({ ...project!, clickup_api_token: accessToken });
            framer.notify("Connected to ClickUp successfully!", { variant: "success" });
          } else {
            const errorData = await tokenResponse.json();
            console.error("[AF] Token exchange error:", errorData);
            framer.notify(`Connection failed: ${errorData.error || 'Unknown error'}`, { variant: "error" });
          }
          
          window.removeEventListener('message', handleMessage);
          setOauthWindow(null);
        }
      }
      
      window.addEventListener('message', handleMessage);
    } catch (err) {
      console.error("[AF] ClickUp OAuth failed:", err);
      framer.notify(`Failed to start ClickUp OAuth: ${(err as Error).message}`, { variant: "error" });
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (!newPassword || newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters.")
      return
    }
    setChangingPassword(true)
    setPasswordError(null)
    setPasswordSuccess(false)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setPasswordSuccess(true)
      setNewPassword("")
      framer.notify("Password updated successfully!", { variant: "success", durationMs: 3000 })
    } catch (err: any) {
      console.error("[AF] Change password failed:", err)
      setPasswordError(err.message || "Failed to update password.")
    } finally {
      setChangingPassword(false)
    }
  }

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
    // Reset ClickUp state when project changes
    setClickUpWorkspaces([])
    setClickUpSpaces([])
    setClickUpFolders([])
    setClickUpLists([])
    setClickUpMembers([])
  }, [project])

  // Fetch workspaces when API token is set
  useEffect(() => {
    if (project?.clickup_enabled && project?.clickup_api_token) {
      fetchClickUpWorkspaces()
    }
  }, [project?.clickup_enabled, project?.clickup_api_token])

  // Fetch spaces and members when workspace is selected
  useEffect(() => {
    if (project?.clickup_enabled && project?.clickup_workspace_id) {
      fetchClickUpSpaces()
      fetchClickUpMembers()
    }
  }, [project?.clickup_enabled, project?.clickup_workspace_id])

  // Fetch folders when space is selected
  useEffect(() => {
    if (project?.clickup_enabled && project?.clickup_space_id) {
      fetchClickUpFolders()
    }
  }, [project?.clickup_enabled, project?.clickup_space_id])

  // Fetch lists when space or folder is selected
  useEffect(() => {
    if (project?.clickup_enabled && project?.clickup_space_id) {
      fetchClickUpLists()
    }
  }, [project?.clickup_enabled, project?.clickup_space_id, project?.clickup_folder_id])

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



  return (
    <div className="settings-panel">
      {/* Script Installation Section */}
      <section className="settings-section">
        <h4 className="settings-section-title">Site Script</h4>
        
        {isMismatched && !installed && (
          <div style={{
            borderRadius: "12px",
            border: "1px solid rgba(251,146,60,0.45)",
            background: "linear-gradient(135deg, rgba(251,146,60,0.15), rgba(249,115,22,0.08))",
            padding: "14px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            marginBottom: "10px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{
                width: "28px", height: "28px", borderRadius: "8px",
                background: "rgba(251,146,60,0.12)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
              </div>
              <div>
                <span style={{ fontSize: "12px", fontWeight: "700", color: "#fb923c", display: "block" }}>Domain Mismatch</span>
                <span style={{ fontSize: "10px", color: "var(--text-sub)", lineHeight: "1.4" }}>
                  This Free account is locked to <strong style={{ color: "var(--text)" }}>{project?.site_url}</strong>. You cannot install scripts on this new website.
                </span>
              </div>
            </div>
            <button
              onClick={() => window.open(PRO_CHECKOUT_URL, "_blank")}
              style={{
                width: "100%", padding: "8px", borderRadius: "8px",
                background: "linear-gradient(135deg, #fb923c, #f97316)",
                border: "none", color: "#fff", fontSize: "11px",
                fontWeight: "700", cursor: "pointer", letterSpacing: "0.3px"
              }}
            >
              Upgrade to Pro →
            </button>
          </div>
        )}

        {!isMismatched && !installed && (
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

        {(showManualSetup || permissionError) && project && !isMismatched && (
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
          <button 
            className="btn-ghost btn-sm" 
            onClick={() => {
              setShowChangePassword(!showChangePassword)
              setPasswordError(null)
              setPasswordSuccess(false)
              setNewPassword("")
            }}
            style={{ marginLeft: "auto" }}
          >
            {showChangePassword ? "Close" : "Change Password"}
          </button>
        </div>

        {showChangePassword && (
          <form onSubmit={handleChangePassword} style={{ marginTop: "12px", borderTop: "1px solid var(--border)", paddingTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <div className="field-group">
              <label className="field-label">New Password</label>
              <input
                className="field-input"
                type="password"
                placeholder="Minimum 6 characters"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
              />
            </div>
            {passwordError && (
              <div style={{ color: "var(--red)", fontSize: "10px", marginTop: "2px" }}>
                ⚠️ {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div style={{ color: "var(--green)", fontSize: "10px", marginTop: "2px" }}>
                ✅ Password updated successfully!
              </div>
            )}
            <button className="btn-primary" type="submit" disabled={changingPassword} style={{ width: "100%", marginTop: "4px" }}>
              {changingPassword ? "Updating Password..." : "Update Password"}
            </button>
          </form>
        )}
      </section>

      {/* Project Section */}
      {project && (
        <section className="settings-section">
          <h4 className="settings-section-title">Project Settings</h4>
          <div className="field-group">
            <label className="field-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Project Name</span>
              {plan === "free" && <span style={{ fontSize: "9.5px", color: "var(--accent)", fontWeight: 600 }}>🔒 Auto-Managed (Pro to edit)</span>}
            </label>
            <input
              className="field-input"
              value={siteName}
              onChange={e => setSiteName(e.target.value)}
              placeholder="My Framer Site"
              disabled={plan === "free"}
              style={{ opacity: plan === "free" ? 0.6 : 1, cursor: plan === "free" ? "not-allowed" : "text" }}
            />
          </div>
          <div className="field-group">
            <label className="field-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Published Site URL</span>
              {plan === "free" && <span style={{ fontSize: "9.5px", color: "var(--accent)", fontWeight: 600 }}>🔒 Auto-Detected & Locked</span>}
            </label>
            <input
              className="field-input"
              value={siteUrl || ""}
              onChange={e => setSiteUrl(e.target.value)}
              placeholder="Publish site in Framer to auto-detect URL"
              disabled={plan === "free"}
              style={{ opacity: plan === "free" ? 0.6 : 1, cursor: plan === "free" ? "not-allowed" : "text" }}
            />
            {plan === "free" && !siteUrl && (
              <span style={{ fontSize: "9.5px", color: "var(--red)", marginTop: "4px", lineHeight: "1.4" }}>
                ⚠️ Please publish your Framer site to automatically detect and lock your review URL!
              </span>
            )}

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
            {plan !== "free" && (
              <button className="btn-primary btn-sm" onClick={saveProject} disabled={saving}>
                {saved ? "✅ Saved!" : saving ? "Saving…" : "Save Changes"}
              </button>
            )}
            {plan !== "free" ? (
              confirmDelete ? (
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
              )
            ) : (
              <div style={{ fontSize: "10.5px", color: "var(--text-sub)", display: "flex", alignItems: "center", gap: "4px" }}>
                <span>🔒 Deleting projects & custom domains requires a</span>
                <button 
                  onClick={() => window.open(PRO_CHECKOUT_URL, "_blank")} 
                  style={{ background: "none", border: "none", color: "var(--accent)", fontWeight: 600, padding: 0, textDecoration: "underline", cursor: "pointer", fontSize: "10.5px" }}
                >
                  Pro Plan
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ClickUp Integration Section */}
      {project && (
        <section className="settings-section">
          <h4 className="settings-section-title">ClickUp Integration</h4>
          {plan === "free" ? (
            <div style={{
              borderRadius: "12px",
              border: "1px solid rgba(59,130,246,0.2)",
              background: "linear-gradient(135deg, rgba(59,130,246,0.06), rgba(139,92,246,0.03))",
              padding: "14px",
              display: "flex",
              flexDirection: "column",
              gap: "10px"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ fontSize: "16px" }}>🔒</div>
                <div>
                  <span style={{ fontSize: "12px", fontWeight: "700", color: "#3b82f6", display: "block" }}>ClickUp Integration</span>
                  <span style={{ fontSize: "10px", color: "var(--text-sub)", lineHeight: "1.4" }}>
                    Sync client feedback to ClickUp tasks automatically. Requires Pro or Agency plan.
                  </span>
                </div>
              </div>
              <button
                onClick={() => window.open(PRO_CHECKOUT_URL, "_blank")}
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
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div className="field-group" style={{ flexDirection: "row", alignItems: "center", gap: "8px" }}>
                <input 
                  type="checkbox" 
                  id="clickupEnabled" 
                  checked={project.clickup_enabled || false}
                  onChange={e => onProjectUpdate({ ...project, clickup_enabled: e.target.checked })}
                  style={{ accentColor: "var(--accent)", cursor: "pointer", width: "16px", height: "16px" }}
                />
                <label htmlFor="clickupEnabled" className="field-label" style={{ margin: 0, cursor: "pointer" }}>
                  <span style={{ fontSize: "12px", color: "var(--text)" }}>Enable ClickUp Integration</span>
                </label>
              </div>

              {project.clickup_enabled && (
                    <>
                      <div className="field-group">
                        {!project.clickup_api_token ? (
                          <>
                            <label className="field-label">Connect your ClickUp account</label>
                            <button
                              onClick={startClickUpOAuth}
                              className="btn-primary"
                              style={{ width: "100%", padding: "10px" }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "8px" }}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                              Connect to ClickUp
                            </button>
                          </>
                        ) : (
                          <>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                              <label className="field-label" style={{ marginBottom: 0 }}>ClickUp Connected</label>
                              <button
                                onClick={() => onProjectUpdate({ ...project!, clickup_api_token: null, clickup_workspace_id: null, clickup_space_id: null, clickup_folder_id: null, clickup_list_id: null })}
                                className="btn-ghost btn-sm"
                                style={{ color: "var(--red)" }}
                              >
                                Disconnect
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                      
                      {project.clickup_api_token && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: 'var(--surface2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                          {clickUpLoading && <div style={{ fontSize: '10px', color: 'var(--text-sub)' }}>Loading...</div>}
                          
                          <div className="field-group">
                            <label className="field-label">Workspace</label>
                            <select
                              className="field-input"
                              value={project.clickup_workspace_id || ""}
                              onChange={e => onProjectUpdate({ ...project, clickup_workspace_id: e.target.value, clickup_space_id: null, clickup_folder_id: null, clickup_list_id: null })}
                            >
                              <option value="">Select Workspace</option>
                              {clickUpWorkspaces.map(workspace => (
                                <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
                              ))}
                            </select>
                          </div>
                      
                      {project.clickup_workspace_id && (
                        <div className="field-group">
                          <label className="field-label">Space</label>
                          <select
                            className="field-input"
                            value={project.clickup_space_id || ""}
                            onChange={e => onProjectUpdate({ ...project, clickup_space_id: e.target.value, clickup_folder_id: null, clickup_list_id: null })}
                          >
                            <option value="">Select Space</option>
                            {clickUpSpaces.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      
                      {project.clickup_space_id && clickUpFolders.length > 0 && (
                        <div className="field-group">
                          <label className="field-label">Folder (Optional)</label>
                          <select
                            className="field-input"
                            value={project.clickup_folder_id || ""}
                            onChange={e => onProjectUpdate({ ...project, clickup_folder_id: e.target.value, clickup_list_id: null })}
                          >
                            <option value="">No Folder</option>
                            {clickUpFolders.map(f => (
                              <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      
                      {project.clickup_space_id && (
                        <div className="field-group">
                          <label className="field-label">List</label>
                          <select
                            className="field-input"
                            value={project.clickup_list_id || ""}
                            onChange={e => onProjectUpdate({ ...project, clickup_list_id: e.target.value })}
                          >
                            <option value="">Select List</option>
                            {clickUpLists.map(l => (
                              <option key={l.id} value={l.id}>{l.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      
                      {project.clickup_workspace_id && (
                        <div className="field-group">
                          <label className="field-label">Default Assignee</label>
                          <select
                            className="field-input"
                            value={project.clickup_assignee_id || ""}
                            onChange={e => onProjectUpdate({ ...project, clickup_assignee_id: e.target.value })}
                          >
                            <option value="">Unassigned</option>
                            {clickUpMembers.map(m => (
                              <option key={m.id} value={String(m.id)}>{m.user.username || m.user.email}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="field-group" style={{ flexDirection: "row", alignItems: "center", gap: "8px" }}>
                    <input 
                      type="checkbox" 
                      id="clickupAutoSync" 
                      checked={project.clickup_auto_sync || false}
                      onChange={e => onProjectUpdate({ ...project, clickup_auto_sync: e.target.checked })}
                      style={{ accentColor: "var(--accent)", cursor: "pointer", width: "16px", height: "16px" }}
                    />
                    <label htmlFor="clickupAutoSync" className="field-label" style={{ margin: 0, cursor: "pointer", display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span style={{ fontSize: "12px", color: "var(--text)" }}>Auto-Create Tasks</span>
                      <span style={{ fontSize: "10.5px", color: "var(--text-sub)", fontWeight: 400 }}>Every new client comment automatically creates a task.</span>
                    </label>
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      )}

      {/* Upgrade Section */}
      {plan === "free" && (
        <section className="settings-section">
          <h4 className="settings-section-title">Upgrade Plan</h4>
          <button
            className="btn-primary"
            onClick={() => window.open(PRO_CHECKOUT_URL, "_blank")}
            style={{ width: "100%", background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", border: "none", fontWeight: "700", fontSize: "13px", padding: "10px", borderRadius: "8px", cursor: "pointer", color: "#fff" }}
          >
            Upgrade to Pro →
          </button>
          <p style={{ fontSize: "9.5px", color: "var(--text-sub)", margin: "8px 0 0", lineHeight: "1.4", textAlign: "center" }}>
            Use the same email on Whop for automatic subscription sync.
          </p>
        </section>
      )}

      {/* Legal & Policies Section */}
      <section className="settings-section" style={{ borderTop: "1px solid var(--border)", paddingTop: "16px", marginTop: "16px" }}>
        <h4 className="settings-section-title">Policies</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {/* Privacy Policy */}
          <div style={{ background: "var(--surface2)", borderRadius: "var(--radius)", border: "1px solid var(--border)", overflow: "hidden" }}>
            <button 
              onClick={() => setShowPrivacy(!showPrivacy)}
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                padding: "10px 12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                color: "var(--text)",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "11px",
                outline: "none"
              }}
            >
              <span>Privacy Policy</span>
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="12" 
                height="12" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.5"
                style={{ transform: showPrivacy ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
              >
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {showPrivacy && (
              <div style={{ padding: "0 12px 12px", fontSize: "10px", color: "var(--text-sub)", lineHeight: "1.4", borderTop: "1px solid var(--border)" }}>
                <p style={{ margin: "8px 0 0" }}>
                  AnnotateFrame is dedicated to protecting your data. We collect commenting metrics (coordinates, comment body, viewport widths, and client names/emails) strictly to display visual pins on your Framer site and sync them to your dashboard.
                </p>
                <p style={{ margin: "6px 0 0" }}>
                  All communications with Supabase are fully protected via Row Level Security (RLS). We never sell, track, or share your clients' personal data.
                </p>
              </div>
            )}
          </div>

          {/* Refund Policy */}
          <div style={{ background: "var(--surface2)", borderRadius: "var(--radius)", border: "1px solid var(--border)", overflow: "hidden" }}>
            <button 
              onClick={() => setShowRefund(!showRefund)}
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                padding: "10px 12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                color: "var(--text)",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "11px",
                outline: "none"
              }}
            >
              <span>Refund Policy</span>
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="12" 
                height="12" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.5"
                style={{ transform: showRefund ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
              >
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {showRefund && (
              <div style={{ padding: "0 12px 12px", fontSize: "10px", color: "var(--text-sub)", lineHeight: "1.4", borderTop: "1px solid var(--border)" }}>
                <p style={{ margin: "8px 0 0" }}>
                  We stand by the quality of AnnotateFrame. If you run into technical issues or the plugin does not work as advertised on your Framer sites, we offer an **80% money-back guarantee within 14 days** of purchase.
                </p>
                <p style={{ margin: "6px 0 0" }}>
                  To request a refund, please <a href="https://whop.com/joined/buildhaus-templates/" target="_blank" style={{ color: "var(--accent)", textDecoration: "underline" }}>open a support chat directly in your Whop checkout account</a> or email us at support@annotateframe.com.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
