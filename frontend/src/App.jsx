import { useState, useEffect } from 'react'
import Globe from './components/Globe'
import UserSelector from './components/UserSelector'
import MapSelector from './components/MapSelector'

const LAST_MAP_KEY = 'globescour_last_map_id'

export default function App() {
  const [user, setUser] = useState(() => localStorage.getItem('globescour_user'))
  const [map, setMap] = useState(null)
  const [mapChecked, setMapChecked] = useState(false)

  // On mount, try to restore the last viewed map
  useEffect(() => {
    const lastMapId = localStorage.getItem(LAST_MAP_KEY)
    if (!lastMapId) { setMapChecked(true); return }

    fetch(`/api/maps/${lastMapId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((doc) => { if (doc) setMap(doc) })
      .finally(() => setMapChecked(true))
  }, [])

  function handleSelectUser(name) {
    localStorage.setItem('globescour_user', name)
    setUser(name)
  }

  function handleSelectMap(selectedMap) {
    localStorage.setItem(LAST_MAP_KEY, selectedMap.id)
    setMap(selectedMap)
  }

  function handleExit() {
    setMap(null)
  }

  if (!user) return <UserSelector onSelect={handleSelectUser} />
  if (!mapChecked) return null
  if (!map) return <MapSelector user={user} onSelect={handleSelectMap} />
  return <Globe user={user} map={map} onMapChange={setMap} onExit={handleExit} />
}
