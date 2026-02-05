import { useState } from 'react'
import { verifyIntegrity, getEvidence, assignLegalRole } from '../../services/api'
import { sha256 } from '../../services/crypto'

function Verify({ evidenceData, setPage }) {
    const [evidence, setEvidence] = useState(evidenceData)
    const [computedHash, setComputedHash] = useState('')
    const [hashMatch, setHashMatch] = useState(null)
    const [note, setNote] = useState('')
    const [targetLegalRole, setTargetLegalRole] = useState('Judge')
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

            // If approved, forward to Legal Role
            if (passed) {
                await assignLegalRole(evidence.evidenceId, targetLegalRole);
            }

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
                    <div style={{ gridColumn: '1 / -1' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Description</div>
                        <div style={{ fontStyle: 'italic', background: 'rgba(0,0,0,0.1)', padding: '0.5rem', borderRadius: '4px' }}>
                            {evidence.description || 'No description provided.'}
                        </div>
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
                    Click below to automatically fetch the evidence from IPFS and verify its integrity against the blockchain record.
                </p>

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center' }}>
                    <button
                        className="btn btn-primary"
                        onClick={async () => {
                            setSubmitting(true);
                            setError(null);
                            try {
                                // Fetch from Backend Proxy (avoids CORS)
                                const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
                                const response = await fetch(`${BACKEND_URL}/api/evidence/proxy/${evidence.ipfsCid}`);

                                if (!response.ok) throw new Error('Failed to fetch from IPFS via proxy');

                                const buffer = await response.arrayBuffer();
                                const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
                                const hashArray = Array.from(new Uint8Array(hashBuffer));
                                const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

                                setComputedHash(hash);
                                setHashMatch(hash === evidence.fileHash);
                            } catch (err) {
                                setError('Verification failed: ' + err.message);
                            } finally {
                                setSubmitting(false);
                            }
                        }}
                        disabled={submitting || hashMatch !== null}
                    >
                        {submitting ? 'Verifying...' : '⚡ Validate Integrity'}
                    </button>

                    {/* View File Link */}
                    <a
                        href={`https://gateway.pinata.cloud/ipfs/${evidence.ipfsCid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--accent-primary)', textDecoration: 'none', marginLeft: 'auto' }}
                    >
                        View File ↗
                    </a>
                </div>

                {computedHash && (
                    <div style={{
                        background: hashMatch ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        border: `1px solid ${hashMatch ? 'var(--success)' : 'var(--error)'}`,
                        borderRadius: '8px',
                        padding: '1rem',
                        marginTop: '1rem'
                    }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '1.2rem' }}>{hashMatch ? '✅' : '❌'}</span>
                            {hashMatch ? 'INTEGRITY VERIFIED' : 'INTEGRITY CHECK FAILED'}
                        </div>
                        <div style={{ fontSize: '0.85rem' }}>
                            <div>Computed: <code>{computedHash}</code></div>
                            <div style={{ marginTop: '0.25rem' }}>Stored: <code>{evidence.fileHash}</code></div>
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

                {hashMatch === true && (
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                            Forward to Legal Role
                        </label>
                        <select
                            value={targetLegalRole}
                            onChange={(e) => setTargetLegalRole(e.target.value)}
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
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                            Approved evidence will be forwarded to this role in the Legal Organization.
                        </p>
                    </div>
                )}

                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        className="btn btn-primary"
                        onClick={() => handleVerification(true)}
                        disabled={submitting || hashMatch !== true}
                        style={{
                            flex: 1,
                            background: 'var(--success)',
                            opacity: hashMatch === true ? 1 : 0.5,
                            cursor: hashMatch === true ? 'pointer' : 'not-allowed'
                        }}
                    >
                        {submitting ? 'Processing...' : '✅ Approve - Verified'}
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={() => handleVerification(false)}
                        disabled={submitting || !note.trim() || hashMatch !== false}
                        style={{
                            flex: 1,
                            background: 'var(--error)',
                            borderColor: 'var(--error)',
                            opacity: (hashMatch === false) ? 1 : 0.5,
                            cursor: (hashMatch === false) ? 'pointer' : 'not-allowed'
                        }}
                    >
                        {submitting ? 'Processing...' : '❌ Reject'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default Verify
