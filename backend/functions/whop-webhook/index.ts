// Supabase Edge Function: whop-webhook
// Handles membership_activated → set plan = 'pro'
// Handles membership_deactivated → set plan = 'free'

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WHOP_WEBHOOK_SECRET = Deno.env.get("WHOP_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Verify Whop HMAC-SHA256 signature
async function verifyWhopSignature(
  rawBody: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const sigBytes = hexToBytes(signature);
    return await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(rawBody));
  } catch {
    return false;
  }
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, 2), 16);
  }
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("whop-signature") ?? "";

  // Verify signature (skip in dev if secret not set)
  if (WHOP_WEBHOOK_SECRET) {
    const valid = await verifyWhopSignature(rawBody, signature, WHOP_WEBHOOK_SECRET);
    if (!valid) {
      console.error("[whop-webhook] Invalid signature");
      return new Response("Unauthorized", { status: 401 });
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Bad Request: invalid JSON", { status: 400 });
  }

  const { action, data } = payload;
  console.log(`[whop-webhook] Received event: ${action}`);

  // Extract user email from Whop payload
  const email =
    data?.user?.email ||
    data?.email ||
    data?.membership?.user?.email ||
    null;

  if (!email) {
    console.warn("[whop-webhook] No email found in payload:", JSON.stringify(data));
    return new Response("OK - no email found", { status: 200 });
  }

  // Determine target plan
  let newPlan: string | null = null;
  if (action === "membership_activated" || action === "membership.activated") {
    newPlan = "pro";
  } else if (action === "membership_deactivated" || action === "membership.deactivated") {
    newPlan = "free";
  } else {
    // Unhandled event — acknowledge and ignore
    return new Response("OK - event ignored", { status: 200 });
  }

  // Update all projects belonging to this user's email
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Find user by email in auth.users
  const { data: users, error: userError } = await supabase
    .from("auth.users")
    .select("id")
    .eq("email", email)
    .limit(1);

  // Use admin API to look up user by email
  const { data: adminUser, error: adminError } = await supabase.auth.admin.getUserByEmail(email);

  if (adminError || !adminUser?.user?.id) {
    console.warn(`[whop-webhook] User not found for email: ${email}`);
    // Return 200 so Whop doesn't retry — user may not have signed up yet
    return new Response("OK - user not found", { status: 200 });
  }

  const userId = adminUser.user.id;

  // Update plan on ALL projects owned by this user
  const { error: updateError, count } = await supabase
    .from("projects")
    .update({ plan: newPlan })
    .eq("user_id", userId);

  if (updateError) {
    console.error("[whop-webhook] DB update failed:", updateError.message);
    return new Response("Internal Server Error", { status: 500 });
  }

  console.log(`[whop-webhook] Updated ${count ?? "all"} projects for ${email} → plan: ${newPlan}`);
  return new Response(JSON.stringify({ ok: true, email, plan: newPlan }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
