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
import User from '../models/User.js';
import Evidence from '../models/Evidence.js';

// ... existing imports ...

router.post('/submit', upload.single('file'), async (req, res, next) => {
    try {
        const { category, publicKeyHash, signature, description } = req.body;
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

        // Step 6: Assign to a Verifier
        let assignedUser = null;
        try {
            // Find all users in VerifierOrg
            const verifiers = await User.find({ organization: 'VerifierOrg' });

            if (verifiers.length > 0) {
                // Simple random assignment for now
                // In production, you'd check workload/queue size
                const randomIndex = Math.floor(Math.random() * verifiers.length);
                assignedUser = verifiers[randomIndex];

                // Increment assigned count
                assignedUser.evidenceAssigned = (assignedUser.evidenceAssigned || 0) + 1;
                await assignedUser.save();

                console.log(`Assigned evidence ${evidenceId} to verifier: ${assignedUser.name}`);
            } else {
                console.warn('No verifiers found. Evidence will be unassigned.');
            }
        } catch (assignError) {
            console.error('Assignment error:', assignError);
        }

        // Step 7: Store metadata in MongoDB
        try {
            const newEvidence = new Evidence({
                evidenceId,
                ipfsCid: cid,
                submittedBy: publicKeyHash,
                assignedTo: assignedUser ? assignedUser._id : null,
                organization: 'WhistleblowersOrg',
                status: 'SUBMITTED',
                description: description || '',
                transactionHash: sepoliaAnchor ? sepoliaAnchor.txHash : null
            });
            await newEvidence.save();
            console.log('Evidence metadata saved to MongoDB');
        } catch (dbError) {
            console.error('Failed to save to MongoDB:', dbError);
            // Proceed anyway, as chain storage is primary
        }

        // TODO: Step 8: Call Fabric chaincode to store evidence
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
                description: description || '',
                publicKeyHash,
                assignedTo: assignedUser ? assignedUser.name : 'Unassigned',
                metadataStripped: hadIdentifyingData,
                removedMetadata: hadIdentifyingData ? Object.keys(removedMetadata).filter(k =>
                    Object.values(removedMetadata[k]).some(v => v !== null && v !== undefined)
                ) : [],
                sepoliaAnchor,
                submittedAt: new Date().toISOString(),
                message: assignedUser
                    ? `Evidence submitted and assigned to ${assignedUser.name} for verification.`
                    : 'Evidence submitted but pending assignment (no verifiers available).'
            }
        };

        res.status(201).json(response);

    } catch (error) {
        console.error('Evidence submission error:', error);
        next(error);
    }
});

/**
 * POST /api/evidence/assign
 * Manually assign evidence to a user (or next available)
 */
router.post('/assign', async (req, res, next) => {
    try {
        const { evidenceId, userId, targetOrg } = req.body;

        if (!evidenceId) {
            return res.status(400).json({ success: false, error: 'Evidence ID is required' });
        }

        let assignedUser = null;

        // If specific user is requested
        if (userId) {
            assignedUser = await User.findById(userId);
            if (!assignedUser) {
                return res.status(404).json({ success: false, error: 'Target user not found' });
            }
        } else {
            // Auto-assign to random user in target org
            const org = targetOrg || 'VerifierOrg';
            const users = await User.find({ organization: org });

            if (users.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: `No users found in ${org}. Cannot assign.`
                });
            }

            const randomIndex = Math.floor(Math.random() * users.length);
            assignedUser = users[randomIndex];
        }

        // Update Evidence record
        const evidence = await Evidence.findOneAndUpdate(
            { evidenceId },
            { assignedTo: assignedUser._id },
            { new: true, upsert: true } // Create if not exists (sync with ledger)
        );

        // Update User stats
        assignedUser.evidenceAssigned = (assignedUser.evidenceAssigned || 0) + 1;
        await assignedUser.save();

        res.json({
            success: true,
            data: {
                evidenceId,
                assignedTo: assignedUser.name,
                organization: assignedUser.organization,
                message: `Evidence assigned to ${assignedUser.name}`
            }
        });

    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/evidence/assign/legal
 * Forward evidence to a specific Legal Role (e.g. Judge)
 * Clears current assignment to remove from Verifier Dashboard
 */
router.post('/assign/legal', async (req, res, next) => {
    try {
        const { evidenceId, legalRole } = req.body;

        if (!evidenceId || !legalRole) {
            return res.status(400).json({ success: false, error: 'Evidence ID and Legal Role are required' });
        }

        // Update Evidence record
        // set assignedTo to null to remove from Verifier's personal queue
        const evidence = await Evidence.findOneAndUpdate(
            { evidenceId },
            {
                targetLegalRole: legalRole,
                assignedTo: null,
                status: 'VERIFIED'
            },
            { new: true, upsert: true }
        );

        if (!evidence) {
            return res.status(404).json({ success: false, error: 'Evidence not found' });
        }

        console.log(`Evidence ${evidenceId} verified and forwarded to Legal Role: ${legalRole}`);

        res.json({
            success: true,
            data: {
                evidenceId,
                targetLegalRole: legalRole,
                message: `Evidence forwarded to ${legalRole}`
            }
        });

    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/evidence/assignments
 * Get all evidence assignments
 */
router.get('/assignments', async (req, res, next) => {
    try {
        const assignments = await Evidence.find({}, 'evidenceId assignedTo status organization targetLegalRole')
            .populate('assignedTo', 'name organization');

        const assignmentMap = {};
        assignments.forEach(ev => {
            if (ev.evidenceId) {
                assignmentMap[ev.evidenceId] = ev;
            }
        });

        res.json({
            success: true,
            data: assignmentMap
        });
    } catch (error) {
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

/**
 * GET /api/evidence/proxy/:cid
 * Proxy IPFS content with multi-gateway fallback
 */
router.get('/proxy/:cid', async (req, res) => {
    const { cid } = req.params;
    const gateways = [
        `https://ipfs.io/ipfs/${cid}`,
        `https://gateway.pinata.cloud/ipfs/${cid}`,
        `https://dweb.link/ipfs/${cid}`,
        `https://cloudflare-ipfs.com/ipfs/${cid}`
    ];

    let lastError;

    for (const url of gateways) {
        try {
            console.log(`Trying IPFS gateway: ${url}`);
            // Use AbortController for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout per gateway

            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (response.ok) {
                // Forward content-type header
                const contentType = response.headers.get('content-type');
                if (contentType) {
                    res.setHeader('Content-Type', contentType);
                }

                // Use arrayBuffer for simplicity
                const buffer = await response.arrayBuffer();
                return res.send(Buffer.from(buffer));
            }
            console.warn(`Gateway ${url} failed with status: ${response.status}`);
        } catch (error) {
            console.warn(`Gateway ${url} error: ${error.message}`);
            lastError = error;
        }
    }

    console.error('All IPFS gateways failed');
    res.status(502).json({ error: 'Failed to fetch IPFS content from all gateways', details: lastError?.message });
});

export default router;
