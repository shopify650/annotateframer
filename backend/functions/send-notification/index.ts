import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!
const FROM_EMAIL = "AnnotateFrame <notify@annotateframe.com>"

async function sendEmail(to: string, subject: string, html: string) {
  return fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  })
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" },
    })
  }

  try {
    const { comment, agencyEmail } = await req.json()

    // ── Email to Agency ────────────────────────────────────────────────────
    await sendEmail(
      agencyEmail,
      `📌 New comment from ${comment.client_name}`,
      `
      <div style="font-family: Inter, -apple-system, sans-serif; max-width: 560px; margin: auto; background: #0f0f10; color: #e8e8ed; padding: 32px; border-radius: 16px;">
        <div style="margin-bottom: 24px;">
          <span style="font-size: 24px;">📌</span>
          <strong style="font-size: 20px; margin-left: 8px;">AnnotateFrame</strong>
        </div>
        <h2 style="color: #e8e8ed; margin-bottom: 8px;">New comment on your Framer site</h2>
        <p style="color: #888899; margin-bottom: 20px;">Someone just left feedback for you to review.</p>
        <div style="background: #1a1a1e; border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 16px; margin-bottom: 20px;">
          <p style="margin: 0 0 8px; color: #888899; font-size: 12px;">FROM</p>
          <p style="margin: 0 0 4px; font-weight: 600;">${comment.client_name}</p>
          <p style="margin: 0; color: #888899; font-size: 12px;">${comment.client_email}</p>
        </div>
        <div style="background: #1a1a1e; border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 16px; margin-bottom: 20px;">
          <p style="margin: 0 0 8px; color: #888899; font-size: 12px;">PAGE · ${comment.page_path}</p>
          <p style="margin: 0; font-size: 14px; line-height: 1.6; font-style: italic;">"${comment.body}"</p>
        </div>
        <a href="https://annotateframe.com/dashboard"
           style="display: inline-block; background: #6c63ff; color: white; padding: 12px 24px;
                  text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 14px;">
          View &amp; Reply →
        </a>
        <p style="color: #444; font-size: 11px; margin-top: 32px;">AnnotateFrame · Framer Client Collaboration</p>
      </div>
      `
    )

    // ── Email to Client ────────────────────────────────────────────────────
    await sendEmail(
      comment.client_email,
      "✅ Your comment was received",
      `
      <div style="font-family: Inter, -apple-system, sans-serif; max-width: 560px; margin: auto; background: #0f0f10; color: #e8e8ed; padding: 32px; border-radius: 16px;">
        <div style="margin-bottom: 24px;">
          <span style="font-size: 24px;">📌</span>
          <strong style="font-size: 20px; margin-left: 8px;">AnnotateFrame</strong>
        </div>
        <h2 style="color: #e8e8ed; margin-bottom: 8px;">Comment received! ✅</h2>
        <p style="color: #888899; margin-bottom: 20px;">Hi ${comment.client_name}, your feedback has been delivered to the agency. You'll get an email when it's been resolved.</p>
        <div style="background: #1a1a1e; border-left: 3px solid #6c63ff; padding: 14px 16px; border-radius: 8px; margin-bottom: 20px;">
          <p style="margin: 0; font-size: 14px; font-style: italic; color: #e8e8ed;">"${comment.body}"</p>
        </div>
        <p style="color: #444; font-size: 11px; margin-top: 32px;">AnnotateFrame · Framer Client Collaboration</p>
      </div>
      `
    )

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
