import { useState, useEffect, useCallback } from 'react'
import type { ClientWithGstins } from '../../db/types'
import { getClients, deactivateClient } from '../../db/clientsDb'
import ClientCard from './ClientCard'
import ClientFormModal from './ClientFormModal'
import ClientDetailSheet from './ClientDetailSheet'

export default function ClientsPage() {
  const [clients,      setClients]      = useState<ClientWithGstins[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [modalOpen,    setModalOpen]    = useState(false)
  const [editingClient,setEditingClient]= useState<ClientWithGstins | null>(null)
  const [detailClient, setDetailClient] = useState<ClientWithGstins | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await getClients()
    setClients(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone ?? '').toLowerCase().includes(search.toLowerCase()) ||
    c.gstins.some(g => g.gstin.toLowerCase().includes(search.toLowerCase()))
  )

  async function handleDeactivate(id: number) {
    if (!confirm('Remove this client? This action cannot be undone.')) return
    await deactivateClient(id)
    load()
  }

  function handleEdit(client: ClientWithGstins) {
    setEditingClient(client)
    setModalOpen(true)
  }

  function handleSaved() {
    setModalOpen(false)
    setEditingClient(null)
    load()
  }

  return (
    <div style={{ minHeight: '100%', background: 'var(--color-bg)' }}>

      {/* Page header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <h1 style={{ color: 'var(--color-primary)', fontSize: '22px', fontWeight: 700, fontFamily: 'Playfair Display, Georgia, serif', margin: 0 }}>Clients</h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', marginTop: '2px', fontFamily: 'Work Sans, sans-serif' }}>
              {clients.length} registered client{clients.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            type="button"
            aria-label="Add new client"
            onClick={() => { setEditingClient(null); setModalOpen(true) }}
            style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'var(--color-primary)', border: 'none',
              color: 'var(--color-bg)', fontSize: '22px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(59,42,31,0.18)',
              transition: 'all 150ms ease',
            }}
          >+</button>
        </div>
        <div style={{ position: 'relative' }}>
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            placeholder="Search by name, phone or GSTIN…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '10px 14px 10px 36px', borderRadius: '12px',
              border: '1px solid rgba(59,42,31,0.12)', background: 'rgba(255,255,255,0.85)',
              color: 'var(--color-text)', fontSize: '13px', fontFamily: 'Work Sans, sans-serif',
              outline: 'none', boxSizing: 'border-box',
              boxShadow: '0 1px 3px rgba(59,42,31,0.03)',
            }}
          />
        </div>
      </div>

      {/* List */}
      <div style={{ padding: '16px' }}>
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginTop: '40px', fontFamily: 'Work Sans, sans-serif' }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginTop: '40px', fontFamily: 'Work Sans, sans-serif' }}>
            {search ? 'No clients match your search.' : 'No clients yet. Tap + to add one.'}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filtered.map(c => (
              <ClientCard
                key={c.id}
                client={c}
                onTap={setDetailClient}
                onEdit={handleEdit}
                onDeactivate={handleDeactivate}
              />
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <ClientFormModal
          client={editingClient}
          onClose={() => { setModalOpen(false); setEditingClient(null) }}
          onSaved={handleSaved}
        />
      )}

      {detailClient && (
        <ClientDetailSheet
          client={detailClient}
          onClose={() => setDetailClient(null)}
          onEdit={(c) => { setDetailClient(null); handleEdit(c) }}
        />
      )}
    </div>
  )
}
