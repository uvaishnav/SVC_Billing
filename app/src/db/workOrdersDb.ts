import { supabase } from './supabaseClient'
import type { WorkOrder, WorkOrderWithClient, WorkOrderItem } from './types'

// ─── Status computation (client-side) ────────────────────────
export function computeWOStatus(wo: WorkOrder): WorkOrder['status'] {
  if (wo.status === 'closed') return 'closed'
  if (!wo.valid_to) return 'active'
  const today = new Date()
  const validTo = new Date(wo.valid_to)
  const daysLeft = Math.ceil((validTo.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (daysLeft < 0) return 'expired'
  if (daysLeft <= 30) return 'expiring_soon'
  return 'active'
}

// ─── Work Orders ─────────────────────────────────────────────
export async function getWorkOrders(): Promise<WorkOrderWithClient[]> {
  const { data, error } = await supabase
    .from('work_orders')
    .select('*, clients(name), projects(name)')
    .order('issue_date', { ascending: false })
  if (error) { console.error('getWorkOrders:', error); return [] }
  return (data ?? []).map((row: any) => ({
    ...row,
    client_name: row.clients?.name ?? null,
    project_name: row.projects?.name ?? null,
    clients: undefined,
    projects: undefined,
  }))
}

export async function getWorkOrdersByClient(clientId: number): Promise<WorkOrderWithClient[]> {
  const { data, error } = await supabase
    .from('work_orders')
    .select('*, clients(name), projects(name)')
    .eq('client_id', clientId)
    .order('issue_date', { ascending: false })
  if (error) { console.error('getWorkOrdersByClient:', error); return [] }
  return (data ?? []).map((row: any) => ({
    ...row,
    client_name: row.clients?.name ?? null,
    project_name: row.projects?.name ?? null,
    clients: undefined,
    projects: undefined,
  }))
}

export async function upsertWorkOrder(
  wo: Partial<WorkOrder> & { subject: string; issue_date: string }
): Promise<WorkOrder | null> {
  const { data, error } = await supabase
    .from('work_orders')
    .upsert(wo, { onConflict: 'id' })
    .select()
    .single()
  if (error) { console.error('upsertWorkOrder:', error); return null }
  return data
}

export async function closeWorkOrder(id: number): Promise<void> {
  const { error } = await supabase
    .from('work_orders')
    .update({ status: 'closed' })
    .eq('id', id)
  if (error) console.error('closeWorkOrder:', error)
}

// ─── Work Order Items ─────────────────────────────────────────
export async function getWorkOrderItems(workOrderId: number): Promise<WorkOrderItem[]> {
  const { data, error } = await supabase
    .from('work_order_items')
    .select('*')
    .eq('work_order_id', workOrderId)
    .order('sl_no')
  if (error) { console.error('getWorkOrderItems:', error); return [] }
  return data ?? []
}

export async function upsertWorkOrderItems(
  workOrderId: number,
  items: Omit<WorkOrderItem, 'id' | 'created_at' | 'work_order_id'>[]
): Promise<boolean> {
  // Delete existing items then re-insert (clean replace)
  const { error: delErr } = await supabase
    .from('work_order_items')
    .delete()
    .eq('work_order_id', workOrderId)
  if (delErr) { console.error('deleteWorkOrderItems:', delErr); return false }

  if (items.length === 0) return true

  const rows = items.map((item, i) => ({
    ...item,
    work_order_id: workOrderId,
    sl_no: item.sl_no ?? i + 1,
    amount: item.contracted_qty && item.rate ? item.contracted_qty * item.rate : null,
  }))

  const { error: insErr } = await supabase
    .from('work_order_items')
    .insert(rows)
  if (insErr) { console.error('insertWorkOrderItems:', insErr); return false }
  return true
}

export async function deleteWorkOrderItem(id: number): Promise<void> {
  const { error } = await supabase
    .from('work_order_items')
    .delete()
    .eq('id', id)
  if (error) console.error('deleteWorkOrderItem:', error)
}
