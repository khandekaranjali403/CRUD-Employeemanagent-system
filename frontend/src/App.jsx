import { useEffect, useState } from 'react'
import './App.css'
import api from './lib/api.js'
import { Icon } from './components/Icons.jsx'
import AuthPage from './components/AuthPage.jsx'
import Dashboard from './components/Dashboard.jsx'

function App() {
  const [user, setUser] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    api('/auth/me').then((result) => setUser(result.user)).catch(() => setUser(null)).finally(() => setCheckingSession(false))
  }, [])

  async function logout() {
    try {
      await api('/auth/logout', { method: 'POST' })
      setUser(null)
    } catch (error) {
      console.error('Unable to sign out:', error)
    }
  }

  if (checkingSession) return <div className="app-loading"><span className="loading-mark"><Icon name="spark" size={20} /></span>Getting peopleflow ready…</div>
  return user ? <Dashboard user={user} onLogout={logout} /> : <AuthPage onLogin={setUser} />
}

export default App
