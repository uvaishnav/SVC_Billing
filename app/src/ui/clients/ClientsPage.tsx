import { useEffect, useState, useCallback } from 'react'
import { Plus } from 'lucide-react'
import type { ClientWithGstins } from '../../db/types'
import { getClients, deactivateClient } from '../../db/clientsDb'
import ClientCard from './ClientCard'
import ClientFormModal from './ClientFormModal'
import ClientDetailSheet from './ClientDetailSheet'
import { sectionTitleStyle } from '../settings/_components'

export default function ClientsPage() {
  const [clients,       setClients]       = useState<ClientWithGstins[]>([])
  const [loading,       setLoading]       = useState(true)
  const [search,        setSearch]        = useState('')
  const [modalOpen,     setModalOpen]     = useState(false)
  const [editingClient, setEditingClient] = useState<ClientWithGstins | null>(null)
  const [detailClient,  setDetailClient]  = useState<ClientWithGstins | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await getClients()
    setClients(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
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

  function handleAdd() {
    setEditingClient(null)
    setModalOpen(true)
  }

  function handleSaved() {
    setModalOpen(false)
    setEditingClient(null)
    load()
  }

  return (
    <div style={{ minHeight: '100%', background: 'var(--color-bg)' }}>

      {/* Sticky header */}
      <div style={{
        background: 'var(--topbar-bg)',
        padding: 'calc(14px + var(--safe-top)) calc(20px + var(--safe-right)) 16px calc(20px + var(--safe-left))',
        position: 'sticky', top: 0, zIndex: 10,
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(200,169,106,0.18)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <h1 style={{ color: 'var(--color-text-inverse)', fontSize: '24px', fontFamily: 'DM Serif Display, Georgia, serif', fontWeight: 400, marginBottom: '2px' }}>Clients</h1>
            <p style={{ color: 'var(--color-accent)', fontSize: '13px', opacity: 0.85 }}>
              {clients.length} active client{clients.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            aria-label="Add client"
            style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'var(--color-accent)', color: 'var(--color-primary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(200, 169, 106, 0.4)', flexShrink: 0 }}
          >
            <Plus size={20} strokeWidth={2.5} />
          </button>
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or GSTIN…"
          style={{ width: '100%', padding: '11px 16px', borderRadius: '10px', border: 'none', background: 'rgba(255,255,255,0.12)', color: 'var(--color-text-inverse)', fontSize: '15px', outline: 'none', fontFamily: 'Work Sans, sans-serif', boxSizing: 'border-box' }}
        />
      </div>

      {/* Content */}
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '20px calc(16px + var(--safe-right)) 32px calc(16px + var(--safe-left))' }}>
        {loading ? (
          <CardSkeleton />
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '18px', background: 'var(--color-surface-offset)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <span style={{ fontSize: '26px', color: 'var(--color-text-faint)' }}>—</span>
            </div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '15px', fontWeight: 500 }}>
              {search ? `No clients matching "${search}"` : 'No clients yet.'}
            </p>
            {!search && <p style={{ color: 'var(--color-text-faint)', fontSize: '13px', marginTop: '6px' }}>Tap + to add your first client.</p>}
          </div>
        ) : (
          <>
            <p style={{ ...sectionTitleStyle, marginBottom: '14px' }}>
              {search ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''}` : 'All Clients'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filtered.map(c => (
                <ClientCard
                  key={c.id}
                  client={c}
                  onTap={setDetailClient}      // tap card → detail sheet
                  onEdit={handleEdit}
                  onDeactivate={handleDeactivate}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Edit / Add modal */}
      {modalOpen && (
        <ClientFormModal
          client={editingClient}
          onClose={() => { setModalOpen(false); setEditingClient(null) }}
          onSaved={handleSaved}
        />
      )}

      {/* Detail sheet */}
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

// ── Skeleton ──────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '4px' }}>
      {[1, 2, 3, 4].map(i => (
        <div
          key={i}
          style={{
            background:   'var(--color-surface)',
            borderRadius: 'var(--radius-md)',
            padding:      '16px',
            border:       '1px solid var(--color-border)',
          }}
        >
          <div className="skeleton" style={{ height: '16px', width: '60%', marginBottom: '10px' }} />
          <div className="skeleton" style={{ height: '12px', width: '40%', marginBottom: '6px' }} />
          <div className="skeleton" style={{ height: '12px', width: '75%' }} />
        </div>
      ))}
    </div>
  )
}
