import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log("[ClickUp-API] =======================================");
  console.log("[ClickUp-API] Function invoked!");
  console.log("[ClickUp-API] Method:", req.method);
  console.log("[ClickUp-API] Headers:", Object.fromEntries(req.headers.entries()));
  
  if (req.method === 'OPTIONS') {
    console.log("[ClickUp-API] Handling OPTIONS request");
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    console.log("[ClickUp-API] Auth token present:", token.length > 0);
    
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

    console.log("[ClickUp-API] Reading request body...");
    const body = await req.json()
    console.log("[ClickUp-API] Request body:", JSON.stringify(body, null, 2));
    
    const { action, token: clickupToken, workspaceId, spaceId, folderId, listId, commentId, projectId, replyId } = body
    const activeClickupToken = clickupToken || body.token;
    console.log("[ClickUp-API] Action:", action);
    console.log("[ClickUp-API] Using ClickUp token:", activeClickupToken ? "yes" : "no");

    const headers = {
      'Authorization': activeClickupToken,
      'Content-Type': 'application/json'
    }

    if (action === 'test-token' || action === 'fetch-workspaces') {
      console.log("[ClickUp-API] Fetching workspaces...");
      const res = await fetch('https://api.clickup.com/api/v2/team', { headers })
      const data = await res.json()
      console.log("[ClickUp-API] ClickUp workspaces response status:", res.status);
      console.log("[ClickUp-API] ClickUp workspaces data:", JSON.stringify(data, null, 2));
      if (!res.ok) throw new Error(data.err || data.message || 'Failed to fetch workspaces');
      return new Response(JSON.stringify({ workspaces: data.teams }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    if (action === 'fetch-spaces') {
      console.log("[ClickUp-API] Fetching spaces...");
      const res = await fetch(`https://api.clickup.com/api/v2/team/${workspaceId}/space', { headers })
      const data = await res.json()
      console.log("[ClickUp-API] ClickUp spaces response status:", res.status);
      console.log("[ClickUp-API] ClickUp spaces data:", JSON.stringify(data, null, 2));
      if (!res.ok) throw new Error(data.err || data.message || 'Failed to fetch spaces');
      return new Response(JSON.stringify({ spaces: data.spaces }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    if (action === 'fetch-folders') {
      console.log("[ClickUp-API] Fetching folders...");
      const res = await fetch(`https://api.clickup.com/api/v2/space/${spaceId}/folder', { headers })
      const data = await res.json()
      console.log("[ClickUp-API] ClickUp folders response status:", res.status);
      console.log("[ClickUp-API] ClickUp folders data:", JSON.stringify(data, null, 2));
      if (!res.ok) throw new Error(data.err || data.message || 'Failed to fetch folders');
      return new Response(JSON.stringify({ folders: data.folders }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    if (action === 'fetch-lists') {
      console.log("[ClickUp-API] Fetching lists...");
      let url = folderId 
        ? `https://api.clickup.com/api/v2/folder/${folderId}/list`
        : `https://api.clickup.com/api/v2/space/${spaceId}/list`
      const res = await fetch(url, { headers })
      const data = await res.json()
      console.log("[ClickUp-API] ClickUp lists response status:", res.status);
      console.log("[ClickUp-API] ClickUp lists data:", JSON.stringify(data, null, 2));
      if (!res.ok) throw new Error(data.err || data.message || 'Failed to fetch lists');
      return new Response(JSON.stringify({ lists: data.lists }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    if (action === 'fetch-members') {
      console.log("[ClickUp-API] Fetching members for workspace:", workspaceId);
      const url = `https://api.clickup.com/api/v2/team/${workspaceId}/member`;
      console.log("[ClickUp-API] Calling ClickUp URL:", url);
      const res = await fetch(url, { headers })
      console.log("[ClickUp-API] ClickUp members response status:", res.status);
      const responseText = await res.text();
      console.log("[ClickUp-API] ClickUp members raw response:", responseText);
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error("[ClickUp-API] Failed to parse ClickUp response as JSON");
        throw new Error(`ClickUp returned invalid JSON: ${responseText}`);
      }
      console.log("[ClickUp-API] ClickUp members parsed data:", JSON.stringify(data, null, 2));
      if (!res.ok) {
        console.error("[ClickUp-API] ClickUp API error:", data);
        throw new Error(data.err || data.message || 'Failed to fetch members');
      }
      const members = data.members || data.team?.members || [];
      console.log("[ClickUp-API] Extracted members:", members);
      return new Response(JSON.stringify({ members }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    if (action === 'create-task') {
      console.log("[ClickUp-API] Creating task...");
      const { data: comment } = await supabaseClient.from('comments').select('*').eq('id', commentId).single()
      if (!comment) throw new Error('Comment not found')
      
      const { data: project } = await supabaseClient.from('projects').select('*').eq('id', projectId).single()
      if (!project) throw new Error('Project not found')

      const activeToken = project.clickup_api_token || activeClickupToken
      if (!activeToken) throw new Error('ClickUp integration not configured')
      
      const activeListId = project.clickup_list_id || listId
      if (!activeListId) throw new Error('ClickUp list not configured')

      const taskData: any = {
        name: `[AnnotateFrame] ${comment.body.substring(0, 50)}${comment.body.length > 50 ? '...' : ''}`,
        description: `Comment:\n${comment.body}\n\nPage:\n${comment.page_path}\n\nProject:\n${project.name}\n\nDevice:\n${comment.browser || 'Unknown'}\n\nStatus:\n${comment.status}\n\nCreated:\n${comment.created_at}\n\nAnnotateFrame Comment ID:\n${comment.id}`,
        status: 'OPEN'
      }

      if (project.clickup_assignee_id) {
        taskData.assignees = [Number(project.clickup_assignee_id)]
      }

      const res = await fetch(`https://api.clickup.com/api/v2/list/${activeListId}/task`, {
        method: 'POST',
        headers: {
          'Authorization': activeToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(taskData)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.err || 'Failed to create task')

      await supabaseClient.from('comments').update({
        clickup_task_id: data.id,
        clickup_task_url: data.url,
        clickup_synced: true
      }).eq('id', comment.id)

      return new Response(JSON.stringify({ success: true, task: data }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    if (action === 'create-comment') {
      const { data: reply } = await supabaseClient.from('replies').select('*').eq('id', replyId).single()
      if (!reply) throw new Error('Reply not found')

      const { data: comment } = await supabaseClient.from('comments').select('*').eq('id', reply.comment_id).single()
      if (!comment) throw new Error('Comment not found')

      const { data: project } = await supabaseClient.from('projects').select('*').eq('id', comment.project_id).single()
      if (!project) throw new Error('Project not found')

      if (!project.clickup_api_token) throw new Error('ClickUp integration not configured')
      if (!comment.clickup_task_id) throw new Error('Comment not synced to ClickUp')

      const commentData = {
        comment_text: `**${reply.author}**: ${reply.body}`
      }

      const res = await fetch(`https://api.clickup.com/api/v2/task/${comment.clickup_task_id}/comment`, {
        method: 'POST',
        headers: {
          'Authorization': project.clickup_api_token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(commentData)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.err || 'Failed to add comment to ClickUp')

      return new Response(JSON.stringify({ success: true, comment: data }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    throw new Error('Invalid action')

  } catch (error: any) {
    console.error("[ClickUp-API] FULL ERROR:", error);
    const errorResponse = {
      error: error.message || 'Internal server error',
      stack: error.stack
    };
    return new Response(JSON.stringify(errorResponse), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
