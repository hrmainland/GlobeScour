import { useState } from 'react'
import Globe from './components/Globe'
import UserSelector from './components/UserSelector'
import MapSelector from './components/MapSelector'

export default function App() {
  const [user, setUser] = useState(() => localStorage.getItem('globescour_user'))
  const [map, setMap] = useState(null)

  function handleSelectUser(name) {
    localStorage.setItem('globescour_user', name)
    setUser(name)
  }

  function handleSelectMap(selectedMap) {
    setMap(selectedMap)
  }

  if (!user) return <UserSelector onSelect={handleSelectUser} />
  if (!map) return <MapSelector user={user} onSelect={handleSelectMap} />
  return <Globe user={user} map={map} onMapChange={setMap} />
}
