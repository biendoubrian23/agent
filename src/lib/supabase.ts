import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types pour TypeScript
export interface Profile {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  phone_number: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface UserAgent {
  id: string
  user_id: string
  agent_name: string
  is_active: boolean
  system_prompt: string | null
  created_at: string
  updated_at: string
}

export interface AgentPermission {
  id: string
  user_agent_id: string
  permission_key: string
  enabled: boolean
}

export interface AgentStats {
  id: string
  user_id: string
  agent_name: string
  stat_date: string
  emails_processed: number
  emails_today: number
  urgent_emails: number
  transactions_processed: number
  tasks_created: number
  last_sync: string | null
}

export interface AgentActivity {
  id: string
  user_id: string
  agent_name: string
  action: string
  status: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface UserConnection {
  id: string
  user_id: string
  service_name: string
  is_connected: boolean
  token_expires_at: string | null
}
