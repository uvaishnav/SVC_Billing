import { supabase } from './supabaseClient'
import type { Settings, BankAccount, SacCode } from './types'

// ── Settings ──────────────────────────────────────────────

export async function getSettings(): Promise<Settings | null> {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 1)
    .single()
  if (error) { console.error('getSettings:', error); return null }
  return data
}

// Use this when saving the full business profile for the first time (INSERT or full UPSERT)
export async function upsertSettings(values: Partial<Settings>): Promise<Settings | null> {
  const { data, error } = await supabase
    .from('settings')
    .upsert({ ...values, id: 1 }, { onConflict: 'id' })
    .select()
    .single()
  if (error) { console.error('upsertSettings:', error); return null }
  return data
}

// Use this for partial updates (e.g. setting a default bank account or SAC code)
// Safe to call even when settings row already exists — never risks NOT NULL violations
export async function patchSettings(values: Partial<Settings>): Promise<Settings | null> {
  const { data, error } = await supabase
    .from('settings')
    .update(values)
    .eq('id', 1)
    .select()
    .single()
  if (error) { console.error('patchSettings:', error); return null }
  return data
}

// ── Bank Accounts ─────────────────────────────────────────

export async function getBankAccounts(): Promise<BankAccount[]> {
  const { data, error } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('is_active', true)
    .order('id')
  if (error) { console.error('getBankAccounts:', error); return [] }
  return data ?? []
}

export async function upsertBankAccount(account: Partial<BankAccount> & { id?: number }): Promise<BankAccount | null> {
  const { data, error } = await supabase
    .from('bank_accounts')
    .upsert(account)
    .select()
    .single()
  if (error) { console.error('upsertBankAccount:', error); return null }
  return data
}

export async function deactivateBankAccount(id: number): Promise<void> {
  const { error } = await supabase
    .from('bank_accounts')
    .update({ is_active: false })
    .eq('id', id)
  if (error) console.error('deactivateBankAccount:', error)
}

// ── SAC Codes ─────────────────────────────────────────────

export async function getSacCodes(): Promise<SacCode[]> {
  const { data, error } = await supabase
    .from('sac_codes')
    .select('*')
    .eq('is_active', true)
    .order('id')
  if (error) { console.error('getSacCodes:', error); return [] }
  return data ?? []
}

export async function upsertSacCode(sac: Partial<SacCode> & { id?: number }): Promise<SacCode | null> {
  const { data, error } = await supabase
    .from('sac_codes')
    .upsert(sac)
    .select()
    .single()
  if (error) { console.error('upsertSacCode:', error); return null }
  return data
}

export async function deactivateSacCode(id: number): Promise<void> {
  const { error } = await supabase
    .from('sac_codes')
    .update({ is_active: false })
    .eq('id', id)
  if (error) console.error('deactivateSacCode:', error)
}
