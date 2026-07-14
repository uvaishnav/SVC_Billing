/**
 * InvoiceListScreen.tsx
 * Main invoice list screen — search, filter by status, preview PDF, delete.
 *
 * Design decisions:
 *  - Fetches from Supabase `invoices` table with client name join.
 *  - Search filters on invoice_number OR client name (client-side on fetched data).
 *  - Status filter chips: All | Draft | Finalised.
 *  - Swipe-to-delete with confirmation alert before hard delete.
 *  - Tapping a row opens InvoicePreviewModal (PDF preview).
 *  - FAB navigates to CreateInvoiceScreen.
 */
import React, { useCallback, useEffect, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, StyleSheet, Alert,
  RefreshControl, StatusBar,
} from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/types'
import { supabase } from '../../db/supabaseClient'
import { Ionicons } from '@expo/vector-icons'
import { InvoicePreviewModal } from './InvoicePreviewModal'
import { formatDate } from './pdf/pdfUtils'

// ── Types ─────────────────────────────────────────────────────────────────────

type InvoiceRow = {
  id: number
  invoice_number: string
  invoice_date: string
  status: 'draft' | 'finalised'
  total_amount: number
  net_receivable: number
  client_name: string | null
}

type StatusFilter = 'all' | 'draft' | 'finalised'

// ── Constants ─────────────────────────────────────────────────────────────────

const ESPRESSO = '#2C1A0E'
const CREAM    = '#FAF6F0'
const GOLD     = '#B07D3A'
const DIVIDER  = '#E8E2D8'
const MUTED    = '#9A8878'
const GREEN    = '#2D7A4F'
const AMBER    = '#B07D3A'

// ── Screen ────────────────────────────────────────────────────────────────────

export function InvoiceListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const [invoices, setInvoices]           = useState<InvoiceRow[]>([])
  const [loading, setLoading]             = useState(true)
  const [refreshing, setRefreshing]       = useState(false)
  const [search, setSearch]               = useState('')
  const [statusFilter, setStatusFilter]   = useState<StatusFilter>('all')
  const [previewId, setPreviewId]         = useState<number | null>(null)

  // ── Data fetching ────────────────────────────────────────────────────────

  const fetchInvoices = useCallback(async () => {
    const { data, error } = await supabase
      .from('invoices')
      .select('id, invoice_number, invoice_date, status, total_amount, net_receivable, clients(name)')
      .order('invoice_date', { ascending: false })

    if (error) {
      console.error('InvoiceListScreen fetch error:', error.message)
      return
    }

    const rows: InvoiceRow[] = (data ?? []).map((r: any) => ({
      id:             r.id,
      invoice_number: r.invoice_number,
      invoice_date:   r.invoice_date,
      status:         r.status,
      total_amount:   r.total_amount ?? 0,
      net_receivable: r.net_receivable ?? 0,
      client_name:    r.clients?.name ?? null,
    }))
    setInvoices(rows)
  }, [])

  // Reload whenever screen comes into focus (e.g. after creating/editing an invoice)
  useFocusEffect(
    useCallback(() => {
      setLoading(true)
      fetchInvoices().finally(() => setLoading(false))
    }, [fetchInvoices])
  )

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchInvoices()
    setRefreshing(false)
  }, [fetchInvoices])

  // ── Delete ───────────────────────────────────────────────────────────────

  const handleDelete = useCallback((invoice: InvoiceRow) => {
    Alert.alert(
      'Delete Invoice',
      `Delete invoice ${invoice.invoice_number}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('invoices').delete().eq('id', invoice.id)
            if (error) {
              Alert.alert('Error', `Could not delete invoice: ${error.message}`)
            } else {
              setInvoices(prev => prev.filter(i => i.id !== invoice.id))
            }
          },
        },
      ]
    )
  }, [])

  // ── Filtered list ────────────────────────────────────────────────────────

  const q = search.toLowerCase().trim()
  const filtered = invoices.filter(inv => {
    const matchSearch =
      !q ||
      inv.invoice_number.toLowerCase().includes(q) ||
      (inv.client_name ?? '').toLowerCase().includes(q)
    const matchStatus =
      statusFilter === 'all' || inv.status === statusFilter
    return matchSearch && matchStatus
  })

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={ESPRESSO} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Invoices</Text>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.navigate('CreateInvoice')}
          accessibilityLabel="Create new invoice"
        >
          <Ionicons name="add" size={24} color={CREAM} />
        </TouchableOpacity>
      </View>

      {/* ── Search ── */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color={MUTED} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by number or client…"
          placeholderTextColor={MUTED}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {/* ── Status filter chips ── */}
      <View style={styles.chipRow}>
        {(['all', 'draft', 'finalised'] as StatusFilter[]).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, statusFilter === f && styles.chipActive]}
            onPress={() => setStatusFilter(f)}
          >
            <Text style={[styles.chipText, statusFilter === f && styles.chipTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── List ── */}
      {loading ? (
        <ActivityIndicator style={styles.loader} color={ESPRESSO} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ESPRESSO} />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={48} color={MUTED} />
              <Text style={styles.emptyTitle}>No invoices found</Text>
              <Text style={styles.emptySubtitle}>
                {search || statusFilter !== 'all'
                  ? 'Try adjusting your search or filter.'
                  : 'Tap + to create your first invoice.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <InvoiceCard
              invoice={item}
              onPreview={() => setPreviewId(item.id)}
              onDelete={() => handleDelete(item)}
            />
          )}
        />
      )}

      {/* ── PDF Preview modal ── */}
      {previewId !== null && (
        <InvoicePreviewModal
          invoiceId={previewId}
          onClose={() => setPreviewId(null)}
        />
      )}
    </View>
  )
}

// ── InvoiceCard ───────────────────────────────────────────────────────────────

function InvoiceCard({
  invoice,
  onPreview,
  onDelete,
}: {
  invoice: InvoiceRow
  onPreview: () => void
  onDelete: () => void
}) {
  const isDraft = invoice.status === 'draft'
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPreview}
      activeOpacity={0.75}
      accessibilityLabel={`Invoice ${invoice.invoice_number}, tap to preview`}
    >
      {/* Status pill */}
      <View style={[styles.statusPill, { backgroundColor: isDraft ? '#FFF3DC' : '#E6F4ED' }]}>
        <Text style={[styles.statusPillText, { color: isDraft ? AMBER : GREEN }]}>
          {isDraft ? 'Draft' : 'Finalised'}
        </Text>
      </View>

      {/* Main info */}
      <View style={styles.cardMain}>
        <Text style={styles.invoiceNumber}>{invoice.invoice_number || '(No number)'}</Text>
        {invoice.client_name ? (
          <Text style={styles.clientName}>{invoice.client_name}</Text>
        ) : null}
        <Text style={styles.invoiceDate}>{formatDate(invoice.invoice_date)}</Text>
      </View>

      {/* Amounts */}
      <View style={styles.cardAmounts}>
        <Text style={styles.amountLabel}>Total</Text>
        <Text style={styles.amountValue}>₹{invoice.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
        <Text style={styles.netLabel}>Net</Text>
        <Text style={styles.netValue}>₹{invoice.net_receivable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
      </View>

      {/* Actions */}
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onPreview}
          accessibilityLabel="Preview invoice PDF"
        >
          <Ionicons name="eye-outline" size={20} color={ESPRESSO} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.deleteBtn]}
          onPress={onDelete}
          accessibilityLabel="Delete invoice"
        >
          <Ionicons name="trash-outline" size={20} color="#C0392B" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2ED',
  },
  header: {
    backgroundColor: ESPRESSO,
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: CREAM,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CREAM,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 10,
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: DIVIDER,
    height: 42,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: ESPRESSO,
  },
  chipRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: DIVIDER,
    backgroundColor: CREAM,
  },
  chipActive: {
    backgroundColor: ESPRESSO,
    borderColor: ESPRESSO,
  },
  chipText: {
    fontSize: 13,
    color: MUTED,
    fontWeight: '500',
  },
  chipTextActive: {
    color: CREAM,
  },
  loader: {
    marginTop: 60,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  emptyContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  separator: {
    height: 8,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: ESPRESSO,
  },
  emptySubtitle: {
    fontSize: 13,
    color: MUTED,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  // ── Card ──
  card: {
    backgroundColor: CREAM,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: DIVIDER,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  cardMain: {
    flex: 1,
    gap: 2,
  },
  invoiceNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: ESPRESSO,
    letterSpacing: 0.2,
  },
  clientName: {
    fontSize: 12,
    color: MUTED,
  },
  invoiceDate: {
    fontSize: 11,
    color: MUTED,
  },
  cardAmounts: {
    alignItems: 'flex-end',
    gap: 1,
  },
  amountLabel: {
    fontSize: 9,
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  amountValue: {
    fontSize: 13,
    fontWeight: '600',
    color: ESPRESSO,
  },
  netLabel: {
    fontSize: 9,
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 2,
  },
  netValue: {
    fontSize: 12,
    fontWeight: '600',
    color: GREEN,
  },
  cardActions: {
    flexDirection: 'column',
    gap: 8,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#F0EDE8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    backgroundColor: '#FDECEA',
  },
})
