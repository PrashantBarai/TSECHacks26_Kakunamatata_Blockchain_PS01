import { useState, useRef } from 'react'
import {
    generateKeypair,
    downloadKeypairAsFile,
    importPrivateKey,
    importFromBackupFile,
    setSessionKey,
    getSessionKey,
    hasSessionKey
} from '../services/crypto'

function Home({ setPage }) {
    const [keyState, setKeyState] = useState(hasSessionKey() ? 'loaded' : 'none') // none, loaded
    const [publicKeyHash, setPublicKeyHash] = useState(getSessionKey()?.publicKeyHash || '')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const fileInputRef = useRef()

    // Generate new keypair
    const handleGenerate = async () => {
        setLoading(true)
        setError('')
        try {
            const keypair = await generateKeypair()

            // Trigger download IMMEDIATELY
            downloadKeypairAsFile(keypair)

            // Import into session
            const imported = await importPrivateKey(keypair.privateKey)
            setSessionKey(imported)

            setPublicKeyHash(imported.publicKeyHash)
            setKeyState('loaded')
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    // Import from file
    const handleFileImport = async (e) => {
        const file = e.target.files[0]
        if (!file) return

        setLoading(true)
        setError('')
        try {
            const imported = await importFromBackupFile(file)
            setSessionKey(imported)
            setPublicKeyHash(imported.publicKeyHash)
            setKeyState('loaded')
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="page">
            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                <h1 className="page-title">Secure Disclosure Network</h1>
                <p className="page-subtitle">
                    Submit evidence anonymously. Verified cryptographically. Defensible in court.
                </p>
            </div>

            {/* Key Management */}
            <div className="card" style={{ marginBottom: '2rem' }}>
                <h3 className="card-title">🔑 Your Anonymous Identity</h3>

                {keyState === 'none' ? (
                    <>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                            To submit and track evidence, you need a cryptographic keypair.
                            <br />
                            <strong>⚠️ You must save your key file - we do NOT store it!</strong>
                        </p>

                        {error && (
                            <div style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid var(--error)',
                                borderRadius: '8px',
                                padding: '0.75rem',
                                marginBottom: '1rem',
                                color: 'var(--error)'
                            }}>
                                {error}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            <button
                                className="btn btn-primary"
                                onClick={handleGenerate}
                                disabled={loading}
                            >
                                {loading ? 'Generating...' : '🆕 Generate New Key'}
                            </button>

                            <button
                                className="btn btn-secondary"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={loading}
                            >
                                📂 Import Existing Key
                            </button>

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".json"
                                style={{ display: 'none' }}
                                onChange={handleFileImport}
                            />
                        </div>
                    </>
                ) : (
                    <>
                        <div style={{
                            background: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid var(--success)',
                            borderRadius: '8px',
                            padding: '1rem',
                            marginBottom: '1rem'
                        }}>
                            <strong style={{ color: 'var(--success)' }}>✓ Key Loaded for This Session</strong>
                        </div>

                        <div style={{
                            background: 'var(--bg-secondary)',
                            padding: '1rem',
                            borderRadius: '8px',
                            fontFamily: 'monospace',
                            wordBreak: 'break-all',
                            marginBottom: '1rem'
                        }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Public Key Hash:</div>
                            <div style={{ color: 'var(--accent-secondary)' }}>{publicKeyHash}</div>
                        </div>

                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            ⚠️ This key is only in memory. It will be gone when you close this tab.
                            Make sure you have your backup file saved!
                        </p>

                        <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
                            <button className="btn btn-primary" onClick={() => setPage('submit')}>
                                🛡️ Submit Evidence
                            </button>
                            <button className="btn btn-secondary" onClick={() => setPage('track')}>
                                📊 Track Status
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Features */}
            <div className="feature-grid">
                <div className="card feature-card">
                    <div className="feature-icon">🔒</div>
                    <h3 className="feature-title">Absolute Anonymity</h3>
                    <p className="feature-desc">
                        Your identity is protected by cryptographic keypairs. No accounts, no emails,
                        no IP logging. Tor-compatible by design.
                    </p>
                </div>

                <div className="card feature-card">
                    <div className="feature-icon">⛓️</div>
                    <h3 className="feature-title">Immutable Records</h3>
                    <p className="feature-desc">
                        Evidence is timestamped on Hyperledger Fabric and anchored to public blockchain.
                        Cannot be altered or deleted.
                    </p>
                </div>

                <div className="card feature-card">
                    <div className="feature-icon">⚖️</div>
                    <h3 className="feature-title">Court-Ready</h3>
                    <p className="feature-desc">
                        Complete chain of custody. Cryptographic proofs. Professional audit reports
                        accepted by legal authorities.
                    </p>
                </div>

                <div className="card feature-card">
                    <div className="feature-icon">🔓</div>
                    <h3 className="feature-title">Metadata Stripped</h3>
                    <p className="feature-desc">
                        GPS, EXIF, author info automatically removed from files before storage.
                        Your device leaves no trace.
                    </p>
                </div>

                <div className="card feature-card">
                    <div className="feature-icon">🌐</div>
                    <h3 className="feature-title">Decentralized Storage</h3>
                    <p className="feature-desc">
                        Files stored on IPFS. No single point of failure. Content-addressable
                        and globally accessible.
                    </p>
                </div>

                <div className="card feature-card">
                    <div className="feature-icon">📊</div>
                    <h3 className="feature-title">Reputation System</h3>
                    <p className="feature-desc">
                        Build credibility through verified submissions without revealing identity.
                        Trust score visible to reviewers.
                    </p>
                </div>
            </div>
        </div>
    )
}

export default Home
