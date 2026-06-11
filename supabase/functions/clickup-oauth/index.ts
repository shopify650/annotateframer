import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log("[ClickUp-OAuth] Function started");
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log("[ClickUp-OAuth] Extracting token from headers...");
    // Get the auth token from headers
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    console.log("[ClickUp-OAuth] Token extracted:", token.length > 0 ? "present" : "missing");
    
    // Create a Supabase client with the ANON key and user's token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { 
        global: { 
          headers: { 
            Authorization: token ? `Bearer ${token}` : ''
          } 
        } 
      }
    )

    console.log("[ClickUp-OAuth] Skipping auth check for testing...");

    const body = await req.json()
    const { action, code } = body
    console.log("[ClickUp-OAuth] Action requested:", action);

    if (action === 'get-auth-url') {
      // Generate ClickUp OAuth URL
      const clientId = Deno.env.get('CLICKUP_CLIENT_ID')
      const redirectUri = Deno.env.get('CLICKUP_REDIRECT_URI')
      
      console.log("[ClickUp-OAuth] CLICKUP_CLIENT_ID present:", !!clientId);
      console.log("[ClickUp-OAuth] CLICKUP_REDIRECT_URI present:", !!redirectUri);
      
      if (!clientId || !redirectUri) {
        console.error("[ClickUp-OAuth] Missing environment variables!");
        throw new Error("ClickUp integration not configured on server");
      }
      
      const authUrl = `https://app.clickup.com/api?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`
      console.log("[ClickUp-OAuth] Generated auth URL:", authUrl);
      
      return new Response(JSON.stringify({ authUrl }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    if (action === 'exchange-code') {
      // Exchange authorization code for access token
      const clientId = Deno.env.get('CLICKUP_CLIENT_ID')
      const clientSecret = Deno.env.get('CLICKUP_CLIENT_SECRET')
      const redirectUri = Deno.env.get('CLICKUP_REDIRECT_URI')

      console.log("[ClickUp-OAuth] Exchanging code for token...");
      console.log("[ClickUp-OAuth] All env vars present:", !!clientId && !!clientSecret && !!redirectUri);

      const tokenResponse = await fetch('https://api.clickup.com/api/v2/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
          redirect_uri: redirectUri
        })
      })

      console.log("[ClickUp-OAuth] ClickUp token response status:", tokenResponse.status);
      const tokenData = await tokenResponse.json()
      console.log("[ClickUp-OAuth] ClickUp token response data:", tokenData);
      
      if (!tokenResponse.ok) throw new Error(tokenData.err || 'Failed to exchange code for token')

      // Return the access token to the client (they'll store it in the project settings)
      return new Response(JSON.stringify({ accessToken: tokenData.access_token }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    throw new Error('Invalid action')

  } catch (error: any) {
    console.error("[ClickUp-OAuth] Error:", error);
    return new Response(JSON.stringify({ error: error.message || 'Internal error' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
