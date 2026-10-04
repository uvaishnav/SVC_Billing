import { useEffect, useState, useCallback } from 'react'
import type { ProjectWithClient } from '../../db/types'
import { getProjects, deactivateProject } from '../../db/projectsDb'
import { sectionTitleStyle } from '../settings/_components'
import ProjectCard from './ProjectCard'
import ProjectFormModal from './ProjectFormModal'

export default function ProjectsPage({ onBack }: { onBack?: () => void } = {}) {
  const [projects,       setProjects]       = useState<ProjectWithClient[]>([])
  const [loading,        setLoading]        = useState(true)
  const [search,         setSearch]         = useState('')
  const [modalOpen,      setModalOpen]      = useState(false)
  const [editingProject, setEditingProject] = useState<ProjectWithClient | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await getProjects()
    setProjects(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.client_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (p.site_location ?? '').toLowerCase().includes(search.toLowerCase())
  )

  async function handleDeactivate(id: number) {
    if (!confirm('Archive this project?')) return
    await deactivateProject(id)
    load()
  }

  function handleEdit(project: ProjectWithClient) {
    setEditingProject(project)
    setModalOpen(true)
  }

  function handleAdd() {
    setEditingProject(null)
    setModalOpen(true)
  }

  function handleSaved() {
    setModalOpen(false)
    setEditingProject(null)
    load()
  }

  return (
    <div style={{ minHeight: '100%', background: 'var(--color-bg)' }}>

      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                aria-label="Back to More"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '4px',
                  color: 'var(--color-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            )}
            <div>
              <h1 style={{ color: 'var(--color-primary)', fontSize: '22px', fontWeight: 700, fontFamily: 'Playfair Display, Georgia, serif', margin: 0, marginBottom: '2px' }}>Projects</h1>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', fontFamily: 'Work Sans, sans-serif' }}>
                {projects.length} active project{projects.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={handleAdd}
            aria-label="Add project"
            style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'var(--color-primary)', color: 'var(--color-bg)', fontSize: '22px', fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(59,42,31,0.18)', flexShrink: 0, transition: 'all 150ms ease' }}
          >+</button>
        </div>
        <div style={{ position: 'relative' }}>
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, client, or site…"
            style={{ width: '100%', padding: '10px 14px 10px 36px', borderRadius: '12px', border: '1px solid rgba(59,42,31,0.12)', background: 'rgba(255,255,255,0.85)', color: 'var(--color-text)', fontSize: '13px', outline: 'none', fontFamily: 'Work Sans, sans-serif', boxSizing: 'border-box', boxShadow: '0 1px 3px rgba(59,42,31,0.03)' }}
          />
        </div>
      </div>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '20px 16px 32px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)', fontSize: '15px' }}>Loading projects…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--color-surface-offset)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '28px' }}>📁</div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '15px' }}>
              {search ? `No projects matching "${search}"` : 'No projects yet.'}
            </p>
            {!search && <p style={{ color: 'var(--color-text-faint)', fontSize: '13px', marginTop: '6px' }}>Tap + to add your first project.</p>}
          </div>
        ) : (
          <>
            <p style={{ ...sectionTitleStyle, marginBottom: '14px' }}>
              {search ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''}` : 'All Projects'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filtered.map(p => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  onEdit={handleEdit}
                  onDeactivate={handleDeactivate}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {modalOpen && (
        <ProjectFormModal
          project={editingProject}
          onClose={() => { setModalOpen(false); setEditingProject(null) }}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
