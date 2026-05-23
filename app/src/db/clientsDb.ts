import { supabase } from './supabaseClient'
import type { Client, ClientGstin, ClientWithGstins } from './types'

// ── Clients ───────────────────────────────────────────────

export async function getClients(): Promise<ClientWithGstins[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*, gstins:client_gstins(*)')
    .eq('is_active', true)
    .order('name')
  if (error) { console.error('getClients:', error); return [] }
  return (data ?? []) as ClientWithGstins[]
}

export async function getClientById(id: number): Promise<ClientWithGstins | null> {
  const { data, error } = await supabase
    .from('clients')
    .select('*, gstins:client_gstins(*)')
    .eq('id', id)
    .single()
  if (error) { console.error('getClientById:', error); return null }
  return data as ClientWithGstins
}

export async function upsertClient(
  client: Partial<Client> & { id?: number }
): Promise<Client | null> {
  const { data, error } = await supabase
    .from('clients')
    .upsert(client)
    .select()
    .single()
  if (error) { console.error('upsertClient:', error); return null }
  return data
}

export async function deactivateClient(id: number): Promise<void> {
  const { error } = await supabase
    .from('clients')
    .update({ is_active: false })
    .eq('id', id)
  if (error) console.error('deactivateClient:', error)
}

// ── Client GSTINs ─────────────────────────────────────────

export async function upsertClientGstin(
  gstin: Partial<ClientGstin> & { client_id: number; gstin: string }
): Promise<ClientGstin | null> {
  const { data, error } = await supabase
    .from('client_gstins')
    .upsert(gstin, { onConflict: 'client_id,gstin' })
    .select()
    .single()
  if (error) { console.error('upsertClientGstin:', error); return null }
  return data
}

export async function deleteClientGstin(id: number): Promise<void> {
  const { error } = await supabase
    .from('client_gstins')
    .delete()
    .eq('id', id)
  if (error) console.error('deleteClientGstin:', error)
}

export async function setPrimaryGstin(clientId: number, gstinId: number): Promise<void> {
  await supabase
    .from('client_gstins')
    .update({ is_primary: false })
    .eq('client_id', clientId)
  const { error } = await supabase
    .from('client_gstins')
    .update({ is_primary: true })
    .eq('id', gstinId)
  if (error) console.error('setPrimaryGstin:', error)
}
