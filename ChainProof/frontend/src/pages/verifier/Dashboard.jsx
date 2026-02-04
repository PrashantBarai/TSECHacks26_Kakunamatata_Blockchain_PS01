import { useState, useEffect } from 'react'
import { queryEvidenceByStatus } from '../../services/api'

function VerifierDashboard({ setPage }) {
    const [evidence, setEvidence] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        loadPendingEvidence()
    }, [])

    const loadPendingEvidence = async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await queryEvidenceByStatus('SUBMITTED', 20)
            // Handle various response formats
            let data = []
            if (res && res.data) {
                data = Array.isArray(res.data) ? res.data : []
            } else if (res && res.success === false) {
                throw new Error(res.error || 'Failed to fetch evidence')
            }
            setEvidence(data)
        } catch (err) {
            console.error('Failed to load evidence:', err)
            setError(err.message || 'Failed to load evidence')
            setEvidence([])
        } finally {
            setLoading(false)
        }
    }

    const getStatusColor = (status) => {
        switch (status) {
            case 'SUBMITTED': return 'var(--warning)'
            case 'VERIFIED': return 'var(--success)'
            case 'REJECTED': return 'var(--error)'
            default: return 'var(--text-muted)'
        }
    }

    const formatFileSize = (size) => {
        if (!size || isNaN(size)) return '-- KB'
        return `${(Number(size) / 1024).toFixed(1)} KB`
    }

    const formatDate = (timestamp) => {
        if (!timestamp) return '--'
        try {
            return new Date(timestamp * 1000).toLocaleDateString()
        } catch {
            return '--'
        }
    }

    return (
        <div className="page">
            <h1 className="page-title">🔍 Verifier Dashboard</h1>
            <p className="page-subtitle">
                Review and verify submitted evidence. Ensure integrity before approval.
            </p>

            {/* Stats */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1rem',
                marginBottom: '2rem'
            }}>
                <div className="card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--warning)' }}>
                        {evidence.length}
                    </div>
                    <div style={{ color: 'var(--text-muted)' }}>Pending Review</div>
                </div>
                <div className="card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>
                        --
                    </div>
                    <div style={{ color: 'var(--text-muted)' }}>Verified Today</div>
                </div>
                <div className="card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--error)' }}>
                        --
                    </div>
                    <div style={{ color: 'var(--text-muted)' }}>Rejected Today</div>
                </div>
            </div>

            {/* Evidence Queue */}
            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 className="card-title" style={{ margin: 0 }}>📋 Evidence Queue</h3>
                    <button className="btn btn-secondary" onClick={loadPendingEvidence}>
                        🔄 Refresh
                    </button>
                </div>

                {error && (
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid var(--error)',
                        borderRadius: '8px',
                        padding: '1rem',
                        marginBottom: '1rem',
                        color: 'var(--error)'
                    }}>
                        {error}
                    </div>
                )}

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <div className="loading-spinner"></div>
                        <p>Loading evidence...</p>
                    </div>
                ) : evidence.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
                        <h3>All Caught Up!</h3>
                        <p>No pending evidence to verify.</p>
                    </div>
                ) : (
                    <div>
                        {evidence.map((item, index) => (
                            <div
                                key={item?.evidenceId || `item-${index}`}
                                style={{
                                    padding: '1rem',
                                    background: 'var(--bg-secondary)',
                                    borderRadius: '8px',
                                    marginBottom: '0.75rem',
                                    cursor: 'pointer',
                                    transition: 'transform 0.2s',
                                    borderLeft: `4px solid ${getStatusColor(item?.status)}`
                                }}
                                onClick={() => setPage({ name: 'verify', data: item })}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--accent-primary)' }}>
                                            {item?.evidenceId || 'Unknown ID'}
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                            Category: {item?.category || 'N/A'} • {item?.fileType || 'N/A'} • {formatFileSize(item?.fileSize)}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <span style={{
                                            background: 'rgba(251, 191, 36, 0.2)',
                                            color: 'var(--warning)',
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '20px',
                                            fontSize: '0.8rem',
                                            fontWeight: 'bold'
                                        }}>
                                            {item?.status || 'UNKNOWN'}
                                        </span>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                            {formatDate(item?.submittedAt)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export default VerifierDashboard

