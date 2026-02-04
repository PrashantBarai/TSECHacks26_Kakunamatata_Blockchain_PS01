/**
 * Cryptographic Utilities
 * 
 * Signature verification for pseudonymous identity
 */

import { createVerify } from 'crypto';

/**
 * Verify a signature against a public key
 * @param {string} data - Data that was signed
 * @param {string} signature - Base64-encoded signature
 * @param {string} publicKey - PEM-encoded public key
 * @returns {boolean}
 */
export function verifySignature(data, signature, publicKey) {
    try {
        const verify = createVerify('SHA256');
        verify.update(data);
        verify.end();

        return verify.verify(publicKey, signature, 'base64');
    } catch (error) {
        console.error('Signature verification error:', error);
        return false;
    }
}

/**
 * Generate a public key hash from PEM-encoded key
 * @param {string} publicKey - PEM-encoded public key
 * @returns {string} SHA256 hash of the public key
 */
export function publicKeyToHash(publicKey) {
    const { sha256String } = require('./hash.js');

    // Remove PEM headers and whitespace
    const cleanKey = publicKey
        .replace(/-----BEGIN.*-----/, '')
        .replace(/-----END.*-----/, '')
        .replace(/\s/g, '');

    return sha256String(cleanKey);
}

export default {
    verifySignature,
    publicKeyToHash
};
