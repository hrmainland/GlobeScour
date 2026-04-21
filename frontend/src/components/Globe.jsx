import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

export default function Globe() {
  const containerRef = useRef(null)
  const mapRef = useRef(null)

  useEffect(() => {
    if (!TOKEN) {
      console.error('VITE_MAPBOX_TOKEN is not set')
      return
    }

    mapboxgl.accessToken = TOKEN
    mapRef.current = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      projection: 'globe',
      zoom: 1.5,
      center: [0, 20],
    })

    mapRef.current.addControl(new mapboxgl.NavigationControl())

    return () => mapRef.current.remove()
  }, [])

  return <div ref={containerRef} style={{ width: '100%', height: '100vh' }} />
}
