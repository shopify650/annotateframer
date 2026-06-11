import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { action, code } = body

    if (action === 'get-auth-url') {
      // Generate ClickUp OAuth URL
      const clientId = Deno.env.get('CLICKUP_CLIENT_ID')
      const redirectUri = Deno.env.get('CLICKUP_REDIRECT_URI')
      const authUrl = `https://app.clickup.com/api?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`
      
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

      const tokenData = await tokenResponse.json()
      if (!tokenResponse.ok) throw new Error(tokenData.err || 'Failed to exchange code for token')

      // Return the access token to the client (they'll store it in the project settings)
      return new Response(JSON.stringify({ accessToken: tokenData.access_token }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    throw new Error('Invalid action')

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Internal error' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
