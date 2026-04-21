import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import PinModal from './PinModal'

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

export default function Globe({ user }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef({}) // id -> Marker, prevents duplicate markers
  const [pins, setPins] = useState([])
  const [pendingClick, setPendingClick] = useState(null) // { lat, lng }

  // Initialise map
  useEffect(() => {
    if (!TOKEN) {
      console.error('VITE_MAPBOX_TOKEN is not set')
      return
    }

    mapboxgl.accessToken = TOKEN
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      projection: 'globe',
      zoom: 1.5,
      center: [0, 20],
    })

    map.addControl(new mapboxgl.NavigationControl())

    map.on('click', e => {
      setPendingClick({ lat: e.lngLat.lat, lng: e.lngLat.lng })
    })

    mapRef.current = map
    return () => map.remove()
  }, [])

  // Fetch all pins on mount
  useEffect(() => {
    fetch('/api/locations')
      .then(r => r.json())
      .then(setPins)
  }, [])

  // Add a marker for each pin not yet on the map
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    pins.forEach(pin => {
      if (markersRef.current[pin.id]) return

      const el = document.createElement('div')
      el.style.cssText = `
        width: 14px; height: 14px;
        background: #3b82f6; border-radius: 50%;
        border: 2px solid #fff;
        cursor: pointer;
        box-shadow: 0 0 6px rgba(0,0,0,0.4);
      `
      // Prevent map click from firing when clicking a marker
      el.addEventListener('click', e => e.stopPropagation())

      new mapboxgl.Marker({ element: el })
        .setLngLat([pin.lng, pin.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 12 }).setHTML(
            `<strong>${pin.name}</strong><br/><small>Added by ${pin.created_by}</small>`
          )
        )
        .addTo(map)

      markersRef.current[pin.id] = true
    })
  }, [pins])

  async function handleSavePin(name) {
    const res = await fetch('/api/locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, lat: pendingClick.lat, lng: pendingClick.lng, created_by: user }),
    })
    const pin = await res.json()
    setPins(prev => [...prev, pin])
    setPendingClick(null)
  }

  return (
    <>
      <div ref={containerRef} style={{ width: '100%', height: '100vh' }} />
      {pendingClick && (
        <PinModal
          onSave={handleSavePin}
          onCancel={() => setPendingClick(null)}
        />
      )}
    </>
  )
}
