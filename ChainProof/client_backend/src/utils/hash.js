/**
 * Hash Utility Functions
 */

import { createHash } from 'crypto';

/**
 * Compute SHA256 hash of a buffer
 * @param {Buffer} buffer - Data to hash
 * @returns {string} Hex-encoded hash
 */
export function sha256(buffer) {
    return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Compute SHA256 hash of a string
 * @param {string} str - String to hash
 * @returns {string} Hex-encoded hash
 */
export function sha256String(str) {
    return createHash('sha256').update(str, 'utf8').digest('hex');
}

/**
 * Verify two hashes match (case-insensitive)
 * @param {string} hash1 
 * @param {string} hash2 
 * @returns {boolean}
 */
export function hashesMatch(hash1, hash2) {
    if (!hash1 || !hash2) return false;
    return hash1.toLowerCase() === hash2.toLowerCase();
}

export default {
    sha256,
    sha256String,
    hashesMatch
};
