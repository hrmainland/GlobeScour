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
  width: 420,
  color: '#fff',
  fontFamily: "'Inter Tight', Inter, sans-serif",
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
  maxHeight: '90vh',
  overflowY: 'auto',
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

function SharePanel({ map, user, onUpdate }) {
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const members = map.members ?? []

  async function handleAdd(e) {
    e.preventDefault()
    const name = input.trim()
    if (!name) return
    if (name === user) { setError("That's you"); return }
    if (members.includes(name)) { setError('Already shared'); return }
    setBusy(true)
    setError('')
    const res = await fetch(`/api/maps/${map.id}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: name }),
    })
    if (res.ok) {
      const updated = await res.json()
      onUpdate(updated)
      setInput('')
    }
    setBusy(false)
  }

  async function handleRemove(username) {
    await fetch(`/api/maps/${map.id}/members/${encodeURIComponent(username)}`, { method: 'DELETE' })
    onUpdate({ ...map, members: members.filter(m => m !== username) })
  }

  return (
    <div
      style={{
        marginTop: 6,
        padding: '12px 14px',
        borderRadius: 8,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
      onClick={e => e.stopPropagation()}
    >
      {members.length > 0 ? (
        <div style={{ marginBottom: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {members.map(m => (
            <span
              key={m}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 8px', borderRadius: 99,
                background: 'rgba(255,255,255,0.08)',
                fontSize: 12, color: 'rgba(255,255,255,0.75)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {m}
              <button
                onClick={() => handleRemove(m)}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0, fontSize: 13, lineHeight: 1 }}
              >×</button>
            </span>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>Not shared with anyone yet</div>
      )}
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 6 }}>
        <input
          style={{ ...inputStyle, padding: '6px 10px', fontSize: 13 }}
          placeholder="Username…"
          value={input}
          onChange={e => { setInput(e.target.value); setError('') }}
        />
        <button type="submit" style={{ ...btnPrimary, padding: '6px 12px', fontSize: 12 }} disabled={busy}>
          {busy ? '…' : 'Add'}
        </button>
      </form>
      {error && <div style={{ fontSize: 11, color: 'oklch(0.75 0.18 30)', marginTop: 5 }}>{error}</div>}
    </div>
  )
}

export default function MapSelector({ user, onSelect }) {
  const [maps, setMaps] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [shareOpenId, setShareOpenId] = useState(null)

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

  function handleUpdateMap(updated) {
    setMaps(prev => prev.map(m => m.id === updated.id ? updated : m))
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
            {maps.map(map => {
              const isOwner = map.created_by === user
              const shareOpen = shareOpenId === map.id
              return (
                <div key={map.id}>
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 16px',
                      borderRadius: shareOpen ? '8px 8px 0 0' : 8,
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderBottom: shareOpen ? '1px solid transparent' : undefined,
                      background: 'rgba(255,255,255,0.04)',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.09)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                    onClick={() => onSelect(map)}
                  >
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>{map.name}</div>
                      {!isOwner && (
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
                          shared by {map.created_by}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: "'JetBrains Mono', monospace" }}>
                        {map.criteria?.items?.length ?? 0} criteria
                      </span>
                      {isOwner && (
                        <button
                          onClick={e => { e.stopPropagation(); setShareOpenId(shareOpen ? null : map.id) }}
                          title="Share map"
                          style={{
                            background: shareOpen ? 'rgba(255,255,255,0.12)' : 'none',
                            border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: 5,
                            color: 'rgba(255,255,255,0.5)',
                            cursor: 'pointer',
                            fontSize: 14,
                            padding: '2px 7px',
                            lineHeight: 1.5,
                          }}
                        >
                          ↗
                        </button>
                      )}
                    </div>
                  </div>
                  {shareOpen && isOwner && (
                    <div style={{
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderTop: 'none',
                      borderRadius: '0 0 8px 8px',
                      padding: '0 12px 12px',
                      background: 'rgba(255,255,255,0.02)',
                    }}>
                      <SharePanel map={map} user={user} onUpdate={handleUpdateMap} />
                    </div>
                  )}
                </div>
              )
            })}
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
