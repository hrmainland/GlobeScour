import { useState } from 'react'

const overlay = {
  position: 'fixed', inset: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000,
  pointerEvents: 'none',
}

const card = {
  background: '#1a1a2e',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 12,
  padding: '28px 32px',
  display: 'flex', flexDirection: 'column', gap: 16,
  minWidth: 280,
  color: '#fff',
  pointerEvents: 'all',
}

const input = {
  padding: '10px 14px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(255,255,255,0.08)',
  color: '#fff',
  fontSize: 15,
  outline: 'none',
}

const row = { display: 'flex', gap: 10 }

const btnSecondary = {
  flex: 1, padding: '9px 0', borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'transparent', color: '#fff',
  fontSize: 15, cursor: 'pointer',
}

const btnPrimary = {
  flex: 1, padding: '9px 0', borderRadius: 8,
  border: 'none', background: '#3b82f6',
  color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
}

export default function PinModal({ onSave, onCancel }) {
  const [name, setName] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (name.trim()) onSave(name.trim())
  }

  return (
    <div style={overlay}>
      <form style={card} onSubmit={handleSubmit}>
        <p style={{ margin: 0, fontWeight: 600 }}>Name this spot</p>
        <input
          style={input}
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Taghazout"
        />
        <div style={row}>
          <button style={btnSecondary} type="button" onClick={onCancel}>Cancel</button>
          <button style={btnPrimary} type="submit">Save</button>
        </div>
      </form>
    </div>
  )
}
