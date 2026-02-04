import { useState } from 'react'
import { verifyIntegrity, getEvidence } from '../../services/api'
import { sha256 } from '../../services/crypto'

function Verify({ evidenceData, setPage }) {
    const [evidence, setEvidence] = useState(evidenceData)
    const [computedHash, setComputedHash] = useState('')
    const [hashMatch, setHashMatch] = useState(null)
    const [note, setNote] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [result, setResult] = useState(null)
    const [error, setError] = useState(null)

    const handleFileVerify = async (e) => {
        const file = e.target.files[0]
        if (!file) return

        try {
            // Compute hash of uploaded file
            const buffer = await file.arrayBuffer()
            const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
            const hashArray = Array.from(new Uint8Array(hashBuffer))
            const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

            setComputedHash(hash)
            setHashMatch(hash === evidence.fileHash)
        } catch (err) {
            setError(err.message)
        }
    }

    const handleVerification = async (passed) => {
        setSubmitting(true)
        setError(null)

        try {
            const response = await verifyIntegrity(
                evidence.evidenceId,
                computedHash || evidence.fileHash,
                passed,
                passed ? '' : note
            )
            setResult({
                passed,
                response: response.data
            })
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
                    {result.passed ? '✅ Evidence Verified' : '❌ Evidence Rejected'}
                </h1>
                <div className="card">
                    <p>Evidence ID: <strong>{evidence.evidenceId}</strong></p>
                    <p>Status updated on blockchain.</p>
                    <button className="btn btn-primary" onClick={() => setPage({ name: 'verifier-dashboard' })}>
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
                onClick={() => setPage({ name: 'verifier-dashboard' })}
                style={{ marginBottom: '1rem' }}
            >
                ← Back to Queue
            </button>

            <h1 className="page-title">🔍 Verify Evidence</h1>
            <p className="page-subtitle">
                Review evidence details and verify file integrity.
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
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>File Type</div>
                        <div>{evidence.fileType}</div>
                    </div>
                    <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>File Size</div>
                        <div>{(evidence.fileSize / 1024).toFixed(2)} KB</div>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>IPFS CID</div>
                        <div style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{evidence.ipfsCid}</div>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Stored File Hash</div>
                        <div style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{evidence.fileHash}</div>
                    </div>
                </div>
            </div>

            {/* Hash Verification */}
            <div className="card">
                <h3 className="card-title">🔐 Hash Verification</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    Download the file from IPFS and upload here to verify integrity.
                </p>

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                    <a
                        href={`https://gateway.pinata.cloud/ipfs/${evidence.ipfsCid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary"
                    >
                        📥 Download from IPFS
                    </a>
                    <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
                        📤 Upload to Verify
                        <input type="file" style={{ display: 'none' }} onChange={handleFileVerify} />
                    </label>
                </div>

                {computedHash && (
                    <div style={{
                        background: hashMatch ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        border: `1px solid ${hashMatch ? 'var(--success)' : 'var(--error)'}`,
                        borderRadius: '8px',
                        padding: '1rem',
                        marginTop: '1rem'
                    }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                            {hashMatch ? '✅ Hash Match!' : '❌ Hash Mismatch!'}
                        </div>
                        <div style={{ fontSize: '0.85rem' }}>
                            <div>Computed: <code>{computedHash.substring(0, 32)}...</code></div>
                            <div>Stored: <code>{evidence.fileHash.substring(0, 32)}...</code></div>
                        </div>
                    </div>
                )}
            </div>

            {/* Verification Actions */}
            <div className="card">
                <h3 className="card-title">✍️ Verification Decision</h3>

                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                        Notes (required for rejection)
                    </label>
                    <textarea
                        className="form-input"
                        rows={3}
                        placeholder="Add verification notes..."
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        style={{ width: '100%', resize: 'vertical' }}
                    />
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        className="btn btn-primary"
                        onClick={() => handleVerification(true)}
                        disabled={submitting}
                        style={{ flex: 1, background: 'var(--success)' }}
                    >
                        {submitting ? 'Processing...' : '✅ Approve - Verified'}
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={() => handleVerification(false)}
                        disabled={submitting || !note.trim()}
                        style={{ flex: 1, background: 'var(--error)', borderColor: 'var(--error)' }}
                    >
                        {submitting ? 'Processing...' : '❌ Reject'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default Verify
