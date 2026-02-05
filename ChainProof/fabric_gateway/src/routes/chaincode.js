/**
 * Chaincode API Routes
 * 
 * REST endpoints for chaincode invocation
 */

const express = require('express');
const fabric = require('../services/fabric');
const logger = require('../utils/logger');

const router = express.Router();

// ============================================================
// ORGANIZATION MANAGEMENT
// ============================================================

/**
 * GET /api/fabric/org
 * Get current organization context
 */
router.get('/org', (req, res) => {
    res.json({
        success: true,
        org: fabric.getCurrentOrg()
    });
});

/**
 * POST /api/fabric/org/switch
 * Switch organization context
 */
router.post('/org/switch', async (req, res, next) => {
    try {
        const { org } = req.body;
        if (!['WhistleblowersOrg', 'VerifierOrg', 'LegalOrg'].includes(org)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid org. Must be: WhistleblowersOrg, VerifierOrg, or LegalOrg'
            });
        }

        await fabric.switchOrg(org);
        logger.info(`Switched to organization: ${org}`);
        res.json({ success: true, org });
    } catch (error) {
        next(error);
    }
});

// ============================================================
// WHISTLEBLOWER ENDPOINTS
// ============================================================

/**
 * POST /api/fabric/evidence/submit
 * Submit new evidence
 */
router.post('/evidence/submit', async (req, res, next) => {
    try {
        const { evidenceId, ipfsCid, fileHash, fileType, fileSize, category, description, publicKeyHash, signature } = req.body;

        if (!evidenceId || !ipfsCid || !fileHash || !publicKeyHash || !signature) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: evidenceId, ipfsCid, fileHash, publicKeyHash, signature'
            });
        }

        logger.info(`Submitting evidence: ${evidenceId}`);
        const result = await fabric.submitEvidence(
            evidenceId, ipfsCid, fileHash,
            fileType || 'unknown',
            fileSize || 0,
            category || 'other',
            description,
            publicKeyHash,
            signature
        );

        res.status(201).json({ success: true, data: result });
    } catch (error) {
        logger.error(`Evidence submission failed: ${error.message}`);
        next(error);
    }
});

/**
 * GET /api/fabric/evidence/:evidenceId
 * Get evidence details
 */
router.get('/evidence/:evidenceId', async (req, res, next) => {
    try {
        const result = await fabric.getEvidence(req.params.evidenceId);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/fabric/evidence/:evidenceId/history
 * Get evidence history (audit trail)
 */
router.get('/evidence/:evidenceId/history', async (req, res, next) => {
    try {
        const result = await fabric.getEvidenceHistory(req.params.evidenceId);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/fabric/evidence/:evidenceId/anchor
 * Update Polygon/Sepolia anchor
 */
router.post('/evidence/:evidenceId/anchor', async (req, res, next) => {
    try {
        const { txHash } = req.body;
        const result = await fabric.updatePolygonAnchor(req.params.evidenceId, txHash);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/fabric/notifications/:publicKeyHash
 * Get notifications for whistleblower
 */
router.get('/notifications/:publicKeyHash', async (req, res, next) => {
    try {
        const result = await fabric.getNotifications(req.params.publicKeyHash);
        res.json({ success: true, data: result || [] });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/fabric/notifications/:notificationId/read
 * Mark notification as read
 */
router.post('/notifications/:notificationId/read', async (req, res, next) => {
    try {
        await fabric.markNotificationRead(req.params.notificationId);
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/fabric/reputation/:publicKeyHash
 * Get reputation score
 */
router.get('/reputation/:publicKeyHash', async (req, res, next) => {
    try {
        const result = await fabric.getReputation(req.params.publicKeyHash);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

// ============================================================
// VERIFIER ENDPOINTS
// ============================================================

/**
 * POST /api/fabric/verify/:evidenceId
 * Verify evidence integrity
 */
router.post('/verify/:evidenceId', async (req, res, next) => {
    try {
        const { computedHash, passed, rejectionComment } = req.body;

        if (!computedHash || passed === undefined) {
            return res.status(400).json({
                success: false,
                error: 'computedHash and passed are required'
            });
        }

        if (!passed && !rejectionComment) {
            return res.status(400).json({
                success: false,
                error: 'rejectionComment is required when verification fails'
            });
        }

        logger.info(`Verifying evidence: ${req.params.evidenceId}, passed: ${passed}`);
        const result = await fabric.verifyIntegrity(
            req.params.evidenceId,
            computedHash,
            passed,
            rejectionComment || ''
        );

        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/fabric/verify/:evidenceId/note
 * Add verification note (PDC)
 */
router.post('/verify/:evidenceId/note', async (req, res, next) => {
    try {
        const { noteId, content, hashComparison } = req.body;
        const result = await fabric.addVerificationNote(
            req.params.evidenceId, noteId, content, hashComparison || ''
        );
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/fabric/verify/:evidenceId/notes
 * Get verification notes (PDC)
 */
router.get('/verify/:evidenceId/notes', async (req, res, next) => {
    try {
        const result = await fabric.getVerificationNotes(req.params.evidenceId);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

// ============================================================
// LEGAL ENDPOINTS
// ============================================================

/**
 * POST /api/fabric/legal/:evidenceId/review
 * Start or complete legal review
 */
router.post('/legal/:evidenceId/review', async (req, res, next) => {
    try {
        const { complete, verdict } = req.body;
        logger.info(`Legal review: ${req.params.evidenceId}, complete: ${complete}, verdict: ${verdict}`);
        const result = await fabric.reviewEvidence(req.params.evidenceId, complete || false, verdict);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/fabric/legal/:evidenceId/comment
 * Add legal comment (PDC)
 */
router.post('/legal/:evidenceId/comment', async (req, res, next) => {
    try {
        const { commentId, content, courtReadiness, recommendation } = req.body;
        const result = await fabric.addLegalComment(
            req.params.evidenceId, commentId, content,
            courtReadiness || 'NEEDS_REVIEW',
            recommendation || ''
        );
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/fabric/legal/:evidenceId/comments
 * Get legal comments (PDC)
 */
router.get('/legal/:evidenceId/comments', async (req, res, next) => {
    try {
        const result = await fabric.getLegalComments(req.params.evidenceId);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/fabric/legal/:evidenceId/export
 * Export evidence for court
 */
router.post('/legal/:evidenceId/export', async (req, res, next) => {
    try {
        logger.info(`Exporting evidence: ${req.params.evidenceId}`);
        const result = await fabric.exportEvidence(req.params.evidenceId);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

// ============================================================
// QUERY ENDPOINTS
// ============================================================

/**
 * GET /api/fabric/query/status/:status
 * Query evidence by status
 */
router.get('/query/status/:status', async (req, res, next) => {
    try {
        const { pageSize, bookmark } = req.query;
        const result = await fabric.queryEvidenceByStatus(
            req.params.status,
            pageSize || 10,
            bookmark || ''
        );
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/fabric/query/category/:category
 * Query evidence by category
 */
router.get('/query/category/:category', async (req, res, next) => {
    try {
        const { pageSize, bookmark } = req.query;
        const result = await fabric.queryEvidenceByCategory(
            req.params.category,
            pageSize || 10,
            bookmark || ''
        );
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
