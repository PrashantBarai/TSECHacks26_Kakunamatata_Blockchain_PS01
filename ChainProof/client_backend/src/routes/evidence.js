/**
 * Evidence Routes
 * 
 * Endpoints for whistleblowers to submit and track evidence
 */

import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { stripMetadata } from '../services/metadata.js';
import { uploadToIPFS } from '../services/ipfs.js';
import { anchorToSepolia } from '../services/sepolia.js';
import { sha256 } from '../utils/hash.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB max
    }
});

/**
 * POST /api/evidence/submit
 * Submit new evidence (Whistleblower)
 * 
 * Body (multipart/form-data):
 * - file: The evidence file
 * - category: Evidence category
 * - publicKeyHash: SHA256 hash of user's public key
 * - signature: Digital signature of fileHash using private key
 */
router.post('/submit', upload.single('file'), async (req, res, next) => {
    try {
        const { category, publicKeyHash, signature } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ success: false, error: 'No file provided' });
        }

        if (!publicKeyHash || !signature) {
            return res.status(400).json({ success: false, error: 'publicKeyHash and signature are required' });
        }

        console.log(`Processing evidence submission from ${publicKeyHash.substring(0, 16)}...`);

        // Step 1: Strip metadata from file
        console.log('Stripping metadata...');
        const { buffer: cleanBuffer, removedMetadata, hadIdentifyingData } = await stripMetadata(
            file.buffer,
            file.originalname
        );

        // Step 2: Compute hash of clean file
        const fileHash = sha256(cleanBuffer);
        console.log(`File hash: ${fileHash}`);

        // Step 3: Upload to IPFS via Pinata
        console.log('Uploading to IPFS...');
        const { cid, size } = await uploadToIPFS(cleanBuffer, file.originalname, {
            category,
            publicKeyHash: publicKeyHash.substring(0, 16) // Only store partial for privacy
        });
        console.log(`IPFS CID: ${cid}`);

        // Step 4: Generate evidence ID
        const evidenceId = `EVD-${uuidv4().substring(0, 8).toUpperCase()}`;

        // Step 5: Anchor to Sepolia (if configured)
        let sepoliaAnchor = null;
        try {
            sepoliaAnchor = await anchorToSepolia(evidenceId, fileHash);
            console.log(`Anchored to Sepolia: ${sepoliaAnchor.txHash}`);
        } catch (error) {
            console.warn('Sepolia anchoring skipped:', error.message);
        }

        // TODO: Step 6: Call Fabric chaincode to store evidence
        // This would use the Fabric CA Client to invoke WhistleblowerContract:SubmitEvidence
        // For now, return the data that would be sent to chaincode

        const response = {
            success: true,
            data: {
                evidenceId,
                ipfsCid: cid,
                fileHash,
                fileType: file.mimetype,
                fileSize: size,
                category: category || 'other',
                publicKeyHash,
                metadataStripped: hadIdentifyingData,
                removedMetadata: hadIdentifyingData ? Object.keys(removedMetadata).filter(k =>
                    Object.values(removedMetadata[k]).some(v => v !== null && v !== undefined)
                ) : [],
                sepoliaAnchor,
                submittedAt: new Date().toISOString(),
                message: 'Evidence submitted successfully. It will now be processed by verifiers.'
            }
        };

        res.status(201).json(response);

    } catch (error) {
        console.error('Evidence submission error:', error);
        next(error);
    }
});

/**
 * GET /api/evidence/:evidenceId
 * Get evidence details
 */
router.get('/:evidenceId', async (req, res, next) => {
    try {
        const { evidenceId } = req.params;

        // TODO: Query Fabric chaincode for evidence
        // For now, return placeholder

        res.json({
            success: true,
            data: {
                evidenceId,
                status: 'SUBMITTED',
                message: 'Query chaincode integration pending'
            }
        });

    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/evidence/notifications/:publicKeyHash
 * Get notifications for a public key hash
 */
router.get('/notifications/:publicKeyHash', async (req, res, next) => {
    try {
        const { publicKeyHash } = req.params;

        // TODO: Query Fabric chaincode for notifications
        // WhistleblowerContract:GetNotifications(publicKeyHash)

        res.json({
            success: true,
            data: {
                notifications: [],
                count: 0,
                message: 'Notification retrieval pending chaincode integration'
            }
        });

    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/evidence/reputation/:publicKeyHash
 * Get reputation score for a public key hash
 */
router.get('/reputation/:publicKeyHash', async (req, res, next) => {
    try {
        const { publicKeyHash } = req.params;

        // TODO: Query Fabric chaincode for reputation
        // WhistleblowerContract:GetReputation(publicKeyHash)

        res.json({
            success: true,
            data: {
                publicKeyHash,
                trustScore: 50,
                totalSubmissions: 0,
                verifiedSubmissions: 0,
                message: 'Reputation query pending chaincode integration'
            }
        });

    } catch (error) {
        next(error);
    }
});

export default router;
