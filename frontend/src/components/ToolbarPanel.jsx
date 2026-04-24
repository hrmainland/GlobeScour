import { useState, useRef } from 'react'

const VISION_MAX = 300

const inputStyle = {
  flex: 1,
  padding: '6px 10px',
  borderRadius: 5,
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(255,255,255,0.06)',
  color: '#fff',
  fontSize: 12,
  outline: 'none',
}

export default function ToolbarPanel({
  mapId, criteria, onCriteriaChange,
  mode, onModeChange,
  suggestions, activeSuggestionId, onSearch, onSuggestionClick,
  onSearchTabClose, onSearchTabOpen,
  discoverSpots, discoverRegion, activeDiscoverSpotId, onDiscover, onDiscoverSuggestionClick,
}) {
  const [newItem, setNewItem] = useState('')
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [discoverMode, setDiscoverMode] = useState('spots')
  const [discoverRegionInput, setDiscoverRegionInput] = useState('')
  const [discoverInstructions, setDiscoverInstructions] = useState('')
  const [discovering, setDiscovering] = useState(false)
  const saveTimer = useRef(null)

  function switchMode(next) {
    onModeChange?.(next)
  }

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

  async function handleSearchSubmit(e) {
    e.preventDefault()
    const q = searchQuery.trim()
    if (!q) return
    setSearching(true)
    await onSearch?.(q)
    setSearching(false)
  }

  async function handleDiscoverSubmit(e) {
    e.preventDefault()
    setDiscovering(true)
    await onDiscover?.({
      mode: discoverMode,
      region: discoverRegionInput.trim(),
      instructions: discoverInstructions.trim(),
    })
    setDiscovering(false)
  }

  const panelBase = {
    position: 'fixed',
    top: 16, left: 16,
    zIndex: 800,
    fontFamily: "'Inter Tight', Inter, sans-serif",
  }

  const panelOpen = mode === 'criteria' || mode === 'search' || mode === 'discover'

  const tabRow = {
    display: 'flex',
    gap: 2,
    background: 'rgba(10,10,28,0.75)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: panelOpen ? '8px 8px 0 0' : 8,
    padding: 4,
  }

  function tabBtn(m) {
    const active = mode === m
    return {
      padding: '5px 10px',
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

  const panelBody = {
    background: 'rgba(10,10,28,0.82)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderTop: 'none',
    borderRadius: '0 0 8px 8px',
    padding: '16px 16px 18px',
    width: 280,
    maxHeight: 'calc(100vh - 120px)',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    color: '#fff',
  }

  const labelStyle = {
    fontSize: 10,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.35)',
    fontFamily: "'JetBrains Mono', monospace",
    marginBottom: 8,
  }

  return (
    <div style={panelBase}>
      <div style={tabRow}>
        <button style={tabBtn('browse')} onClick={() => switchMode('browse')}>Browse</button>
        <button style={tabBtn('search')} onClick={() => switchMode('search')}>Search</button>
        <button style={tabBtn('discover')} onClick={() => switchMode('discover')}>Discover</button>
        <button style={tabBtn('criteria')} onClick={() => switchMode('criteria')}>Criteria</button>
      </div>

      {mode === 'search' && (
        <div style={panelBody}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 6 }}>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search destinations…"
              autoFocus
              style={inputStyle}
            />
            <button type="submit" disabled={searching} style={{
              padding: '6px 10px',
              borderRadius: 5,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.08)',
              color: searching ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.7)',
              fontSize: 12,
              cursor: searching ? 'default' : 'pointer',
              flexShrink: 0,
            }}>
              Go
            </button>
          </form>

          {searching && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px' }}>
              <div style={{
                width: 14, height: 14, borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.1)',
                borderTopColor: 'rgba(255,255,255,0.5)',
                animation: 'spin 0.8s linear infinite',
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: "'JetBrains Mono', monospace" }}>
                Searching…
              </span>
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
          )}

          {!searching && suggestions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {suggestions.map(sug => {
                const country = sug.context.find(c => c.id?.startsWith('country.'))?.text
                const region = sug.context.find(c => c.id?.startsWith('region.'))?.text
                const geo = [region, country].filter(Boolean).join(', ')
                return (
                  <div
                    key={sug._sid}
                    onClick={() => onSuggestionClick?.(sug)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      transition: 'background 0.1s',
                      background: activeSuggestionId === sug._sid ? 'rgba(239,68,68,0.1)' : 'transparent',
                      borderLeft: activeSuggestionId === sug._sid ? '2px solid rgba(239,68,68,0.5)' : '2px solid transparent',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = activeSuggestionId === sug._sid ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)'}
                    onMouseLeave={e => e.currentTarget.style.background = activeSuggestionId === sug._sid ? 'rgba(239,68,68,0.1)' : 'transparent'}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{sug.name}</div>
                    {geo && (
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                        {geo}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {mode === 'discover' && (
        <div style={panelBody}>
          {/* Regions / Spots sub-toggle */}
          <div style={{ display: 'flex', gap: 4 }}>
            {['spots', 'regions'].map(m => (
              <button
                key={m}
                onClick={() => setDiscoverMode(m)}
                style={{
                  padding: '5px 14px',
                  borderRadius: 5,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: discoverMode === m ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: discoverMode === m ? '#fff' : 'rgba(255,255,255,0.45)',
                  fontSize: 12,
                  fontWeight: discoverMode === m ? 600 : 400,
                  cursor: 'pointer',
                  letterSpacing: '0.04em',
                }}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>

          <form onSubmit={handleDiscoverSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={labelStyle}>Region (optional)</div>
              <input
                value={discoverRegionInput}
                onChange={e => setDiscoverRegionInput(e.target.value)}
                placeholder="e.g. Morocco, Southeast Asia…"
                style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <div style={labelStyle}>Additional focus (optional)</div>
              <textarea
                value={discoverInstructions}
                onChange={e => setDiscoverInstructions(e.target.value)}
                placeholder="e.g. remote, budget-friendly, avoid crowds…"
                rows={2}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '6px 10px',
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
            </div>
            <button
              type="submit"
              disabled={discovering}
              style={{
                padding: '8px 14px',
                borderRadius: 5,
                border: '1px solid rgba(255,255,255,0.15)',
                background: discovering ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)',
                color: discovering ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.7)',
                fontSize: 12,
                cursor: discovering ? 'default' : 'pointer',
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: '0.04em',
              }}
            >
              {discovering ? 'Discovering…' : 'Discover'}
            </button>
          </form>

          {discovering && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px' }}>
              <div style={{
                width: 14, height: 14, borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.1)',
                borderTopColor: 'rgba(255,255,255,0.5)',
                animation: 'spin 0.8s linear infinite',
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: "'JetBrains Mono', monospace" }}>
                Asking Claude…
              </span>
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
          )}

          {/* Regions result */}
          {!discovering && discoverMode === 'regions' && discoverRegion && (
            <p style={{
              margin: 0,
              fontSize: 13,
              color: 'rgba(255,255,255,0.65)',
              lineHeight: 1.65,
            }}>
              {discoverRegion.summary}
            </p>
          )}

          {/* Spots result */}
          {!discovering && discoverMode === 'spots' && discoverSpots && discoverSpots.length > 0 && (() => {
            const found = discoverSpots.filter(s => !s._notFound)
            const notFound = discoverSpots.filter(s => s._notFound)
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {found.map(sug => (
                  <div
                    key={sug._sid}
                    onClick={() => onDiscoverSuggestionClick?.(sug)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      transition: 'background 0.1s',
                      background: activeDiscoverSpotId === sug._sid ? 'rgba(239,68,68,0.1)' : 'transparent',
                      borderLeft: activeDiscoverSpotId === sug._sid ? '2px solid rgba(239,68,68,0.5)' : '2px solid transparent',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = activeDiscoverSpotId === sug._sid ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)'}
                    onMouseLeave={e => e.currentTarget.style.background = activeDiscoverSpotId === sug._sid ? 'rgba(239,68,68,0.1)' : 'transparent'}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{sug.name}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2, lineHeight: 1.4 }}>
                      {sug.why}
                    </div>
                  </div>
                ))}
                {notFound.length > 0 && (
                  <div style={{ marginTop: 6, padding: '8px 12px', borderRadius: 6, background: 'rgba(255,255,255,0.04)' }}>
                    <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>
                      Couldn't place on map
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                      {notFound.map(s => s.name).join(', ')}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {mode === 'criteria' && (
        <div style={panelBody}>
          {/* Criteria chips */}
          <div>
            <div style={labelStyle}>Criteria</div>
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
                style={inputStyle}
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
            <div style={labelStyle}>Trip vision</div>
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
