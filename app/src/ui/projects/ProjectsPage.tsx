import { useEffect, useState, useCallback } from 'react'
import type { ProjectWithClient } from '../../db/types'
import { getProjects, deactivateProject } from '../../db/projectsDb'
import { sectionTitleStyle } from '../settings/_components'
import ProjectCard from './ProjectCard'
import ProjectFormModal from './ProjectFormModal'

export default function ProjectsPage() {
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

      <div className="page-header" style={{ background: 'var(--color-primary)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <h1 style={{ color: 'var(--color-bg)', fontSize: '22px', fontFamily: 'Playfair Display, serif', marginBottom: '2px' }}>Projects</h1>
            <p style={{ color: 'var(--color-accent)', fontSize: '13px', opacity: 0.85 }}>
              {projects.length} active project{projects.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={handleAdd}
            style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--color-accent)', color: 'var(--color-primary)', fontSize: '24px', fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.25)', flexShrink: 0 }}
          >+</button>
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, client, or site…"
          style={{ width: '100%', padding: '11px 16px', borderRadius: '10px', border: 'none', background: 'rgba(255,255,255,0.12)', color: 'var(--color-bg)', fontSize: '15px', outline: 'none', fontFamily: 'Work Sans, sans-serif', boxSizing: 'border-box' }}
        />
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
