import { supabase } from './supabaseClient'
import type { Project, ProjectWithClient } from './types'

export async function getProjects(): Promise<ProjectWithClient[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*, clients(name)')
    .eq('is_active', true)
    .order('name')
  if (error) { console.error('getProjects:', error); return [] }

  const woIds = Array.from(new Set((data ?? []).map((r: any) => r.work_order_id).filter(Boolean)))
  const woMap = new Map<number, { wo_reference: string | null; subject: string | null }>()
  if (woIds.length > 0) {
    try {
      const { data: wos } = await supabase
        .from('work_orders')
        .select('id, wo_reference, subject')
        .in('id', woIds)
      if (wos) {
        for (const w of wos) {
          woMap.set(w.id, { wo_reference: w.wo_reference, subject: w.subject })
        }
      }
    } catch (err) {
      console.warn('Projects WO fetch notice:', err)
    }
  }

  return (data ?? []).map((row: any) => ({
    ...row,
    client_name: row.clients?.name ?? null,
    work_order_reference: woMap.get(row.work_order_id)?.wo_reference ?? null,
    work_order_subject: woMap.get(row.work_order_id)?.subject ?? null,
    clients: undefined,
  }))
}

export async function getAllProjects(): Promise<ProjectWithClient[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*, clients(name)')
    .order('name')
  if (error) { console.error('getAllProjects:', error); return [] }

  const woIds = Array.from(new Set((data ?? []).map((r: any) => r.work_order_id).filter(Boolean)))
  const woMap = new Map<number, { wo_reference: string | null; subject: string | null }>()
  if (woIds.length > 0) {
    try {
      const { data: wos } = await supabase
        .from('work_orders')
        .select('id, wo_reference, subject')
        .in('id', woIds)
      if (wos) {
        for (const w of wos) {
          woMap.set(w.id, { wo_reference: w.wo_reference, subject: w.subject })
        }
      }
    } catch (err) {
      console.warn('Projects WO fetch notice:', err)
    }
  }

  return (data ?? []).map((row: any) => ({
    ...row,
    client_name: row.clients?.name ?? null,
    work_order_reference: woMap.get(row.work_order_id)?.wo_reference ?? null,
    work_order_subject: woMap.get(row.work_order_id)?.subject ?? null,
    clients: undefined,
  }))
}

export async function getProjectsByClient(clientId: number): Promise<ProjectWithClient[]> {
  const all = await getProjects()
  return all.filter(p => p.client_id === clientId)
}

export async function getProjectsByWorkOrder(workOrderId: number): Promise<ProjectWithClient[]> {
  const all = await getProjects()
  return all.filter(p => p.work_order_id === workOrderId)
}

export async function linkProjectsToWorkOrder(workOrderId: number, projectIds: number[]): Promise<void> {
  // First, unset work_order_id for projects currently linked to this WO that are NOT in projectIds
  const current = await getProjectsByWorkOrder(workOrderId)
  const toUnlink = current.filter(p => !projectIds.includes(p.id)).map(p => p.id)
  if (toUnlink.length > 0) {
    await supabase.from('projects').update({ work_order_id: null }).in('id', toUnlink)
  }
  // Then link selected projectIds to this workOrderId
  if (projectIds.length > 0) {
    await supabase.from('projects').update({ work_order_id: workOrderId }).in('id', projectIds)
  }
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
