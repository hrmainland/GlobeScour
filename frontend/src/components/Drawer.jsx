import { useState } from 'react'

const CRITERIA = ['waves', 'crowds', 'accessibility', 'accommodation', 'vibe']

const CRITERION_LABELS = {
  waves: 'Waves',
  crowds: 'Crowds',
  accessibility: 'Getting There',
  accommodation: 'Stay',
  vibe: 'Vibe',
}

const TRAFFIC_COLORS = {
  green: { bg: '#22c55e', glow: 'rgba(34,197,94,0.45)' },
  amber: { bg: '#f59e0b', glow: 'rgba(245,158,11,0.45)' },
  red:   { bg: '#ef4444', glow: 'rgba(239,68,68,0.45)' },
  none:  { bg: 'rgba(255,255,255,0.12)', glow: 'none' },
}

function TrafficLight({ rating }) {
  const color = TRAFFIC_COLORS[rating] ?? TRAFFIC_COLORS.none
  return (
    <span style={{
      display: 'inline-block',
      width: 12, height: 12,
      borderRadius: '50%',
      background: color.bg,
      boxShadow: rating && rating !== 'none' ? `0 0 8px ${color.glow}` : 'none',
      flexShrink: 0,
    }} />
  )
}

function RatingRow({ criterion, rating, note }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 0',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      <TrafficLight rating={rating} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace" }}>
          {CRITERION_LABELS[criterion]}
        </div>
        {note && (
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 2, lineHeight: 1.4 }}>
            {note}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Drawer({ pin, onClose }) {
  const [research, setResearch] = useState(pin.research ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleResearch() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/locations/${pin.id}/research`, { method: 'POST' })
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const data = await res.json()
      setResearch(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          zIndex: 900,
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed',
        top: 0, right: 0, bottom: 0,
        width: 360,
        zIndex: 901,
        background: 'rgba(10,10,28,0.82)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderLeft: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', flexDirection: 'column',
        color: '#fff',
        fontFamily: "'Inter Tight', Inter, sans-serif",
      }}>

        {/* Header */}
        <div style={{
          padding: '24px 24px 0',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>
              {pin.location_type === 'coordinate' ? `${pin.lat.toFixed(3)}, ${pin.lng.toFixed(3)}` : pin.location_type}
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
              fontSize: 20, cursor: 'pointer', padding: '2px 4px', lineHeight: 1,
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 32px' }}>

          {!research && !loading && (
            <div style={{ marginTop: 8 }}>
              <p style={{ margin: '0 0 16px', fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
                Claude will search the web and rate this spot across five criteria.
              </p>
              <button onClick={handleResearch} style={{
                width: '100%', padding: '12px 0',
                borderRadius: 2,
                border: '1px solid oklch(0.82 0.13 200)',
                background: 'oklch(0.82 0.13 200 / 0.12)',
                color: 'oklch(0.82 0.13 200)',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                letterSpacing: '0.04em',
                fontFamily: "'JetBrains Mono', monospace",
                transition: 'background 0.15s',
              }}>
                Research this spot
              </button>
            </div>
          )}

          {loading && (
            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.1)',
                borderTopColor: 'oklch(0.82 0.13 200)',
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto 16px',
              }} />
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
                Searching the web…
              </p>
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
          )}

          {error && (
            <div style={{
              marginTop: 16, padding: '12px 14px', borderRadius: 2,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              fontSize: 13, color: '#ef4444',
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
            <div style={{ marginTop: 8 }}>
              <p style={{ margin: '0 0 20px', fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 1.65 }}>
                {research.summary}
              </p>

              <div style={{ marginBottom: 24 }}>
                {CRITERIA.map(c => (
                  <RatingRow
                    key={c}
                    criterion={c}
                    rating={research.ratings?.[c]}
                    note={research.ratings_notes?.[c]}
                  />
                ))}
              </div>

              {research.sources?.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', fontFamily: "'JetBrains Mono', monospace", marginBottom: 8 }}>
                    Sources
                  </div>
                  {research.sources.map((src, i) => (
                    <div key={i} style={{
                      fontSize: 12, color: 'rgba(255,255,255,0.4)',
                      marginBottom: 4, wordBreak: 'break-all',
                    }}>
                      {src.startsWith('http')
                        ? <a href={src} target="_blank" rel="noopener noreferrer" style={{ color: 'oklch(0.82 0.13 200)', textDecoration: 'none' }}>{src}</a>
                        : src
                      }
                    </div>
                  ))}
                </div>
              )}

              <button onClick={handleResearch} style={{
                marginTop: 24, width: '100%', padding: '10px 0',
                borderRadius: 2,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'transparent',
                color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: '0.04em',
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
