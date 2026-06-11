import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!
const SUPABASE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

serve(async (req) => {
  try {
    const { comment_id } = await req.json()
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

    // Fetch the comment with project
    const { data: comment } = await sb
      .from("comments")
      .select("*, projects(name, user_id)")
      .eq("id", comment_id)
      .single()

    if (!comment) throw new Error("Comment not found")

    // Mark as resolved
    await sb.from("comments").update({
      status: "resolved",
      resolved_at: new Date().toISOString()
    }).eq("id", comment_id)

    // Email client
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Remark <notify@annotateframe.com>",
        to: comment.client_email,
        subject: "✅ Your feedback has been resolved!",
        html: `
          <div style="font-family: Inter, sans-serif; max-width: 560px; margin: auto; background: #0f0f10; color: #e8e8ed; padding: 32px; border-radius: 16px;">
            <div style="margin-bottom: 24px;">
              <span style="font-size: 24px;">📌</span>
              <strong style="font-size: 20px; margin-left: 8px;">Remark</strong>
            </div>
            <h2 style="color: #22c55e; margin-bottom: 8px;">Feedback Resolved ✅</h2>
            <p style="color: #888899; margin-bottom: 16px;">
              Hi ${comment.client_name}, the agency has resolved your feedback. Thank you for your input!
            </p>
            <div style="background: #1a1a1e; border-left: 3px solid #22c55e; padding: 14px 16px; border-radius: 8px;">
              <p style="margin: 0; font-size: 14px; font-style: italic; color: #e8e8ed;">"${comment.body}"</p>
            </div>
            <p style="color: #444; font-size: 11px; margin-top: 32px;">Remark · Framer Client Collaboration</p>
          </div>
        `,
      }),
    })

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json" }
    })
  }
})
