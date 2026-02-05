import { useState } from 'react'
import { reviewEvidence, addLegalComment, exportEvidence, getEvidenceHistory, getEvidence, fetchFileBlob, computeHash } from '../../services/api'

function LegalReview({ evidenceData, setPage }) {
    const [evidence, setEvidence] = useState(evidenceData)
    const [comment, setComment] = useState('')
    const [recommendation, setRecommendation] = useState('proceed')
    const [submitting, setSubmitting] = useState(false)
    const [result, setResult] = useState(null)
    const [error, setError] = useState(null)
    const [history, setHistory] = useState(null)
    const [integrityStatus, setIntegrityStatus] = useState(null) // 'loading', 'match', 'mismatch'
    const [auditLog, setAuditLog] = useState([])
    const [verdict, setVerdict] = useState('TRUE')

    const refreshEvidence = async () => {
        try {
            const res = await getEvidence(evidence.evidenceId)
            const freshData = res.data || res; // Handle different API wrapper formats
            setEvidence(freshData)
            return freshData
        } catch (err) {
            console.error('Refresh failed:', err)
        }
    }

    const loadHistory = async () => {
        try {
            const res = await getEvidenceHistory(evidence.evidenceId)
            setHistory(res.data)
        } catch (err) {
            setError(err.message)
        }
    }

    const handleAddComment = async () => {
        if (!comment.trim()) return

        setSubmitting(true)
        try {
            const commentId = `CMT-${Date.now()}`
            await addLegalComment(
                evidence.evidenceId,
                commentId,
                comment,
                recommendation === 'court-ready' ? 'HIGH' : 'MEDIUM',
                recommendation
            )
            setComment('')
            await refreshEvidence()
            alert('Comment added successfully')
        } catch (err) {
            setError(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    const handleMarkComplete = async () => {
        setSubmitting(true)
        setError(null)

        try {
            await reviewEvidence(evidence.evidenceId, true, verdict)
            await refreshEvidence()
            setResult({ complete: true })
            alert(`Review complete! Verdict: ${verdict}. Whistleblower reputation updated.`)
        } catch (err) {
            setError(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    const handleExport = async () => {
        setSubmitting(true)
        setError(null)
        try {
            await exportEvidence(evidence.evidenceId)
            // Trigger PDF download from backend
            window.open(`http://localhost:4000/api/legal/report/${evidence.evidenceId}`, '_blank')
            await refreshEvidence()
            alert('Court report generated and downloaded.')
        } catch (err) {
            setError(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    const handleViewAndVerify = async () => {
        setIntegrityStatus('loading')
        setError(null)
        try {
            // 1. Fetch file as blob
            const blob = await fetchFileBlob(evidence.ipfsCid)

            // 2. Compute local hash
            const computedHash = await computeHash(blob)

            // 3. Compare with blockchain hash
            const isMatch = computedHash === evidence.fileHash
            setIntegrityStatus(isMatch ? 'match' : 'mismatch')

            if (isMatch) {
                // Open file in new tab
                const url = URL.createObjectURL(blob)
                window.open(url, '_blank')
            } else {
                setError(`INTEGRITY BREACH: Local file hash (${computedHash.substring(0, 16)}) does not match blockchain record (${evidence.fileHash.substring(0, 16)})!`)
            }
        } catch (err) {
            setError('Failed to verify integrity: ' + err.message)
            setIntegrityStatus(null)
        }
    }

    // Persistent View: We no longer hide the details after completion
    // if (result) { ... }

    return (
        <div className="page">
            <button
                className="btn btn-secondary"
                onClick={() => setPage({ name: 'legal-dashboard' })}
                style={{ marginBottom: '1rem' }}
            >
                ← Back to Dashboard
            </button>

            <h1 className="page-title">⚖️ Legal Review</h1>
            <p className="page-subtitle">
                Review evidence details and prepare court documentation.
            </p>

            {error && (
                <div style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid var(--error)',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '1.5rem',
                    color: 'var(--error)'
                }}>
                    {error}
                </div>
            )}

            {!evidence.publicKeyHash && (
                <div style={{
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid #f59e0b',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '1.5rem',
                    color: '#f59e0b'
                }}>
                    ⚠️ <strong>Legacy Data Warning:</strong> This evidence record does not contain a Public Key Hash. Reputation changes cannot be applied to this record.
                </div>
            )}

            {/* Evidence Details */}
            <div className="card">
                <h3 className="card-title">📋 Evidence Details</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                    <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Evidence ID</div>
                        <div style={{ fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{evidence.evidenceId}</div>
                    </div>
                    <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Category</div>
                        <div>{evidence.category}</div>
                    </div>
                    <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Status</div>
                        <span style={{
                            background: 'rgba(16, 185, 129, 0.2)',
                            color: 'var(--success)',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.8rem'
                        }}>
                            {evidence.status}
                        </span>
                    </div>
                    <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Submitted</div>
                        <div>{new Date(evidence.submittedAt * 1000).toLocaleString()}</div>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>File Hash (SHA-256)</div>
                        <div style={{ fontFamily: 'monospace', wordBreak: 'break-all', fontSize: '0.9rem' }}>{evidence.fileHash}</div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                    <button
                        className="btn btn-primary"
                        onClick={handleViewAndVerify}
                        disabled={integrityStatus === 'loading'}
                        style={{ flex: 1 }}
                    >
                        {integrityStatus === 'loading' ? '⏳ Verifying Hash...' : '👁️ View & Verify Integrity'}
                    </button>
                    <button className="btn btn-secondary" onClick={loadHistory} style={{ flex: 1 }}>
                        📜 Chain of Custody
                    </button>
                </div>

                {integrityStatus && (
                    <div style={{
                        marginTop: '1rem',
                        padding: '1rem',
                        borderRadius: '8px',
                        background: integrityStatus === 'match' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        border: `1px solid ${integrityStatus === 'match' ? 'var(--success)' : 'var(--error)'}`,
                        color: integrityStatus === 'match' ? 'var(--success)' : 'var(--error)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        <span>{integrityStatus === 'match' ? '✅ Integrity Verified: Hashes Match' : '❌ INTEGRITY ERROR: Hashes Mismatch'}</span>
                    </div>
                )}

                {history && (
                    <div style={{ marginTop: '1rem', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px' }}>
                        <strong>Chain of Custody:</strong>
                        <pre style={{ fontSize: '0.8rem', overflow: 'auto' }}>
                            {JSON.stringify(history, null, 2)}
                        </pre>
                    </div>
                )}
            </div>

            {/* Add Comment */}
            <div className="card">
                <h3 className="card-title">📝 Legal Comments</h3>

                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                        Recommendation
                    </label>
                    <select
                        className="form-select"
                        value={recommendation}
                        onChange={(e) => setRecommendation(e.target.value)}
                    >
                        <option value="proceed">Proceed with Case</option>
                        <option value="court-ready">Mark Court-Ready</option>
                        <option value="needs-more">Needs More Evidence</option>
                        <option value="insufficient">Insufficient for Court</option>
                    </select>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                        Comment
                    </label>
                    <textarea
                        className="form-input"
                        rows={3}
                        placeholder="Add legal notes or observations..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        style={{ width: '100%', resize: 'vertical' }}
                    />
                </div>

                <button
                    className="btn btn-secondary"
                    onClick={handleAddComment}
                    disabled={submitting || !comment.trim()}
                >
                    💬 Add Comment
                </button>
            </div>

            {/* Actions */}
            <div className="card">
                <h3 className="card-title">🎯 Actions</h3>

                <div style={{
                    marginBottom: '1.5rem',
                    padding: '1rem',
                    background: 'var(--bg-secondary)',
                    borderRadius: '8px',
                    borderLeft: `4px solid ${verdict === 'TRUE' ? 'var(--success)' : verdict === 'FALSE' ? 'var(--error)' : 'var(--text-muted)'}`
                }}>
                    <label style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                        ⚖️ Final Legal Verdict (Impacts Reputation)
                    </label>
                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input
                                type="radio"
                                name="verdict"
                                value="TRUE"
                                checked={verdict === 'TRUE'}
                                onChange={() => setVerdict('TRUE')}
                            />
                            <span style={{ color: 'var(--success)', fontWeight: '500' }}>True Evidence (+3)</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input
                                type="radio"
                                name="verdict"
                                value="FALSE"
                                checked={verdict === 'FALSE'}
                                onChange={() => setVerdict('FALSE')}
                            />
                            <span style={{ color: 'var(--error)', fontWeight: '500' }}>False/Malicious (-3)</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input
                                type="radio"
                                name="verdict"
                                value="STAY"
                                checked={verdict === 'STAY'}
                                onChange={() => setVerdict('STAY')}
                            />
                            <span style={{ color: 'var(--text-secondary)' }}>Stay (No impact)</span>
                        </label>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <button
                        className="btn btn-primary"
                        onClick={handleMarkComplete}
                        disabled={submitting}
                        style={{ flex: 1 }}
                    >
                        ✅ Mark Review Complete
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={handleExport}
                        disabled={submitting || (evidence.status !== 'REVIEWED' && evidence.status !== 'EXPORTED')}
                        style={{
                            flex: 1,
                            background: (evidence.status === 'REVIEWED' || evidence.status === 'EXPORTED') ? 'var(--accent-secondary)' : 'var(--bg-secondary)',
                            borderColor: 'var(--accent-secondary)',
                            opacity: (evidence.status === 'REVIEWED' || evidence.status === 'EXPORTED') ? 1 : 0.5
                        }}
                        title={evidence.status !== 'REVIEWED' ? "Must mark review as complete before exporting" : ""}
                    >
                        📄 Export Court Report
                    </button>
                </div>
            </div>
        </div>
    )
}

export default LegalReview
