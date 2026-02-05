import { useState } from 'react'

function Login({ organization, onLogin, onRegister }) {
    const [mode, setMode] = useState('login') // 'login' or 'register'
    const [name, setName] = useState('')
    const [aadhaar, setAadhaar] = useState('')
    const [role, setRole] = useState('member')
    const [legalRole, setLegalRole] = useState('Judge')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(null)

    const orgInfo = {
        VerifierOrg: {
            icon: '🔍',
            name: 'Verifier',
            color: 'var(--warning)',
            description: 'Verify evidence integrity and authenticity'
        },
        LegalOrg: {
            icon: '⚖️',
            name: 'Legal',
            color: 'var(--accent-secondary)',
            description: 'Review evidence and prepare court documentation'
        }
    }

    const info = orgInfo[organization]

    const formatAadhaar = (value) => {
        // Remove non-digits
        const digits = value.replace(/\D/g, '').slice(0, 12)
        // Format as XXXX XXXX XXXX
        const parts = []
        for (let i = 0; i < digits.length; i += 4) {
            parts.push(digits.slice(i, i + 4))
        }
        return parts.join(' ')
    }

    const handleAadhaarChange = (e) => {
        setAadhaar(formatAadhaar(e.target.value))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setSuccess(null)

        const cleanAadhaar = aadhaar.replace(/\s/g, '')

        if (cleanAadhaar.length !== 12) {
            setError('Aadhaar must be 12 digits')
            setLoading(false)
            return
        }

        try {
            const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
            const body = mode === 'login'
                ? { name, aadhaar: cleanAadhaar }
                : { name, aadhaar: cleanAadhaar, organization, role, legalRole }

            const response = await fetch(`http://localhost:4000${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })

            const result = await response.json()

            if (!result.success) {
                throw new Error(result.error)
            }

            if (mode === 'register') {
                setSuccess(`Registration successful! Your login key: ${result.data.loginKey}`)
                // Switch to login mode after successful registration
                setTimeout(() => {
                    setMode('login')
                    setSuccess(null)
                }, 3000)
            } else {
                // Login successful - pass user data up
                onLogin(result.data)
            }

        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="page" style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '400px',
                padding: '2rem',
                background: 'var(--bg-card)',
                borderRadius: '16px',
                border: `2px solid ${info.color}`
            }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{info.icon}</div>
                    <h2 style={{ color: info.color, marginBottom: '0.25rem' }}>
                        {info.name} Portal
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        {info.description}
                    </p>
                </div>

                {/* Mode Toggle */}
                <div style={{
                    display: 'flex',
                    marginBottom: '1.5rem',
                    background: 'var(--bg-secondary)',
                    borderRadius: '8px',
                    padding: '4px'
                }}>
                    <button
                        type="button"
                        onClick={() => setMode('login')}
                        style={{
                            flex: 1,
                            padding: '0.75rem',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            background: mode === 'login' ? info.color : 'transparent',
                            color: mode === 'login' ? 'white' : 'var(--text-secondary)',
                            fontWeight: mode === 'login' ? 'bold' : 'normal',
                            transition: 'all 0.2s'
                        }}
                    >
                        Login
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('register')}
                        style={{
                            flex: 1,
                            padding: '0.75rem',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            background: mode === 'register' ? info.color : 'transparent',
                            color: mode === 'register' ? 'white' : 'var(--text-secondary)',
                            fontWeight: mode === 'register' ? 'bold' : 'normal',
                            transition: 'all 0.2s'
                        }}
                    >
                        Register
                    </button>
                </div>

                {/* Error/Success Messages */}
                {error && (
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid var(--error)',
                        borderRadius: '8px',
                        padding: '0.75rem',
                        marginBottom: '1rem',
                        color: 'var(--error)',
                        fontSize: '0.9rem'
                    }}>
                        {error}
                    </div>
                )}

                {success && (
                    <div style={{
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid var(--success)',
                        borderRadius: '8px',
                        padding: '0.75rem',
                        marginBottom: '1rem',
                        color: 'var(--success)',
                        fontSize: '0.9rem'
                    }}>
                        {success}
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{
                            display: 'block',
                            marginBottom: '0.5rem',
                            color: 'var(--text-secondary)',
                            fontSize: '0.9rem'
                        }}>
                            Full Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter your full name"
                            required
                            className="form-input"
                            style={{ width: '100%' }}
                        />
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{
                            display: 'block',
                            marginBottom: '0.5rem',
                            color: 'var(--text-secondary)',
                            fontSize: '0.9rem'
                        }}>
                            Aadhaar Number
                        </label>
                        <input
                            type="text"
                            value={aadhaar}
                            onChange={handleAadhaarChange}
                            placeholder="XXXX XXXX XXXX"
                            required
                            className="form-input"
                            style={{
                                width: '100%',
                                fontFamily: 'monospace',
                                letterSpacing: '1px'
                            }}
                        />
                        <p style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                            marginTop: '0.25rem'
                        }}>
                            🔐 Aadhaar is hashed locally - never stored in plaintext
                        </p>
                    </div>

                    {mode === 'register' && (
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{
                                display: 'block',
                                marginBottom: '0.5rem',
                                color: 'var(--text-secondary)',
                                fontSize: '0.9rem'
                            }}>
                                Role
                            </label>
                            <select
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                className="form-select"
                                style={{ width: '100%' }}
                            >
                                <option value="member">Member</option>
                                <option value="senior">Senior {info.name}</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                    )}

                    {mode === 'register' && organization === 'LegalOrg' && (
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{
                                display: 'block',
                                marginBottom: '0.5rem',
                                color: 'var(--text-secondary)',
                                fontSize: '0.9rem'
                            }}>
                                Legal Role
                            </label>
                            <select
                                value={legalRole}
                                onChange={(e) => setLegalRole(e.target.value)}
                                className="form-select"
                                style={{ width: '100%' }}
                            >
                                <option value="Judge">Judge</option>
                                <option value="Advocate">Advocate</option>
                                <option value="Clerk">Law Clerk</option>
                                <option value="Notary">Notary</option>
                                <option value="Prosecutor">Public Prosecutor</option>
                                <option value="Police">Police Officer</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading}
                        style={{
                            width: '100%',
                            marginTop: '0.5rem',
                            background: info.color,
                            borderColor: info.color
                        }}
                    >
                        {loading ? 'Please wait...' : (mode === 'login' ? 'Login' : 'Register')}
                    </button>
                </form>

                <p style={{
                    textAlign: 'center',
                    marginTop: '1.5rem',
                    fontSize: '0.85rem',
                    color: 'var(--text-muted)'
                }}>
                    {mode === 'login'
                        ? "Don't have an account? Click Register above."
                        : "Already registered? Click Login above."
                    }
                </p>
            </div>
        </div>
    )
}

export default Login
