import { supabase } from './supabaseClient'
import type { Vehicle } from './types'

export async function getVehicles(): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('is_active', true)
    .order('reg_number')
  if (error) { console.error('getVehicles:', error); return [] }
  return data ?? []
}

export async function upsertVehicle(
  vehicle: Partial<Vehicle> & { reg_number: string }
): Promise<Vehicle | null> {
  const { data, error } = await supabase
    .from('vehicles')
    .upsert(vehicle, { onConflict: 'id' })
    .select()
    .single()
  if (error) { console.error('upsertVehicle:', error); return null }
  return data
}

export async function deactivateVehicle(id: number): Promise<void> {
  const { error } = await supabase
    .from('vehicles')
    .update({ is_active: false })
    .eq('id', id)
  if (error) console.error('deactivateVehicle:', error)
}
