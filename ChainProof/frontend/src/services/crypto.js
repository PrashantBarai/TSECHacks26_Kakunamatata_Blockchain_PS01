/**
 * Crypto Service - Stateless Key Management
 * 
 * SECURITY: Private key is NEVER stored by the application.
 * User must save their private key themselves (like Bitcoin seed phrase).
 * On each visit, user provides their private key to access their evidence.
 */

// =============================================================================
// KEYPAIR GENERATION
// =============================================================================

/**
 * Generate a new ECDSA keypair
 * Returns the keypair - USER MUST SAVE THE PRIVATE KEY
 * We do NOT store it anywhere
 * @returns {Promise<{publicKey: Object, privateKey: Object, publicKeyHash: string}>}
 */
export async function generateKeypair() {
    // Generate ECDSA keypair
    const keypair = await window.crypto.subtle.generateKey(
        {
            name: 'ECDSA',
            namedCurve: 'P-256'
        },
        true, // extractable
        ['sign', 'verify']
    );

    // Export keys to JWK format
    const publicKeyJwk = await window.crypto.subtle.exportKey('jwk', keypair.publicKey);
    const privateKeyJwk = await window.crypto.subtle.exportKey('jwk', keypair.privateKey);

    // Create public key hash (user's anonymous ID)
    const publicKeyHash = await hashPublicKey(publicKeyJwk);

    return {
        publicKey: publicKeyJwk,
        privateKey: privateKeyJwk,
        publicKeyHash,
        createdAt: new Date().toISOString()
    };
}

/**
 * Create a downloadable backup file for the user
 * @param {Object} keypair - The generated keypair
 */
export function downloadKeypairAsFile(keypair) {
    const backup = JSON.stringify({
        privateKey: keypair.privateKey,
        publicKey: keypair.publicKey,
        publicKeyHash: keypair.publicKeyHash,
        version: 1,
        createdAt: keypair.createdAt,
        warning: 'KEEP THIS FILE SECURE - Anyone with this file can access your evidence'
    }, null, 2);

    const blob = new Blob([backup], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chainproof-key-${keypair.publicKeyHash.substring(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// =============================================================================
// KEY IMPORT & VERIFICATION
// =============================================================================

/**
 * Import a private key from user input and derive publicKeyHash
 * This is how users "login" - they provide their private key
 * @param {Object|string} privateKeyInput - JWK object or JSON string
 * @returns {Promise<{privateKey: CryptoKey, publicKey: CryptoKey, publicKeyHash: string}>}
 */
export async function importPrivateKey(privateKeyInput) {
    try {
        // Parse if string
        let privateKeyJwk = typeof privateKeyInput === 'string'
            ? JSON.parse(privateKeyInput)
            : privateKeyInput;

        // If it's a full backup file, extract just the privateKey
        if (privateKeyJwk.privateKey) {
            privateKeyJwk = privateKeyJwk.privateKey;
        }

        // Import the private key
        const privateKey = await window.crypto.subtle.importKey(
            'jwk',
            privateKeyJwk,
            { name: 'ECDSA', namedCurve: 'P-256' },
            true,
            ['sign']
        );

        // Derive the public key from private key
        const publicKeyJwk = {
            kty: privateKeyJwk.kty,
            crv: privateKeyJwk.crv,
            x: privateKeyJwk.x,
            y: privateKeyJwk.y
        };

        const publicKey = await window.crypto.subtle.importKey(
            'jwk',
            publicKeyJwk,
            { name: 'ECDSA', namedCurve: 'P-256' },
            true,
            ['verify']
        );

        // Compute publicKeyHash
        const publicKeyHash = await hashPublicKey(publicKeyJwk);

        return {
            privateKey,
            publicKey,
            publicKeyJwk,
            privateKeyJwk,
            publicKeyHash
        };
    } catch (error) {
        throw new Error(`Invalid private key: ${error.message}`);
    }
}

/**
 * Import from a backup file (drops the private key file)
 * @param {File} file - The backup JSON file
 * @returns {Promise<Object>} Imported key data
 */
export async function importFromBackupFile(file) {
    const text = await file.text();
    return await importPrivateKey(text);
}

// =============================================================================
// SIGNING
// =============================================================================

/**
 * Sign data with a private key
 * @param {CryptoKey} privateKey - The imported private key
 * @param {string} data - Data to sign
 * @returns {Promise<string>} Base64-encoded signature
 */
export async function signData(privateKey, data) {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    const signature = await window.crypto.subtle.sign(
        {
            name: 'ECDSA',
            hash: { name: 'SHA-256' }
        },
        privateKey,
        dataBuffer
    );

    return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

// =============================================================================
// HASHING
// =============================================================================

/**
 * Hash a public key to create the anonymous user ID
 * @param {Object} publicKeyJwk 
 * @returns {Promise<string>} Hex-encoded hash
 */
async function hashPublicKey(publicKeyJwk) {
    const publicKeyString = JSON.stringify(publicKeyJwk);
    return await sha256(publicKeyString);
}

/**
 * Compute SHA-256 hash of a string
 * @param {string} data 
 * @returns {Promise<string>} Hex-encoded hash
 */
export async function sha256(data) {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Compute SHA-256 hash of a file
 * @param {File} file 
 * @returns {Promise<string>} Hex-encoded hash
 */
export async function hashFile(file) {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// =============================================================================
// SESSION STATE (in-memory only, cleared on tab close)
// =============================================================================

let sessionKey = null;

/**
 * Store key in memory for current session only
 * Cleared when tab closes
 */
export function setSessionKey(keyData) {
    sessionKey = keyData;
}

/**
 * Get current session key
 */
export function getSessionKey() {
    return sessionKey;
}

/**
 * Clear session key
 */
export function clearSessionKey() {
    sessionKey = null;
}

/**
 * Check if user has provided their key this session
 */
export function hasSessionKey() {
    return sessionKey !== null;
}

export default {
    // Generation
    generateKeypair,
    downloadKeypairAsFile,
    // Import
    importPrivateKey,
    importFromBackupFile,
    // Signing
    signData,
    // Hashing
    sha256,
    hashFile,
    // Session (memory only)
    setSessionKey,
    getSessionKey,
    clearSessionKey,
    hasSessionKey
};
