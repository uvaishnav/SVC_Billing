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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--color-bg)', overflow: 'hidden' }}>

      {/* Page header */}
      <div className="page-header" style={{
        background: 'var(--color-primary)',
        paddingTop: 'calc(20px + var(--safe-top, 0px))',
        paddingBottom: '16px',
        paddingLeft: '20px',
        paddingRight: '20px',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h1 style={{ color: 'var(--color-bg)', fontSize: '24px', fontFamily: 'Playfair Display, serif' }}>Clients</h1>
          <button
            type="button"
            aria-label="Add new client"
            onClick={() => { setEditingClient(null); setModalOpen(true) }}
            style={{
              width: '36px', height: '36px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.18)', border: 'none',
              color: '#fff', fontSize: '22px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >+</button>
        </div>
        <input
          type="search"
          placeholder="Search by name, phone or GSTIN…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '10px 14px', borderRadius: '12px',
            border: 'none', background: 'rgba(255,255,255,0.14)',
            color: '#fff', fontSize: '15px', fontFamily: 'Work Sans, sans-serif',
            outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 32px' }}>
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
