import { useState, useRef } from 'react'

const VISION_MAX = 300

export default function ToolbarPanel({ mapId, criteria, onCriteriaChange }) {
  const [mode, setMode] = useState('browse')
  const [newItem, setNewItem] = useState('')
  const [saving, setSaving] = useState(false)
  const saveTimer = useRef(null)

  async function persist(updated) {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      await fetch(`/api/maps/${mapId}/criteria`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      })
      setSaving(false)
    }, 600)
  }

  function update(updated) {
    onCriteriaChange(updated)
    persist(updated)
  }

  function addItem(e) {
    e.preventDefault()
    const trimmed = newItem.trim()
    if (!trimmed || criteria.items.includes(trimmed)) return
    update({ ...criteria, items: [...criteria.items, trimmed] })
    setNewItem('')
  }

  function removeItem(item) {
    update({ ...criteria, items: criteria.items.filter(i => i !== item) })
  }

  function setVision(vision) {
    update({ ...criteria, vision: vision.slice(0, VISION_MAX) })
  }

  const panelBase = {
    position: 'fixed',
    top: 16, left: 16,
    zIndex: 800,
    fontFamily: "'Inter Tight', Inter, sans-serif",
  }

  const tabRow = {
    display: 'flex',
    gap: 2,
    background: 'rgba(10,10,28,0.75)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: mode === 'criteria' ? '8px 8px 0 0' : 8,
    padding: 4,
  }

  function tabBtn(m) {
    const active = mode === m
    return {
      padding: '5px 14px',
      borderRadius: 5,
      border: 'none',
      background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
      color: active ? '#fff' : 'rgba(255,255,255,0.45)',
      fontSize: 12,
      fontWeight: active ? 600 : 400,
      cursor: 'pointer',
      letterSpacing: '0.04em',
      transition: 'all 0.15s',
    }
  }

  return (
    <div style={panelBase}>
      <div style={tabRow}>
        <button style={tabBtn('browse')} onClick={() => setMode('browse')}>Browse</button>
        <button style={tabBtn('criteria')} onClick={() => setMode('criteria')}>Criteria</button>
      </div>

      {mode === 'criteria' && (
        <div style={{
          background: 'rgba(10,10,28,0.82)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderTop: 'none',
          borderRadius: '0 0 8px 8px',
          padding: '16px 16px 18px',
          width: 280,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          color: '#fff',
        }}>

          {/* Criteria chips */}
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', fontFamily: "'JetBrains Mono', monospace", marginBottom: 8 }}>
              Criteria
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {criteria.items.map(item => (
                <span key={item} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '3px 8px 3px 10px',
                  borderRadius: 20,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  fontSize: 12, color: 'rgba(255,255,255,0.85)',
                }}>
                  {item}
                  <button
                    onClick={() => removeItem(item)}
                    style={{
                      background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)',
                      cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: 13,
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <form onSubmit={addItem} style={{ display: 'flex', gap: 6 }}>
              <input
                value={newItem}
                onChange={e => setNewItem(e.target.value)}
                placeholder="Add criterion…"
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: 5,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  fontSize: 12,
                  outline: 'none',
                }}
              />
              <button type="submit" style={{
                padding: '6px 10px',
                borderRadius: 5,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.7)',
                fontSize: 12,
                cursor: 'pointer',
              }}>
                Add
              </button>
            </form>
          </div>

          {/* Vision */}
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', fontFamily: "'JetBrains Mono', monospace", marginBottom: 6 }}>
              Trip vision
            </div>
            <textarea
              value={criteria.vision}
              onChange={e => setVision(e.target.value)}
              placeholder="e.g. a lowkey backpacking trip aiming to summit as many peaks as possible"
              maxLength={VISION_MAX}
              rows={3}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 10px',
                borderRadius: 5,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.06)',
                color: '#fff',
                fontSize: 12,
                lineHeight: 1.5,
                resize: 'vertical',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontSize: 10, color: saving ? 'oklch(0.82 0.13 200)' : 'transparent', fontFamily: "'JetBrains Mono', monospace" }}>
                saving…
              </span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: "'JetBrains Mono', monospace" }}>
                {criteria.vision.length}/{VISION_MAX}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
