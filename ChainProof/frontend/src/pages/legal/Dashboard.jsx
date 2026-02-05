import { useState, useEffect } from 'react'
import { queryEvidenceByStatus, getAssignments } from '../../services/api'

function LegalDashboard({ setPage, user }) {
    const [evidence, setEvidence] = useState([])
    const [assignments, setAssignments] = useState({})
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [stats, setStats] = useState({ ready: 0, reviewing: 0, exported: 0 })

    useEffect(() => {
        loadVerifiedEvidence()
    }, [])

    const loadVerifiedEvidence = async () => {
        setLoading(true)
        setError(null)
        try {
            // Fetch multiple statuses in parallel to avoid "disappearing" evidence
            const [verRes, revRes, urRes, expRes, assignRes] = await Promise.all([
                queryEvidenceByStatus('VERIFIED', 50),
                queryEvidenceByStatus('REVIEWED', 50),
                queryEvidenceByStatus('UNDER_REVIEW', 50),
                queryEvidenceByStatus('EXPORTED', 50),
                getAssignments()
            ]);

            const rawEvidence = [
                ...(Array.isArray(verRes.data) ? verRes.data : (verRes.data?.records || [])),
                ...(Array.isArray(revRes.data) ? revRes.data : (revRes.data?.records || [])),
                ...(Array.isArray(urRes.data) ? urRes.data : (urRes.data?.records || [])),
                ...(Array.isArray(expRes.data) ? expRes.data : (expRes.data?.records || []))
            ];

            const assignmentMap = assignRes.data || {};
            setAssignments(assignmentMap);

            // Filter for unique evidence and by Legal Role
            const ids = new Set();
            const filteredEvidence = rawEvidence.filter(item => {
                if (ids.has(item.evidenceId)) return false;
                ids.add(item.evidenceId);

                // Role filtering
                if (user?.legalRole) {
                    const meta = assignmentMap[item.evidenceId];
                    return meta?.targetLegalRole === user.legalRole;
                }
                return true;
            });


            // Calculate stats for the dashboard header
            setStats({
                ready: filteredEvidence.filter(e => e.status === 'VERIFIED').length,
                reviewing: filteredEvidence.filter(e => e.status === 'UNDER_REVIEW' || e.status === 'REVIEWED').length,
                exported: filteredEvidence.filter(e => e.status === 'EXPORTED').length
            });

            // Sort by submission date (newest first)
            setEvidence(filteredEvidence.sort((a, b) => b.submittedAt - a.submittedAt));

        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const getStatusColor = (status) => {
        switch (status) {
            case 'VERIFIED': return 'var(--success)'
            case 'LEGAL_REVIEW': return 'var(--accent-primary)'
            case 'COURT_READY': return 'var(--accent-secondary)'
            default: return 'var(--text-muted)'
        }
    }

    return (
        <div className="page">
            <h1 className="page-title">⚖️ Legal Review Dashboard</h1>
            <p className="page-subtitle">
                Review verified evidence and prepare court-ready documentation.
            </p>

            {/* Stats */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1rem',
                marginBottom: '2rem'
            }}>
                <div className="card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>
                        {stats.ready}
                    </div>
                    <div style={{ color: 'var(--text-muted)' }}>Ready for Review</div>
                </div>
                <div className="card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>
                        {stats.reviewing}
                    </div>
                    <div style={{ color: 'var(--text-muted)' }}>In Review</div>
                </div>
                <div className="card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--accent-secondary)' }}>
                        {stats.exported}
                    </div>
                    <div style={{ color: 'var(--text-muted)' }}>Court Ready</div>
                </div>
            </div>

            {/* Evidence Queue */}
            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 className="card-title" style={{ margin: 0 }}>📋 Verified Evidence</h3>
                    <button className="btn btn-secondary" onClick={loadVerifiedEvidence}>
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
                        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📭</div>
                        <h3>No Verified Evidence</h3>
                        <p>Verified evidence will appear here for legal review.</p>
                    </div>
                ) : (
                    <div>
                        {evidence.map((item, index) => (
                            <div
                                key={item.evidenceId || index}
                                style={{
                                    padding: '1rem',
                                    background: 'var(--bg-secondary)',
                                    borderRadius: '8px',
                                    marginBottom: '0.75rem',
                                    cursor: 'pointer',
                                    borderLeft: `4px solid ${getStatusColor(item.status)}`
                                }}
                                onClick={() => setPage({ name: 'legal-review', data: item })}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--accent-primary)' }}>
                                            {item.evidenceId}
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                            Category: {item.category} • Verified ✓
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <span style={{
                                            background: 'rgba(16, 185, 129, 0.2)',
                                            color: 'var(--success)',
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '20px',
                                            fontSize: '0.8rem',
                                            fontWeight: 'bold'
                                        }}>
                                            {item.status}
                                        </span>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                            {new Date(item.submittedAt * 1000).toLocaleDateString()}
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

export default LegalDashboard
