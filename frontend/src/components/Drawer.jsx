import { useState, useRef, useEffect } from 'react'

const TRAFFIC_COLORS = {
  green: { dot: '#22c55e', glow: 'rgba(34,197,94,0.45)', tint: 'rgba(34,197,94,0.06)', border: 'rgba(34,197,94,0.18)' },
  amber: { dot: '#f59e0b', glow: 'rgba(245,158,11,0.45)', tint: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.18)' },
  red:   { dot: '#ef4444', glow: 'rgba(239,68,68,0.45)',  tint: 'rgba(239,68,68,0.06)',  border: 'rgba(239,68,68,0.18)'  },
  none:  { dot: 'rgba(255,255,255,0.15)', glow: 'none',   tint: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.08)' },
}

const INITIAL_PX = () => window.innerHeight * 0.5

function CriterionCard({ criterion, rating, note }) {
  const c = TRAFFIC_COLORS[rating] ?? TRAFFIC_COLORS.none
  return (
    <div style={{
      background: c.tint,
      border: `1px solid ${c.border}`,
      borderRadius: 8,
      padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 8,
      width: 200,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
          background: c.dot,
          boxShadow: rating && rating !== 'none' ? `0 0 7px ${c.glow}` : 'none',
        }} />
        <span style={{
          fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.75)', fontFamily: "'JetBrains Mono', monospace",
        }}>
          {criterion}
        </span>
      </div>
      {note && (
        <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
          {note}
        </p>
      )}
    </div>
  )
}

export default function Drawer({ pin, criteria, onClose, onResearchDone }) {
  const [research, setResearch] = useState(pin.research ?? null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [heightPx, setHeightPx] = useState(INITIAL_PX)

  const drawerRef  = useRef(null)
  const contentRef = useRef(null)
  const dragRef    = useRef(null)
  const headerRef  = useRef(null)
  const heightRef  = useRef(INITIAL_PX())
  const minPxRef   = useRef(110) // overwritten after mount with real header height

  const criteriaItems = criteria?.items ?? []
  const allCriteriaKeys = [
    ...criteriaItems,
    ...Object.keys(research?.ratings ?? {}).filter(k => !criteriaItems.includes(k)),
  ]

  // ── Measure header height once mounted ──
  useEffect(() => {
    if (headerRef.current) minPxRef.current = headerRef.current.offsetHeight
  }, [])

  // ── Wheel: resize from anywhere on screen ──
  useEffect(() => {
    function onWheel(e) {
      const h = heightRef.current
      const maxPx = window.innerHeight
      const minPx = minPxRef.current

      // If the event is inside the scrollable content and it's not at the top,
      // let it scroll normally without resizing
      const insideContent = contentRef.current?.contains(e.target)
      const contentScrolled = contentRef.current && contentRef.current.scrollTop > 1
      if (insideContent && contentScrolled) return

      if (e.deltaY > 0 && h < maxPx) {
        e.preventDefault()
        const next = Math.min(maxPx, h + Math.abs(e.deltaY) * 0.8)
        heightRef.current = next
        setHeightPx(next)
      } else if (e.deltaY < 0 && h > minPx) {
        e.preventDefault()
        const next = Math.max(minPx, h - Math.abs(e.deltaY) * 0.8)
        heightRef.current = next
        setHeightPx(next)
      }
    }

    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [])

  // ── Drag handle ──
  useEffect(() => {
    const handle = dragRef.current
    if (!handle) return

    let startY = 0
    let startH = 0

    function onMouseMove(e) {
      const dy = startY - e.clientY
      const next = Math.min(window.innerHeight, Math.max(minPxRef.current, startH + dy))
      heightRef.current = next
      setHeightPx(next)
    }
    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    function onMouseDown(e) {
      startY = e.clientY
      startH = heightRef.current
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    }

    handle.addEventListener('mousedown', onMouseDown)
    return () => {
      handle.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  async function handleResearch() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/locations/${pin.id}/research`, { method: 'POST' })
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const data = await res.json()
      setResearch(data)
      onResearchDone?.(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 900 }} />

      {/* Sheet */}
      <div
        ref={drawerRef}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          height: `${heightPx}px`,
          zIndex: 901,
          background: 'rgba(10,10,28,0.92)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '16px 16px 0 0',
          display: 'flex', flexDirection: 'column',
          color: '#fff',
          fontFamily: "'Inter Tight', Inter, sans-serif",
          overflow: 'hidden',
        }}
      >
        {/* Drag handle + header — measured together for min height */}
        <div ref={headerRef} style={{ flexShrink: 0 }}>
        <div
          ref={dragRef}
          style={{
            padding: '12px 0 8px',
            display: 'flex', justifyContent: 'center',
            cursor: 'row-resize',
          }}
        >
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)' }} />
        </div>

        {/* Header */}
        <div style={{
          padding: '0 24px 16px',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}>
          <div>
            <div style={{
              fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.4)', fontFamily: "'JetBrains Mono', monospace", marginBottom: 4,
            }}>
              {pin.location_type === 'coordinate'
                ? `${pin.lat.toFixed(3)}, ${pin.lng.toFixed(3)}`
                : pin.location_type}
            </div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{pin.name}</h2>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
              Added by {pin.created_by}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
              fontSize: 20, cursor: 'pointer', padding: '2px 4px', lineHeight: 1, flexShrink: 0,
            }}
          >✕</button>
        </div>
        </div>{/* end headerRef wrapper */}

        {/* Scrollable body */}
        <div ref={contentRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 40px' }}>

          {!research && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 480 }}>
              {criteriaItems.length > 0 && (
                <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>
                  Will rate: {criteriaItems.join(' · ')}
                </p>
              )}
              <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
                Claude will search the web and rate this spot across your criteria.
              </p>
              <button onClick={handleResearch} style={{
                alignSelf: 'flex-start',
                padding: '12px 24px', borderRadius: 2,
                border: '1px solid oklch(0.82 0.13 200)',
                background: 'oklch(0.82 0.13 200 / 0.12)',
                color: 'oklch(0.82 0.13 200)',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                letterSpacing: '0.04em', fontFamily: "'JetBrains Mono', monospace",
              }}>
                Research this spot
              </button>
            </div>
          )}

          {loading && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.1)',
                borderTopColor: 'oklch(0.82 0.13 200)',
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto 16px',
              }} />
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: 0 }}>Searching the web…</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
          )}

          {error && (
            <div style={{
              padding: '12px 14px', borderRadius: 2,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              fontSize: 13, color: '#ef4444', maxWidth: 480,
            }}>
              {error}
              <button onClick={handleResearch} style={{
                display: 'block', marginTop: 10, fontSize: 12,
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
                cursor: 'pointer', padding: 0, textDecoration: 'underline',
              }}>Try again</button>
            </div>
          )}

          {research && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }}>

              <div style={{ width: '100%'}}>
                <div style={{fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', fontFamily: "'JetBrains Mono', monospace", marginBottom: 10 }}>Summary</div>
                <p style={{ maxWidth: 720, margin: '0 auto', fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 1.65, textAlign: 'center' }}>
                  {research.summary}
                </p>
              </div>

              {allCriteriaKeys.length > 0 && (
                <div style={{ width: '100%'}}>
                  <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', fontFamily: "'JetBrains Mono', monospace", marginBottom: 10 }}>Criteria</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
                    {allCriteriaKeys.map(c => (
                      <CriterionCard
                        key={c}
                        criterion={c}
                        rating={research.ratings?.[c]}
                        note={research.ratings_notes?.[c]}
                      />
                    ))}
                  </div>
                </div>
              )}

              {research.sources?.length > 0 && (
                <div style={{ width: '100%'}}>
                  <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', fontFamily: "'JetBrains Mono', monospace", marginBottom: 8 }}>
                    Sources
                  </div>
                  {research.sources.map((src, i) => (
                    <div key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 4, wordBreak: 'break-all' }}>
                      {src.startsWith('http')
                        ? <a href={src} target="_blank" rel="noopener noreferrer" style={{ color: 'oklch(0.82 0.13 200)', textDecoration: 'none' }}>{src}</a>
                        : src}
                    </div>
                  ))}
                </div>
              )}

              <button onClick={handleResearch} style={{
                padding: '10px 20px', borderRadius: 2,
                border: '1px solid rgba(255,255,255,0.12)', background: 'transparent',
                color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.04em',
              }}>
                Re-research
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
