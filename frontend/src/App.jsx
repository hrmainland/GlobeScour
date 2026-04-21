import { useState } from 'react'
import Globe from './components/Globe'
import UserSelector from './components/UserSelector'

export default function App() {
  const [user, setUser] = useState(() => localStorage.getItem('globescour_user'))

  function handleSelect(name) {
    localStorage.setItem('globescour_user', name)
    setUser(name)
  }

  if (!user) return <UserSelector onSelect={handleSelect} />
  return <Globe user={user} />
}
