// Supabase Edge Function: verify-membership
// Verifies user membership with Whop API and updates DB plan status.
// Called by the Framer plugin to "Restore Purchase" securely.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WHOP_API_KEY = Deno.env.get("WHOP_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// CORS headers for preflight requests from the Framer plugin
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase Client with the user's JWT to verify their identity
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !user || !user.email) {
      console.error("[verify-membership] Auth failed:", authError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized user session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = user.email;
    console.log(`[verify-membership] Checking Whop membership for email: ${email}`);

    if (!WHOP_API_KEY) {
      console.error("[verify-membership] WHOP_API_KEY environment variable is not set!");
      return new Response(JSON.stringify({ error: "Server misconfiguration: API key missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Search for the member in Whop using their email
    const memberRes = await fetch(
      `https://api.whop.com/api/v1/members?query=${encodeURIComponent(email)}`,
      {
        headers: {
          Authorization: `Bearer ${WHOP_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!memberRes.ok) {
      const errText = await memberRes.text();
      console.error(`[verify-membership] Whop Member Search API returned error: ${memberRes.status}`, errText);
      return new Response(JSON.stringify({ error: "Failed to query Whop API" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const memberData = await memberRes.json();
    const membersList = memberData?.data || [];

    let hasActiveMembership = false;

    // Whitelist for manual Pro upgrades (e.g. manual support / override)
    const WHITELIST_PRO_EMAILS = [
      "xavelop375@esyline.com"
    ];

    if (WHITELIST_PRO_EMAILS.includes(email.toLowerCase())) {
      hasActiveMembership = true;
      console.log(`[verify-membership] Email ${email} is whitelisted for Pro!`);
    } else if (membersList.length > 0) {
      // Find the first member with matching user details
      const matchedMember = membersList.find(
        (m: any) => m.user?.email?.toLowerCase() === email.toLowerCase()
      ) || membersList[0];

      // Extremely resilient check: if they have successfully joined the company
      // as a customer or admin, they have active access!
      hasActiveMembership = 
        matchedMember.status === "joined" && 
        (matchedMember.access_level === "customer" || matchedMember.access_level === "admin");
        
      console.log(`[verify-membership] Checked member access. Status: ${matchedMember.status}, Level: ${matchedMember.access_level}. Active: ${hasActiveMembership}`);
    }

    const newPlan = hasActiveMembership ? "pro" : "free";

    // Step 3: Update plan in local Supabase DB
    const { error: updateError, count } = await supabase
      .from("projects")
      .update({ plan: newPlan })
      .eq("user_id", user.id);

    if (updateError) {
      console.error("[verify-membership] DB update error:", updateError.message);
      return new Response(JSON.stringify({ error: "Failed to update project plan in database" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[verify-membership] Successfully verified and updated ${count ?? "all"} projects to plan: ${newPlan}`);

    return new Response(JSON.stringify({ 
      success: true, 
      plan: newPlan, 
      active: hasActiveMembership,
      message: hasActiveMembership 
        ? "Pro plan activated successfully! Feel free to refresh the dashboard." 
        : "No active Whop membership found for this email address." 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[verify-membership] Unexpected handler crash:", err.message);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
