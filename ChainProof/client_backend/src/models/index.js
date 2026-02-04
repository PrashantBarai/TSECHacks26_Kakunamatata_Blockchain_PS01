/**
 * MongoDB Models for ChainProof - Privacy-Preserving Design
 * 
 * Design Philosophy (Bitcoin-like):
 * - publicKeyHash is pseudonymous (like Bitcoin address)
 * - Evidence content is NEVER stored, only hashes
 * - Logs use random IDs, NO correlation to publicKeyHash
 * - No way to trace back to real identity
 */

import mongoose from 'mongoose';
import crypto from 'crypto';

// =============================================================================
// HELPER: Generate random anonymous ID
// =============================================================================
function generateAnonymousId() {
    return crypto.randomBytes(16).toString('hex');
}

// =============================================================================
// EVIDENCE ANCHOR MODEL
// =============================================================================
// Only stores cryptographic proofs, NO content, NO metadata that could identify
const evidenceAnchorSchema = new mongoose.Schema({
    // Evidence identifier (random, not linked to user)
    evidenceId: { type: String, required: true, unique: true, index: true },

    // ONLY HASHES - never actual content
    fileHash: { type: String, required: true, index: true }, // SHA256 of file
    ipfsCidHash: { type: String, required: true }, // SHA256(IPFS CID) - not the CID itself!

    // Public blockchain anchor (verifiable)
    sepoliaTxHash: { type: String },
    sepoliaBlockNumber: { type: Number },
    anchoredAt: { type: Date },

    // Status (public, no privacy concern)
    status: {
        type: String,
        enum: ['ANCHORED', 'PENDING', 'FAILED'],
        default: 'PENDING'
    },

    // Timestamps (public)
    createdAt: { type: Date, default: Date.now }
});

// NO indexes that could correlate submissions!
// Only fileHash index for verification lookups

export const EvidenceAnchor = mongoose.model('EvidenceAnchor', evidenceAnchorSchema);

// =============================================================================
// USER LOOKUP TABLE - Privacy-Safe Key Recovery (Bitcoin-like)
// =============================================================================
// Allows users to recover their evidence using their private key
// 
// HOW IT WORKS:
// 1. User has privateKey → derives publicKey → derives publicKeyHash
// 2. We store: hash(publicKeyHash + PEPPER) as lookupKey
// 3. lookupKey maps to array of hash(evidenceId) - not raw evidenceIds!
// 4. When user wants to recover:
//    - They provide their publicKeyHash
//    - We compute hash(publicKeyHash + PEPPER)
//    - Find their evidence list
//    - They verify each by computing hash(evidenceId) locally
//
// SECURITY:
// - Without publicKeyHash, no one can reverse the lookupKey
// - Evidence IDs are also hashed, so even DB access reveals nothing
// - PEPPER is server-side secret, adds extra layer
// =============================================================================

// IMPORTANT: This pepper should be in environment variable
const LOOKUP_PEPPER = process.env.LOOKUP_PEPPER || 'chainproof_pepper_change_in_production';

function createLookupKey(publicKeyHash) {
    return crypto
        .createHmac('sha256', LOOKUP_PEPPER)
        .update(publicKeyHash)
        .digest('hex');
}

function hashEvidenceId(evidenceId) {
    return crypto
        .createHash('sha256')
        .update(evidenceId)
        .digest('hex');
}

const userLookupSchema = new mongoose.Schema({
    // HMAC(publicKeyHash, PEPPER) - cannot be reversed without pepper + publicKeyHash
    lookupKey: { type: String, required: true, unique: true, index: true },

    // Array of hashed evidence IDs (user must know evidenceId to verify)
    evidenceHashes: [{ type: String }],

    // Count (for rate limiting, no privacy concern)
    submissionCount: { type: Number, default: 0 },

    // First seen (no privacy concern - just for cleanup)
    createdAt: { type: Date, default: Date.now },

    // Last activity (for cleanup only)
    lastActivityAt: { type: Date, default: Date.now }
});

// Static method to add evidence for a user
userLookupSchema.statics.addEvidenceForUser = async function (publicKeyHash, evidenceId) {
    const lookupKey = createLookupKey(publicKeyHash);
    const evidenceHash = hashEvidenceId(evidenceId);

    return await this.findOneAndUpdate(
        { lookupKey },
        {
            $push: { evidenceHashes: evidenceHash },
            $inc: { submissionCount: 1 },
            $set: { lastActivityAt: new Date() }
        },
        { upsert: true, new: true }
    );
};

// Static method to get evidence for a user
userLookupSchema.statics.getEvidenceForUser = async function (publicKeyHash) {
    const lookupKey = createLookupKey(publicKeyHash);
    const record = await this.findOne({ lookupKey });

    if (!record) return [];
    return record.evidenceHashes;
};

// Static method to verify user owns an evidence (they provide both publicKeyHash and evidenceId)
userLookupSchema.statics.verifyOwnership = async function (publicKeyHash, evidenceId) {
    const lookupKey = createLookupKey(publicKeyHash);
    const evidenceHash = hashEvidenceId(evidenceId);

    const record = await this.findOne({
        lookupKey,
        evidenceHashes: evidenceHash
    });

    return !!record;
};

export const UserLookup = mongoose.model('UserLookup', userLookupSchema);

// Export helper functions for use in routes
export { createLookupKey, hashEvidenceId, LOOKUP_PEPPER };

// =============================================================================
// VERIFICATION PROOF MODEL
// =============================================================================
// Stores proof that verification happened, NO user info
const verificationProofSchema = new mongoose.Schema({
    // Random proof ID (not linked to anything)
    proofId: { type: String, default: generateAnonymousId, unique: true },

    // Hash of evidence (for lookup)
    fileHash: { type: String, required: true, index: true },

    // Verification result (public)
    verified: { type: Boolean, required: true },

    // Timestamp (public)
    verifiedAt: { type: Date, default: Date.now },

    // Hash of verifier org (not the org name - prevents tracking)
    verifierOrgHash: { type: String }
});

export const VerificationProof = mongoose.model('VerificationProof', verificationProofSchema);

// =============================================================================
// SYSTEM STATS MODEL (AGGREGATED ONLY)
// =============================================================================
// Only aggregated statistics, NO individual user data
const systemStatsSchema = new mongoose.Schema({
    // Date bucket (daily aggregation)
    date: { type: String, required: true, unique: true }, // YYYY-MM-DD

    // Aggregated counts only
    totalSubmissions: { type: Number, default: 0 },
    totalVerified: { type: Number, default: 0 },
    totalRejected: { type: Number, default: 0 },
    totalExported: { type: Number, default: 0 },

    // Category counts (aggregated, not per-user)
    categoryCounts: {
        corruption: { type: Number, default: 0 },
        fraud: { type: Number, default: 0 },
        safety: { type: Number, default: 0 },
        other: { type: Number, default: 0 }
    }
});

export const SystemStats = mongoose.model('SystemStats', systemStatsSchema);

// =============================================================================
// SEPOLIA TRANSACTION CACHE
// =============================================================================
// Cache of Sepolia transactions for faster lookup (all public data)
const sepoliaCacheSchema = new mongoose.Schema({
    txHash: { type: String, required: true, unique: true },
    blockNumber: { type: Number },
    fileHashStored: { type: String }, // The hash that was anchored
    timestamp: { type: Date },
    gasUsed: { type: Number },

    // Cache expiry
    cachedAt: { type: Date, default: Date.now }
});

sepoliaCacheSchema.index({ cachedAt: 1 }, { expireAfterSeconds: 86400 * 7 }); // 7 day TTL

export const SepoliaCache = mongoose.model('SepoliaCache', sepoliaCacheSchema);

// =============================================================================
// WHAT WE DO NOT STORE:
// =============================================================================
// ❌ publicKeyHash - NEVER stored in MongoDB (only on blockchain with PDC)
// ❌ User preferences - Not stored (stateless)
// ❌ Notification cache - Not stored (query blockchain directly)
// ❌ Audit logs with user IDs - Not stored
// ❌ Evidence content - NEVER stored
// ❌ Original filenames - NEVER stored
// ❌ File types - NEVER stored (could correlate)
// ❌ Submission timestamps linked to users - NEVER stored
// =============================================================================

export default {
    EvidenceAnchor,
    VerificationProof,
    SystemStats,
    SepoliaCache,
    generateAnonymousId
};
