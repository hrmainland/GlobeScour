import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import PinModal from './PinModal'
import Drawer from './Drawer'

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

async function reverseGeocode(lng, lat) {
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=place,locality,poi&limit=1&access_token=${TOKEN}`
    )
    const data = await res.json()
    return data.features?.[0]?.text ?? null
  } catch {
    return null
  }
}

export default function Globe({ user }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef({})
  const [pins, setPins] = useState([])
  const [modal, setModal] = useState(null)   // { lat, lng, suggestedName, locationType }
  const [drawer, setDrawer] = useState(null) // pin object

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

    map.on('click', async (e) => {
      const { lat, lng } = e.lngLat
      const suggestedName = await reverseGeocode(lng, lat)
      setModal({
        lat,
        lng,
        suggestedName,
        locationType: suggestedName ? 'named' : 'coordinate',
      })
    })

    mapRef.current = map
    return () => map.remove()
  }, [])

  useEffect(() => {
    fetch('/api/locations')
      .then(r => r.json())
      .then(setPins)
  }, [])

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
      el.addEventListener('click', e => {
        e.stopPropagation()
        setDrawer(pin)
      })

      new mapboxgl.Marker({ element: el })
        .setLngLat([pin.lng, pin.lat])
        .addTo(map)

      markersRef.current[pin.id] = true
    })
  }, [pins])

  async function handleSavePin(name) {
    const res = await fetch('/api/locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        lat: modal.lat,
        lng: modal.lng,
        created_by: user,
        location_type: modal.locationType,
      }),
    })
    const pin = await res.json()
    setPins(prev => [...prev, pin])
    setModal(null)
  }

  return (
    <>
      <div ref={containerRef} style={{ width: '100%', height: '100vh' }} />
      {modal && (
        <PinModal
          suggestedName={modal.suggestedName}
          onSave={handleSavePin}
          onCancel={() => setModal(null)}
        />
      )}
      {drawer && (
        <Drawer
          pin={drawer}
          onClose={() => setDrawer(null)}
        />
      )}
    </>
  )
}
