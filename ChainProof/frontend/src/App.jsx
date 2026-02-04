import { useState, useEffect } from 'react'
import { hasSessionKey, getSessionKey } from './services/crypto'
import Home from './pages/Home'
import Submit from './pages/Submit'
import Track from './pages/Track'
import VerifierDashboard from './pages/verifier/Dashboard'
import Verify from './pages/verifier/Verify'
import LegalDashboard from './pages/legal/Dashboard'
import LegalReview from './pages/legal/Review'
import Login from './pages/auth/Login'
import './styles/index.css'

function App() {
  const [page, setPage] = useState({ name: 'org-select' })
  const [currentOrg, setCurrentOrg] = useState(null)
  const [authenticatedUser, setAuthenticatedUser] = useState(null)

  // Get session key state for display (whistleblower)
  const sessionKey = getSessionKey()
  const hasKey = hasSessionKey()

  // Check for saved session on mount
  useEffect(() => {
    const savedSession = localStorage.getItem('chainproof_user')
    if (savedSession) {
      try {
        const user = JSON.parse(savedSession)
        setAuthenticatedUser(user)
        setCurrentOrg(user.organization)
      } catch { }
    }
  }, [])

  const handleOrgSelect = async (org) => {
    setCurrentOrg(org)

    // Switch Fabric Gateway to selected org
    try {
      const response = await fetch('http://localhost:5000/api/fabric/org/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org })
      })
      const result = await response.json()
      console.log(`Fabric Gateway switched to: ${result.org}`)
    } catch (error) {
      console.error('Failed to switch Fabric org:', error)
    }

    // Navigate based on org
    switch (org) {
      case 'WhistleblowersOrg':
        // Whistleblowers don't need login
        setPage({ name: 'home' })
        break
      case 'VerifierOrg':
      case 'LegalOrg':
        // Check if already logged in
        if (authenticatedUser && authenticatedUser.organization === org) {
          setPage({ name: org === 'VerifierOrg' ? 'verifier-dashboard' : 'legal-dashboard' })
        } else {
          // Show login page
          setPage({ name: 'login', data: { organization: org } })
        }
        break
    }
  }

  const handleLogin = (user) => {
    // Save to state and localStorage
    setAuthenticatedUser(user)
    localStorage.setItem('chainproof_user', JSON.stringify(user))

    // Navigate to appropriate dashboard
    if (user.organization === 'VerifierOrg') {
      setPage({ name: 'verifier-dashboard' })
    } else {
      setPage({ name: 'legal-dashboard' })
    }
  }

  const handleLogout = () => {
    setAuthenticatedUser(null)
    localStorage.removeItem('chainproof_user')
    setCurrentOrg(null)
    setPage({ name: 'org-select' })
  }

  const renderPage = () => {
    switch (page.name) {
      case 'org-select':
        return <OrgSelector onSelect={handleOrgSelect} />
      case 'login':
        return (
          <Login
            organization={page.data?.organization}
            onLogin={handleLogin}
          />
        )
      case 'home':
        return <Home setPage={setPage} />
      case 'submit':
        return <Submit />
      case 'track':
        return <Track />
      case 'verifier-dashboard':
        return <VerifierDashboard setPage={setPage} user={authenticatedUser} />
      case 'verify':
        return <Verify evidenceData={page.data} setPage={setPage} user={authenticatedUser} />
      case 'legal-dashboard':
        return <LegalDashboard setPage={setPage} user={authenticatedUser} />
      case 'legal-review':
        return <LegalReview evidenceData={page.data} setPage={setPage} user={authenticatedUser} />
      default:
        return <OrgSelector onSelect={handleOrgSelect} />
    }
  }

  const getNavItems = () => {
    switch (currentOrg) {
      case 'WhistleblowersOrg':
        return [
          { name: 'home', label: 'Home' },
          { name: 'submit', label: 'Submit Evidence' },
          { name: 'track', label: 'Track Status' }
        ]
      case 'VerifierOrg':
        return [
          { name: 'verifier-dashboard', label: 'Dashboard' }
        ]
      case 'LegalOrg':
        return [
          { name: 'legal-dashboard', label: 'Dashboard' }
        ]
      default:
        return []
    }
  }

  const getOrgBadge = () => {
    switch (currentOrg) {
      case 'WhistleblowersOrg':
        return { icon: '🔐', name: 'Whistleblower', color: 'var(--accent-primary)' }
      case 'VerifierOrg':
        return { icon: '🔍', name: 'Verifier', color: 'var(--warning)' }
      case 'LegalOrg':
        return { icon: '⚖️', name: 'Legal', color: 'var(--accent-secondary)' }
      default:
        return null
    }
  }

  const orgBadge = getOrgBadge()

  return (
    <div className="app">
      <header className="header">
        <div className="logo" onClick={() => setPage({ name: 'org-select' })} style={{ cursor: 'pointer' }}>
          <span className="logo-icon">🔐</span>
          <span className="logo-text">ChainProof</span>
        </div>

        {currentOrg && page.name !== 'login' && (
          <nav className="nav">
            {getNavItems().map(item => (
              <button
                key={item.name}
                className={`nav-btn ${page.name === item.name ? 'active' : ''}`}
                onClick={() => setPage({ name: item.name })}
              >
                {item.label}
              </button>
            ))}
          </nav>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {orgBadge && (
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              padding: '0.5rem 1rem',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              border: `1px solid ${orgBadge.color}`
            }}>
              <span>{orgBadge.icon}</span>
              <span style={{ color: orgBadge.color }}>{orgBadge.name}</span>
            </div>
          )}

          {currentOrg === 'WhistleblowersOrg' && (
            <div className="identity-badge">
              <span className="badge-dot" style={{
                background: hasKey ? 'var(--success)' : 'var(--warning)'
              }}></span>
              <span className="badge-text">{hasKey ? 'Key Loaded' : 'No Key'}</span>
              {hasKey && (
                <span className="badge-hash" title={sessionKey?.publicKeyHash}>
                  {sessionKey?.publicKeyHash?.substring(0, 8)}...
                </span>
              )}
            </div>
          )}

          {/* Show logged in user + logout for verifier/legal */}
          {authenticatedUser && (currentOrg === 'VerifierOrg' || currentOrg === 'LegalOrg') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                background: 'rgba(255,255,255,0.1)',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                fontSize: '0.85rem'
              }}>
                <span style={{ color: 'var(--text-muted)' }}>👤</span>
                <span style={{ marginLeft: '0.5rem' }}>{authenticatedUser.name}</span>
              </div>
              <button
                onClick={handleLogout}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--error)',
                  color: 'var(--error)',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="main">
        {renderPage()}
      </main>

      <footer className="footer">
        <p>🔒 End-to-end encrypted • Hyperledger Fabric + Sepolia Anchor</p>
        <p className="footer-sub">
          {authenticatedUser
            ? `Logged in as ${authenticatedUser.name} (${authenticatedUser.organization})`
            : currentOrg
              ? `Connected as ${currentOrg}`
              : 'Select your organization to continue'
          }
        </p>
      </footer>
    </div>
  )
}

// Organization Selector Component
function OrgSelector({ onSelect }) {
  const orgs = [
    {
      id: 'WhistleblowersOrg',
      icon: '🔐',
      name: 'Whistleblower',
      description: 'Submit anonymous evidence securely',
      color: 'var(--accent-primary)'
    },
    {
      id: 'VerifierOrg',
      icon: '🔍',
      name: 'Verifier',
      description: 'Verify evidence integrity and authenticity',
      color: 'var(--warning)'
    },
    {
      id: 'LegalOrg',
      icon: '⚖️',
      name: 'Legal',
      description: 'Review evidence and prepare court documentation',
      color: 'var(--accent-secondary)'
    }
  ]

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Welcome to ChainProof</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '3rem' }}>
        Select your organization to continue
      </p>

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {orgs.map(org => (
          <div
            key={org.id}
            onClick={() => onSelect(org.id)}
            style={{
              width: '220px',
              padding: '2rem',
              background: 'var(--bg-card)',
              borderRadius: '16px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              border: `2px solid transparent`
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = org.color
              e.currentTarget.style.transform = 'translateY(-8px)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = 'transparent'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>{org.icon}</div>
            <h3 style={{ color: org.color, marginBottom: '0.5rem' }}>{org.name}</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              {org.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
