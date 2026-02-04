import { useState } from 'react'
import { reviewEvidence, addLegalComment, exportEvidence, getEvidenceHistory } from '../../services/api'

function LegalReview({ evidenceData, setPage }) {
    const [evidence, setEvidence] = useState(evidenceData)
    const [comment, setComment] = useState('')
    const [recommendation, setRecommendation] = useState('proceed')
    const [submitting, setSubmitting] = useState(false)
    const [result, setResult] = useState(null)
    const [error, setError] = useState(null)
    const [history, setHistory] = useState(null)

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
            await reviewEvidence(evidence.evidenceId, true)
            setResult({ complete: true })
        } catch (err) {
            setError(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    const handleExport = async () => {
        setSubmitting(true)
        try {
            const res = await exportEvidence(evidence.evidenceId)
            // Trigger PDF download
            window.open(`http://localhost:4000/api/evidence/${evidence.evidenceId}/report`, '_blank')
            setResult({ exported: true })
        } catch (err) {
            setError(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    if (result) {
        return (
            <div className="page">
                <h1 className="page-title">
                    {result.exported ? '📄 Report Exported' : '✅ Review Complete'}
                </h1>
                <div className="card">
                    <p>Evidence ID: <strong>{evidence.evidenceId}</strong></p>
                    <p>{result.exported ? 'PDF report has been generated.' : 'Evidence marked as reviewed.'}</p>
                    <button className="btn btn-primary" onClick={() => setPage({ name: 'legal-dashboard' })}>
                        ← Back to Dashboard
                    </button>
                </div>
            </div>
        )
    }

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

                <button className="btn btn-secondary" onClick={loadHistory} style={{ marginTop: '1rem' }}>
                    📜 Load Chain of Custody
                </button>

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
                        disabled={submitting}
                        style={{ flex: 1, background: 'var(--accent-secondary)', borderColor: 'var(--accent-secondary)' }}
                    >
                        📄 Export Court Report
                    </button>
                </div>
            </div>
        </div>
    )
}

export default LegalReview
