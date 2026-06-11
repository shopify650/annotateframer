import { framer } from "framer-plugin"

const SCRIPT_MARKER = "remark.min.js"

/**
 * Injects the Remark client script into the live published Framer site
 * using the native framer.setCustomCode() API.
 */
export async function injectRemarkScript(
  projectId: string,
  supabaseUrl: string,
  supabaseAnonKey: string
): Promise<void> {
  // Live Vercel URL
  const scriptUrl = "https://project-pymvu.vercel.app/remark.min.js"

  const html = `
<!-- Remark Start -->
<script>
  window.REMARK_PROJECT_ID = "${projectId}";
  window.REMARK_SUPABASE_URL = "${supabaseUrl}";
  window.REMARK_ANON_KEY = "${supabaseAnonKey}";
</script>
<script src="${scriptUrl}" defer></script>
<!-- Remark End -->
`.trim()

  await framer.setCustomCode({ html, location: "bodyEnd" })
  console.log("[Remark] ✅ Script injected successfully")
}

/**
 * Removes the Remark script from the site (pause / uninstall).
 */
export async function removeRemarkScript(): Promise<void> {
  await framer.setCustomCode({ html: null, location: "bodyEnd" })
  console.log("[Remark] Script removed")
}

/**
 * Returns true if the script is currently injected into the site.
 */
export async function isScriptInstalled(): Promise<boolean> {
  try {
    const customCode = await framer.getCustomCode()
    const html = customCode?.bodyEnd?.html ?? ""
    return html.includes(SCRIPT_MARKER)
  } catch {
    return false
  }
}
