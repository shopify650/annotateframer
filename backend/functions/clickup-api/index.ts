import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log("[ClickUp-API] Function started");
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log("[ClickUp-API] Extracting token from headers...");
    // Get the auth token from headers
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    console.log("[ClickUp-API] Token extracted:", token.length > 0 ? "present" : "missing");
    
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

    console.log("[ClickUp-API] Skipping auth check for testing...");

    const body = await req.json()
    const { action, token: clickupToken, workspaceId, spaceId, folderId, listId, commentId, projectId, replyId } = body
    const activeClickupToken = clickupToken || body.token; // Handle both variable names for compatibility

    // Optional: check if they are pro/agency plan from backend if action == 'create-task'
    // For now we trust the frontend UI hiding it, but ideally we'd query projects table.

    const headers = {
      'Authorization': activeClickupToken,
      'Content-Type': 'application/json'
    }

    if (action === 'test-token' || action === 'fetch-workspaces') {
      const res = await fetch('https://api.clickup.com/api/v2/team', { headers: { 'Authorization': activeClickupToken, 'Content-Type': 'application/json' } })
      const data = await res.json()
      if (!res.ok) throw new Error(data.err || 'Failed to fetch workspaces')
      return new Response(JSON.stringify({ workspaces: data.teams }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'fetch-spaces') {
      const res = await fetch(`https://api.clickup.com/api/v2/team/${workspaceId}/space`, { headers: { 'Authorization': activeClickupToken, 'Content-Type': 'application/json' } })
      const data = await res.json()
      if (!res.ok) throw new Error(data.err || 'Failed to fetch spaces')
      return new Response(JSON.stringify({ spaces: data.spaces }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'fetch-folders') {
      const res = await fetch(`https://api.clickup.com/api/v2/space/${spaceId}/folder`, { headers: { 'Authorization': activeClickupToken, 'Content-Type': 'application/json' } })
      const data = await res.json()
      if (!res.ok) throw new Error(data.err || 'Failed to fetch folders')
      return new Response(JSON.stringify({ folders: data.folders }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'fetch-lists') {
      let url = folderId 
        ? `https://api.clickup.com/api/v2/folder/${folderId}/list`
        : `https://api.clickup.com/api/v2/space/${spaceId}/list`
      const res = await fetch(url, { headers: { 'Authorization': activeClickupToken, 'Content-Type': 'application/json' } })
      const data = await res.json()
      if (!res.ok) throw new Error(data.err || 'Failed to fetch lists')
      return new Response(JSON.stringify({ lists: data.lists }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'fetch-members') {
      console.log("[ClickUp-API] Fetching members for workspace:", workspaceId);
      const res = await fetch(`https://api.clickup.com/api/v2/team/${workspaceId}/member`, { headers: { 'Authorization': activeClickupToken, 'Content-Type': 'application/json' } })
      const data = await res.json()
      console.log("[ClickUp-API] ClickUp API members response:", data);
      if (!res.ok) throw new Error(data.err || 'Failed to fetch members')
      return new Response(JSON.stringify({ members: data.members }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'create-task') {
      // Fetch comment details securely from Supabase
      const { data: comment } = await supabaseClient.from('comments').select('*').eq('id', commentId).single()
      if (!comment) throw new Error('Comment not found')
      
      const { data: project } = await supabaseClient.from('projects').select('*').eq('id', projectId).single()
      if (!project) throw new Error('Project not found')

      // Use the project's saved token instead of the one passed in body for security, 
      // but if token is passed we can use it (useful for initial test).
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

      // Update the comment in Supabase
      await supabaseClient.from('comments').update({
        clickup_task_id: data.id,
        clickup_task_url: data.url,
        clickup_synced: true
      }).eq('id', comment.id)

      return new Response(JSON.stringify({ success: true, task: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'create-comment') {
      // Fetch reply, comment, and project details
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

      return new Response(JSON.stringify({ success: true, comment: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    throw new Error('Invalid action')

  } catch (error: any) {
    console.error("[ClickUp-API] Error:", error);
    return new Response(JSON.stringify({ error: error.message || 'Internal error' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
