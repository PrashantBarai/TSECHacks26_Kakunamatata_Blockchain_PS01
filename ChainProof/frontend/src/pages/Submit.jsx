import { useState, useRef } from 'react'
import { signData, hashFile, hasSessionKey, getSessionKey } from '../services/crypto'
import { submitEvidenceFull } from '../services/api'

function Submit() {
    const [file, setFile] = useState(null)
    const [category, setCategory] = useState('')
    const [description, setDescription] = useState('')
    const [dragging, setDragging] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [result, setResult] = useState(null)
    const [error, setError] = useState(null)
    const fileInputRef = useRef()

    const handleDrop = (e) => {
        e.preventDefault()
        setDragging(false)
        const droppedFile = e.dataTransfer.files[0]
        if (droppedFile) {
            setFile(droppedFile)
        }
    }

    const handleFileSelect = (e) => {
        const selectedFile = e.target.files[0]
        if (selectedFile) {
            setFile(selectedFile)
        }
    }

    const handleSubmit = async () => {
        if (!file) return
        if (!category) {
            setError('Please select a category')
            return
        }

        // Check if user has provided their key this session
        if (!hasSessionKey()) {
            setError('Please provide your private key first (go to Home page)')
            return
        }

        const sessionKey = getSessionKey()

        setSubmitting(true)
        setError(null)
        setResult(null)

        try {
            // Hash the file
            const fileHash = await hashFile(file)

            // Sign the hash with session key
            const signature = await signData(sessionKey.privateKey, fileHash)

            // Prepare form data
            const formData = new FormData()
            formData.append('file', file)
            formData.append('category', category || 'other')
            formData.append('description', description)
            formData.append('publicKeyHash', sessionKey.publicKeyHash)
            formData.append('signature', signature)

            // Submit to backend + blockchain
            const response = await submitEvidenceFull(formData)
            setResult(response.data)

        } catch (err) {
            console.error('Submission error:', err)
            setError(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    const reset = () => {
        setFile(null)
        setCategory('')
        setDescription('')
        setResult(null)
        setError(null)
    }

    // Check if user has session key
    const hasKey = hasSessionKey()

    if (result) {
        return (
            <div className="page">
                <h1 className="page-title">✅ Evidence Submitted</h1>
                <p className="page-subtitle">Your evidence has been securely processed.</p>

                <div className="card">
                    <h3 className="card-title">📋 Submission Details</h3>

                    <div style={{ marginBottom: '1rem' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Evidence ID</div>
                        <div style={{
                            fontFamily: 'monospace',
                            fontSize: '1.25rem',
                            color: 'var(--accent-primary)',
                            fontWeight: 'bold'
                        }}>
                            {result.evidenceId}
                        </div>
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '1rem',
                        marginBottom: '1.5rem'
                    }}>
                        <div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>IPFS CID</div>
                            <div style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{result.ipfsCid}</div>
                        </div>
                        <div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>File Hash</div>
                            <div style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{result.fileHash?.substring(0, 32)}...</div>
                        </div>
                    </div>

                    {result.metadataStripped && (
                        <div style={{
                            background: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid var(--success)',
                            borderRadius: '8px',
                            padding: '0.75rem',
                            marginBottom: '1rem'
                        }}>
                            <strong>🛡️ Metadata Stripped:</strong> Identifying information was removed from your file
                            ({result.removedMetadata?.join(', ') || 'various fields'})
                        </div>
                    )}

                    {result.sepoliaAnchor && (
                        <div style={{
                            background: 'rgba(99, 102, 241, 0.1)',
                            border: '1px solid var(--accent-primary)',
                            borderRadius: '8px',
                            padding: '0.75rem',
                            marginBottom: '1rem'
                        }}>
                            <strong>⛓️ Blockchain Anchor:</strong>{' '}
                            <a
                                href={result.sepoliaAnchor.explorerUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: 'var(--accent-secondary)' }}
                            >
                                View on Sepolia →
                            </a>
                        </div>
                    )}

                    <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>
                        {result.message || 'Evidence securely recorded.'}
                    </p>
                </div>

                <button className="btn btn-primary" onClick={reset}>
                    Submit Another
                </button>
            </div>
        )
    }

    return (
        <div className="page">
            <h1 className="page-title">Submit Evidence</h1>
            <p className="page-subtitle">
                Upload files securely. Metadata will be automatically stripped.
            </p>

            {!hasKey && (
                <div style={{
                    background: 'rgba(251, 191, 36, 0.1)',
                    border: '1px solid var(--warning)',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '1.5rem',
                    color: 'var(--warning)'
                }}>
                    <strong>⚠️ No Key Loaded:</strong> Please go to the Home page and provide your private key first.
                </div>
            )}

            {error && (
                <div style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid var(--error)',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '1.5rem',
                    color: 'var(--error)'
                }}>
                    <strong>Error:</strong> {error}
                </div>
            )}

            <div className="card">
                <h3 className="card-title">📎 File Upload</h3>

                <div
                    className={`file-upload ${dragging ? 'dragging' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        style={{ display: 'none' }}
                        onChange={handleFileSelect}
                    />

                    {file ? (
                        <>
                            <div className="file-upload-icon">📄</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: '500' }}>{file.name}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="file-upload-icon">📤</div>
                            <p className="file-upload-text">
                                <strong>Drop file here</strong> or click to browse
                            </p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                Images, videos, documents up to 100MB
                            </p>
                        </>
                    )}
                </div>
            </div>

            <div className="card">
                <h3 className="card-title">🏷️ Category</h3>
                <select
                    className="form-select"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                >
                    <option value="">Select category...</option>
                    <option value="corruption">Corruption</option>
                    <option value="financial_fraud">Financial Fraud</option>
                    <option value="abuse">Abuse</option>
                    <option value="harassment">Harassment</option>
                    <option value="environmental">Environmental</option>
                    <option value="safety">Safety Violation</option>
                    <option value="other">Other</option>
                </select>
            </div>

            <div className="card">
                <h3 className="card-title">📝 Description (Optional)</h3>
                <textarea
                    className="form-input"
                    rows={4}
                    placeholder="Provide additional context about the evidence (optional)..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    style={{ width: '100%', resize: 'vertical' }}
                />
            </div>

            <div className="card" style={{ background: 'var(--bg-secondary)' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    🔒 <strong>Privacy Notice:</strong> Your file will be processed to remove
                    GPS coordinates, camera info, author metadata, and other identifying information.
                    Only the content-hash will be stored on the blockchain.
                </p>
            </div>

            <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={!file || !category || submitting || !hasKey}
                style={{ marginTop: '1rem' }}
            >
                {submitting ? (
                    <>
                        <span className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }}></span>
                        Processing...
                    </>
                ) : (
                    '🚀 Submit Securely'
                )}
            </button>
        </div>
    )
}

export default Submit
