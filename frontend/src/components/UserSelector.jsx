import { useState } from 'react'

const overlay = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000,
}

const card = {
  background: '#1a1a2e',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 12,
  padding: '40px 48px',
  display: 'flex', flexDirection: 'column', gap: 20,
  minWidth: 320,
  color: '#fff',
  textAlign: 'center',
}

const input = {
  padding: '10px 14px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(255,255,255,0.08)',
  color: '#fff',
  fontSize: 16,
  outline: 'none',
}

const button = {
  padding: '10px 0',
  borderRadius: 8,
  border: 'none',
  background: '#3b82f6',
  color: '#fff',
  fontSize: 16,
  fontWeight: 600,
  cursor: 'pointer',
}

export default function UserSelector({ onSelect }) {
  const [name, setName] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (name.trim()) onSelect(name.trim())
  }

  return (
    <div style={overlay}>
      <form style={card} onSubmit={handleSubmit}>
        <h2 style={{ margin: 0, fontSize: 24 }}>GlobeScour</h2>
        <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)' }}>Who are you?</p>
        <input
          style={input}
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Your name"
        />
        <button style={button} type="submit">Let&apos;s go</button>
      </form>
    </div>
  )
}
