import { framer } from "framer-plugin"

const SCRIPT_MARKER = "annotateframe.min.js"

/**
 * Injects the AnnotateFrame client script into the live published Framer site
 * using the native framer.setCustomCode() API.
 */
export async function injectAnnotateFrameScript(
  projectId: string,
  supabaseUrl: string,
  supabaseAnonKey: string
): Promise<void> {
  // Live Vercel URL
  const scriptUrl = "https://project-pymvu.vercel.app/annotateframe.min.js"

  const html = `
<!-- AnnotateFrame Start -->
<script>
  window.ANNOTATEFRAME_PROJECT_ID = "${projectId}";
  window.ANNOTATEFRAME_SUPABASE_URL = "${supabaseUrl}";
  window.ANNOTATEFRAME_ANON_KEY = "${supabaseAnonKey}";
</script>
<script src="${scriptUrl}" defer></script>
<!-- AnnotateFrame End -->
`.trim()

  await framer.setCustomCode({ html, location: "bodyEnd" })
  console.log("[AnnotateFrame] ✅ Script injected successfully")
}

/**
 * Removes the AnnotateFrame script from the site (pause / uninstall).
 */
export async function removeAnnotateFrameScript(): Promise<void> {
  await framer.setCustomCode({ html: null, location: "bodyEnd" })
  console.log("[AnnotateFrame] Script removed")
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
