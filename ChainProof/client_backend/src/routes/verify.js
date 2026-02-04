/**
 * Verify Routes
 * 
 * Endpoints for verifiers to check evidence integrity
 */

import express from 'express';
import { getFromIPFS } from '../services/ipfs.js';
import { sha256 } from '../utils/hash.js';

const router = express.Router();

/**
 * POST /api/verify/integrity
 * Verify evidence integrity by comparing hashes
 * 
 * Body:
 * - evidenceId: Evidence ID
 * - ipfsCid: IPFS CID to fetch file from
 * - expectedHash: Expected file hash from ledger
 */
router.post('/integrity', async (req, res, next) => {
    try {
        const { evidenceId, ipfsCid, expectedHash } = req.body;

        if (!evidenceId || !ipfsCid || !expectedHash) {
            return res.status(400).json({
                success: false,
                error: 'evidenceId, ipfsCid, and expectedHash are required'
            });
        }

        console.log(`Verifying integrity for ${evidenceId}...`);

        // Fetch file from IPFS
        console.log(`Fetching from IPFS: ${ipfsCid}`);
        const fileBuffer = await getFromIPFS(ipfsCid);

        // Compute hash
        const computedHash = sha256(fileBuffer);
        console.log(`Computed hash: ${computedHash}`);
        console.log(`Expected hash: ${expectedHash}`);

        // Compare
        const passed = computedHash.toLowerCase() === expectedHash.toLowerCase();

        res.json({
            success: true,
            data: {
                evidenceId,
                passed,
                computedHash,
                expectedHash,
                message: passed
                    ? 'Integrity verified - hashes match'
                    : 'Integrity FAILED - hashes do not match',
                verifiedAt: new Date().toISOString()
            }
        });

        // TODO: Call Fabric chaincode to record verification
        // VerifierContract:VerifyIntegrity(evidenceId, computedHash, passed, rejectionComment)

    } catch (error) {
        console.error('Verification error:', error);
        next(error);
    }
});

/**
 * POST /api/verify/record
 * Record verification result to chaincode
 * 
 * Body:
 * - evidenceId: Evidence ID
 * - computedHash: Computed hash
 * - passed: Boolean - did hash match?
 * - rejectionComment: Required if passed=false
 */
router.post('/record', async (req, res, next) => {
    try {
        const { evidenceId, computedHash, passed, rejectionComment } = req.body;

        if (!evidenceId || !computedHash || passed === undefined) {
            return res.status(400).json({
                success: false,
                error: 'evidenceId, computedHash, and passed are required'
            });
        }

        if (!passed && !rejectionComment) {
            return res.status(400).json({
                success: false,
                error: 'rejectionComment is required when verification fails'
            });
        }

        // TODO: Call Fabric chaincode
        // VerifierContract:VerifyIntegrity(evidenceId, computedHash, passed, rejectionComment)

        res.json({
            success: true,
            data: {
                evidenceId,
                passed,
                rejectionComment: passed ? null : rejectionComment,
                message: passed
                    ? 'Verification recorded - evidence will proceed to legal review'
                    : 'Rejection recorded - whistleblower has been notified',
                recordedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/verify/note
 * Add private verification note
 * 
 * Body:
 * - evidenceId: Evidence ID
 * - content: Note content
 * - hashComparison: Technical details of hash comparison
 */
router.post('/note', async (req, res, next) => {
    try {
        const { evidenceId, content, hashComparison } = req.body;

        if (!evidenceId || !content) {
            return res.status(400).json({
                success: false,
                error: 'evidenceId and content are required'
            });
        }

        // TODO: Call Fabric chaincode
        // VerifierContract:AddVerificationNote(evidenceId, noteId, content, hashComparison)

        res.json({
            success: true,
            data: {
                evidenceId,
                message: 'Verification note added (PDC)',
                addedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        next(error);
    }
});

export default router;
