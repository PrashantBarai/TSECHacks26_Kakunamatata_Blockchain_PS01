import { useState, useEffect } from 'react'
import { queryEvidenceByStatus, getAssignments, assignEvidence, getUserProfile } from '../../services/api'

function VerifierDashboard({ setPage, user }) {
    const [evidence, setEvidence] = useState([])
    const [assignments, setAssignments] = useState({})
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [assigning, setAssigning] = useState(null)
    const [userStats, setUserStats] = useState(user || {})

    useEffect(() => {
        loadPendingEvidence()
    }, [])

    const loadPendingEvidence = async () => {
        setLoading(true)
        setError(null)
        try {
            // Load evidence, assignments, and updated user profile in parallel
            const promises = [
                queryEvidenceByStatus('SUBMITTED', 20),
                getAssignments()
            ];

            if (user?.publicKeyHash) {
                promises.push(getUserProfile(user.publicKeyHash));
            }

            const results = await Promise.all(promises);
            const evRes = results[0];
            const assignRes = results[1];
            const profileRes = results[2]; // May be undefined if no user

            // Handle evidence response
            let data = []
            if (evRes && evRes.data) {
                // Data comes as { records: [...], fetchedRecordsCount, bookmark }
                const resultData = evRes.data.records || evRes.data.results || evRes.data
                data = Array.isArray(resultData) ? resultData : []
            } else if (evRes && evRes.success === false) {
                throw new Error(evRes.error || 'Failed to fetch evidence')
            }
            setEvidence(data)

            // Handle assignments response
            if (assignRes && assignRes.success) {
                setAssignments(assignRes.data || {})
            }

            // Handle user profile response
            if (profileRes && profileRes.success) {
                setUserStats(profileRes.data);
            }
        } catch (err) {
            console.error('Failed to load data:', err)
            setError(err.message || 'Failed to load data')
            setEvidence([])
        } finally {
            setLoading(false)
        }
    }

    const handleAssign = async (e, evidenceId) => {
        e.stopPropagation(); // Prevent card click
        setAssigning(evidenceId);
        try {
            await assignEvidence(evidenceId);
            // Refresh assignments only
            const res = await getAssignments();
            if (res.success) {
                setAssignments(res.data);
            }
        } catch (err) {
            console.error('Assignment failed:', err);
            alert('Failed to assign evidence');
        } finally {
            setAssigning(null);
        }
    };

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
                        {userStats.evidenceProcessed || 0}
                    </div>
                    <div style={{ color: 'var(--text-muted)' }}>Processed</div>
                </div>
                <div className="card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>
                        {userStats.evidenceAssigned || 0}
                    </div>
                    <div style={{ color: 'var(--text-muted)' }}>Assigned to You</div>
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
                ) : (() => {
                    const myEvidence = evidence.filter(item => {
                        const assignment = assignments[item?.evidenceId];
                        // Only show if assigned to this user
                        // We use name matching since populate returns name
                        return assignment?.assignedTo?.name === user?.name;
                    });

                    if (myEvidence.length === 0) {
                        return (
                            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
                                <h3>All Caught Up!</h3>
                                <p>No evidence assigned to you.</p>
                            </div>
                        );
                    }

                    return (
                        <div>
                            {myEvidence.map((item, index) => {
                                const assignment = assignments[item?.evidenceId];
                                const assignedUser = assignment?.assignedTo?.name;

                                return (
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
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--accent-primary)' }}>
                                                        {item?.evidenceId || 'Unknown ID'}
                                                    </div>
                                                    {item?.description && (
                                                        <div style={{
                                                            fontSize: '0.85rem',
                                                            color: 'var(--text-secondary)',
                                                            maxWidth: '400px',
                                                            whiteSpace: 'nowrap',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            fontStyle: 'italic'
                                                        }}>
                                                            "{item.description}"
                                                        </div>
                                                    )}
                                                </div>

                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                                    <span>Category: {item?.category || 'N/A'}</span>
                                                    <span>•</span>
                                                    <span>{item?.fileType || 'N/A'}</span>
                                                    <span>•</span>
                                                    <span>{formatFileSize(item?.fileSize)}</span>
                                                    <span>•</span>
                                                    <span style={{
                                                        color: 'var(--success)',
                                                        fontWeight: 'bold',
                                                        background: 'rgba(16, 185, 129, 0.1)',
                                                        padding: '2px 8px',
                                                        borderRadius: '12px'
                                                    }}>
                                                        👤 Assigned to Me
                                                    </span>
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right', marginLeft: '1rem' }}>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                                                    {formatDate(item?.submittedAt)}
                                                </div>
                                                <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}>
                                                    Review →
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })()}
            </div>
        </div>
    )
}

export default VerifierDashboard

