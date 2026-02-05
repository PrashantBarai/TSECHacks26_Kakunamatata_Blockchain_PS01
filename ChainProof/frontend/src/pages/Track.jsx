import { useState, useEffect } from 'react'
import { getNotifications, getReputation, getEvidence } from '../services/api'
import { hasSessionKey, getSessionKey } from '../services/crypto'

function Track() {
    const [notifications, setNotifications] = useState([])
    const [reputation, setReputation] = useState(null)
    const [loading, setLoading] = useState(false)
    const [evidenceId, setEvidenceId] = useState('')

    // Lookup state
    const [lookupResult, setLookupResult] = useState(null)
    const [lookupError, setLookupError] = useState(null)
    const [lookupLoading, setLookupLoading] = useState(false)

    const sessionKey = getSessionKey()
    const hasKey = hasSessionKey()

    useEffect(() => {
        if (hasKey && sessionKey?.publicKeyHash) {
            loadData()
        }
    }, [hasKey])

    const loadData = async () => {
        if (!sessionKey?.publicKeyHash) return

        setLoading(true)
        try {
            const [notifRes, repRes] = await Promise.all([
                getNotifications(sessionKey.publicKeyHash),
                getReputation(sessionKey.publicKeyHash)
            ])
            const notifData = notifRes.data
            setNotifications(Array.isArray(notifData) ? notifData : (notifData?.notifications || []))
            setReputation(repRes.data)
        } catch (error) {
            console.error('Failed to load data:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleLookup = async () => {
        if (!evidenceId) return
        setLookupLoading(true)
        setLookupError(null)
        setLookupResult(null)

        try {
            const res = await getEvidence(evidenceId)
            if (res.error) throw new Error(res.error)
            setLookupResult(res.data || res) // Handle both wrapper formats
        } catch (err) {
            setLookupError(err.message || 'Evidence not found or access denied')
        } finally {
            setLookupLoading(false)
        }
    }

    const getTrustScoreColor = (score) => {
        if (score >= 70) return 'var(--success)'
        if (score >= 40) return 'var(--warning)'
        return 'var(--error)'
    }

    if (!hasKey) {
        return (
            <div className="page">
                <h1 className="page-title">Track Status</h1>
                <div className="card">
                    <div style={{
                        textAlign: 'center',
                        padding: '3rem',
                        color: 'var(--text-secondary)'
                    }}>
                        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🔑</div>
                        <h3>No Key Loaded</h3>
                        <p>Please go to the Home page and load your private key to view your submissions.</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="page">
            <h1 className="page-title">Track Status</h1>
            <p className="page-subtitle">
                Monitor your submissions and check for notifications.
            </p>

            {/* Reputation Card */}
            <div className="card">
                <h3 className="card-title">📊 Your Reputation Score</h3>

                {reputation ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                        <div style={{
                            width: 100,
                            height: 100,
                            borderRadius: '50%',
                            background: `conic-gradient(${getTrustScoreColor(reputation.trustScore)} ${reputation.trustScore * 3.6}deg, var(--border) 0deg)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <div style={{
                                width: 80,
                                height: 80,
                                borderRadius: '50%',
                                background: 'var(--bg-card)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexDirection: 'column'
                            }}>
                                <span style={{
                                    fontSize: '1.75rem',
                                    fontWeight: 'bold',
                                    color: getTrustScoreColor(reputation.trustScore)
                                }}>
                                    {reputation.trustScore}
                                </span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Trust</span>
                            </div>
                        </div>

                        <div style={{ flex: 1 }}>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(3, 1fr)',
                                gap: '1rem'
                            }}>
                                <div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                                        {reputation.totalSubmissions || 0}
                                    </div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                        Total Submissions
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--success)' }}>
                                        {reputation.verifiedSubmissions || 0}
                                    </div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                        Verified
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--error)' }}>
                                        {reputation.rejectedSubmissions || 0}
                                    </div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                        Rejected
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <p style={{ color: 'var(--text-secondary)' }}>
                        {loading ? 'Loading reputation data...' : 'No reputation data found.'}
                    </p>
                )}
            </div>

            {/* Notifications */}
            <div className="card">
                <h3 className="card-title">🔔 Notifications</h3>

                {loading ? (
                    <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
                ) : notifications.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '2rem',
                        color: 'var(--text-secondary)'
                    }}>
                        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📭</div>
                        <p>No notifications yet</p>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                            You'll receive updates here when your evidence is verified or reviewed.
                        </p>
                    </div>
                ) : (
                    <div>
                        {notifications.map((notif, index) => (
                            <div
                                key={notif.notificationId || index}
                                style={{
                                    padding: '1rem',
                                    background: notif.read ? 'transparent' : 'var(--bg-secondary)',
                                    borderRadius: '8px',
                                    marginBottom: '0.5rem',
                                    borderLeft: `3px solid ${notif.messageType === 'REJECTION' ? 'var(--error)' :
                                        notif.messageType === 'VERIFIED' ? 'var(--success)' :
                                            'var(--accent-primary)'
                                        }`
                                }}
                            >
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    marginBottom: '0.5rem'
                                }}>
                                    <span className={`status-badge status-${notif.messageType?.toLowerCase() || 'submitted'}`}>
                                        {notif.messageType}
                                    </span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                        {new Date(notif.timestamp * 1000).toLocaleString()}
                                    </span>
                                </div>
                                <p style={{ color: 'var(--text-primary)' }}>{notif.message}</p>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                                    Evidence: {notif.evidenceId}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <button
                    className="btn btn-secondary"
                    onClick={loadData}
                    style={{ marginTop: '1rem' }}
                >
                    🔄 Refresh
                </button>
            </div>

            {/* Manual Lookup */}
            <div className="card">
                <h3 className="card-title">🔍 Look Up Evidence</h3>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="Enter Evidence ID (e.g., EVD-ABC12345)"
                        value={evidenceId}
                        onChange={(e) => setEvidenceId(e.target.value)}
                        style={{ flex: 1 }}
                    />
                    <button
                        className="btn btn-primary"
                        disabled={!evidenceId || lookupLoading}
                        onClick={handleLookup}
                    >
                        {lookupLoading ? 'Searching...' : 'Search'}
                    </button>
                </div>

                {lookupError && (
                    <div style={{
                        padding: '1rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: 'var(--error)',
                        borderRadius: '8px'
                    }}>
                        {lookupError}
                    </div>
                )}

                {lookupResult && (
                    <div style={{
                        padding: '1rem',
                        background: 'var(--bg-secondary)',
                        borderRadius: '8px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <strong>Status:</strong>
                            <span className={`status-badge status-${lookupResult.status?.toLowerCase()}`}>
                                {lookupResult.status}
                            </span>
                        </div>
                        <div style={{ marginTop: '0.5rem' }}>
                            <strong>Submitted:</strong> {new Date(lookupResult.submittedAt * 1000).toLocaleString()}
                        </div>
                        <div style={{ marginTop: '0.5rem' }}>
                            <strong>Description:</strong> {lookupResult.description || 'No description'}
                        </div>
                        {lookupResult.integrityStatus && (
                            <div style={{ marginTop: '0.5rem' }}>
                                <strong>Integrity:</strong> {lookupResult.integrityStatus}
                            </div>
                        )}
                        {lookupResult.rejectionComment && (
                            <div style={{ marginTop: '0.5rem', color: 'var(--error)' }}>
                                <strong>Rejection Reason:</strong> {lookupResult.rejectionComment}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

export default Track
