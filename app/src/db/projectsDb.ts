import { supabase } from './supabaseClient'
import type { Project, ProjectWithClient } from './types'

export async function getProjects(): Promise<ProjectWithClient[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*, clients(name)')
    .eq('is_active', true)
    .order('name')
  if (error) { console.error('getProjects:', error); return [] }
  return (data ?? []).map((row: any) => ({
    ...row,
    client_name: row.clients?.name ?? null,
    clients: undefined,
  }))
}

export async function getAllProjects(): Promise<ProjectWithClient[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*, clients(name)')
    .order('name')
  if (error) { console.error('getAllProjects:', error); return [] }
  return (data ?? []).map((row: any) => ({
    ...row,
    client_name: row.clients?.name ?? null,
    clients: undefined,
  }))
}

export async function upsertProject(
  project: Partial<Project> & { name: string; place_of_supply: string; state_code: string }
): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects')
    .upsert(project, { onConflict: 'id' })
    .select()
    .single()
  if (error) { console.error('upsertProject:', error); return null }
  return data
}

export async function deactivateProject(id: number): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({ is_active: false })
    .eq('id', id)
  if (error) console.error('deactivateProject:', error)
}
