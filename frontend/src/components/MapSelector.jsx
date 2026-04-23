import { useEffect, useState } from 'react'

const overlay = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.85)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000,
}

const panel = {
  background: '#0f0f1e',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 12,
  padding: '36px 40px',
  width: 400,
  color: '#fff',
  fontFamily: "'Inter Tight', Inter, sans-serif",
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
}

const inputStyle = {
  padding: '10px 14px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(255,255,255,0.07)',
  color: '#fff',
  fontSize: 14,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

const btnPrimary = {
  padding: '10px 20px',
  borderRadius: 6,
  border: 'none',
  background: 'oklch(0.82 0.13 200)',
  color: '#000',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  letterSpacing: '0.04em',
  fontFamily: "'JetBrains Mono', monospace",
  whiteSpace: 'nowrap',
}

const btnGhost = {
  padding: '10px 20px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'transparent',
  color: 'rgba(255,255,255,0.6)',
  fontSize: 13,
  cursor: 'pointer',
}

export default function MapSelector({ user, onSelect }) {
  const [maps, setMaps] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/maps?user=${encodeURIComponent(user)}`)
      .then(r => r.json())
      .then(data => { setMaps(data); setLoading(false) })
  }, [user])

  async function handleCreate(e) {
    e.preventDefault()
    if (!newName.trim()) return
    setSaving(true)
    const res = await fetch('/api/maps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), created_by: user }),
    })
    const map = await res.json()
    setSaving(false)
    onSelect(map)
  }

  return (
    <div style={overlay}>
      <div style={panel}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', fontFamily: "'JetBrains Mono', monospace", marginBottom: 6 }}>
            Welcome back
          </div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{user}</h2>
        </div>

        {loading ? (
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Loading maps…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>
              {maps.length > 0 ? 'Your maps' : 'No maps yet'}
            </div>
            {maps.map(map => (
              <button
                key={map.id}
                onClick={() => onSelect(map)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.04)',
                  color: '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.09)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
              >
                <span style={{ fontSize: 15, fontWeight: 600 }}>{map.name}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: "'JetBrains Mono', monospace" }}>
                  {map.criteria?.items?.length ?? 0} criteria
                </span>
              </button>
            ))}
          </div>
        )}

        {!creating ? (
          <button
            style={btnGhost}
            onClick={() => setCreating(true)}
          >
            + New map
          </button>
        ) : (
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', fontFamily: "'JetBrains Mono', monospace" }}>
              New map name
            </div>
            <input
              style={inputStyle}
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Morocco 2026, Bali scouting…"
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" style={btnGhost} onClick={() => { setCreating(false); setNewName('') }}>
                Cancel
              </button>
              <button type="submit" style={btnPrimary} disabled={saving}>
                {saving ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
