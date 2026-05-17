// AnnotateFrame — Type Definitions

export interface Project {
  id: string
  user_id: string
  name: string
  site_url: string | null
  invite_token: string
  created_at: string
}

export interface Comment {
  id: string
  project_id: string
  client_name: string
  client_email: string
  body: string
  x_percent: number
  y_percent: number
  page_path: string
  status: "open" | "resolved"
  resolved_at: string | null
  browser: string | null
  viewport_w: number | null
  screenshot?: string | null
  created_at: string
  replies?: Reply[]
}

export interface Reply {
  id: string
  comment_id: string
  author: string
  body: string
  created_at: string
}

export interface AuthSession {
  user: {
    id: string
    email?: string
  }
  access_token: string
}

export type TabType = "comments" | "invite" | "settings"
export type PlanType = "free" | "pro" | "agency"

export interface PlanLimits {
  maxProjects: number
  maxComments: number
  emailNotifications: boolean
  replies: boolean
  whiteLabelModal: boolean
  teamSeats: number
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  free: {
    maxProjects: 1,
    maxComments: 10,
    emailNotifications: false,
    replies: false,
    whiteLabelModal: false,
    teamSeats: 1,
  },
  pro: {
    maxProjects: Infinity,
    maxComments: Infinity,
    emailNotifications: true,
    replies: true,
    whiteLabelModal: false,
    teamSeats: 1,
  },
  agency: {
    maxProjects: Infinity,
    maxComments: Infinity,
    emailNotifications: true,
    replies: true,
    whiteLabelModal: true,
    teamSeats: 3,
  },
}
