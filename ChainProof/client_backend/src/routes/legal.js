/**
 * Legal Routes
 * 
 * Endpoints for legal team to review and export evidence
 */

import express from 'express';
import { generateAuditReport } from '../services/pdf.js';

const router = express.Router();

/**
 * POST /api/legal/review
 * Review evidence (start or complete review)
 * 
 * Body:
 * - evidenceId: Evidence ID
 * - action: 'start' or 'complete'
 */
router.post('/review', async (req, res, next) => {
    try {
        const { evidenceId, action } = req.body;

        if (!evidenceId || !action) {
            return res.status(400).json({
                success: false,
                error: 'evidenceId and action are required'
            });
        }

        if (!['start', 'complete'].includes(action)) {
            return res.status(400).json({
                success: false,
                error: 'action must be "start" or "complete"'
            });
        }

        // TODO: Call Fabric chaincode
        // LegalContract:ReviewEvidence(evidenceId)

        res.json({
            success: true,
            data: {
                evidenceId,
                action,
                message: action === 'start'
                    ? 'Legal review started'
                    : 'Legal review completed',
                reviewedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/legal/comment
 * Add private legal comment
 * 
 * Body:
 * - evidenceId: Evidence ID
 * - content: Comment content
 * - courtReadiness: 'READY', 'NOT_READY', or 'NEEDS_REVIEW'
 * - recommendation: Legal recommendation
 */
router.post('/comment', async (req, res, next) => {
    try {
        const { evidenceId, content, courtReadiness, recommendation } = req.body;

        if (!evidenceId || !content) {
            return res.status(400).json({
                success: false,
                error: 'evidenceId and content are required'
            });
        }

        // TODO: Call Fabric chaincode
        // LegalContract:AddLegalComment(evidenceId, commentId, content, courtReadiness, recommendation)

        res.json({
            success: true,
            data: {
                evidenceId,
                courtReadiness: courtReadiness || 'NEEDS_REVIEW',
                message: 'Legal comment added (PDC)',
                addedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/legal/export
 * Export evidence for court proceedings
 * 
 * Body:
 * - evidenceId: Evidence ID
 */
router.post('/export', async (req, res, next) => {
    try {
        const { evidenceId } = req.body;

        if (!evidenceId) {
            return res.status(400).json({
                success: false,
                error: 'evidenceId is required'
            });
        }

        // TODO: Get evidence from Fabric chaincode
        // For now, use mock data for PDF generation demo
        const mockEvidence = {
            evidenceId,
            ipfsCid: 'QmMockCid123',
            fileHash: 'a'.repeat(64),
            fileType: 'application/pdf',
            category: 'corruption',
            status: 'REVIEWED',
            integrityStatus: 'VERIFIED',
            submittedAt: Math.floor(Date.now() / 1000) - 86400,
            verifiedAt: Math.floor(Date.now() / 1000) - 43200,
            reviewedAt: Math.floor(Date.now() / 1000) - 3600,
            exportedAt: Math.floor(Date.now() / 1000),
            polygonTxHash: '0x' + 'b'.repeat(64),
            polygonAnchorAt: Math.floor(Date.now() / 1000) - 80000,
            custodyLog: [
                {
                    action: 'SUBMIT',
                    actorOrg: 'WhistleblowersOrgMSP',
                    timestamp: Math.floor(Date.now() / 1000) - 86400,
                    description: 'Evidence submitted anonymously via cryptographic keypair'
                },
                {
                    action: 'VERIFY',
                    actorOrg: 'VerifierOrgMSP',
                    timestamp: Math.floor(Date.now() / 1000) - 43200,
                    description: 'Integrity check: hashes match, verification passed'
                },
                {
                    action: 'REVIEW',
                    actorOrg: 'LegalOrgMSP',
                    timestamp: Math.floor(Date.now() / 1000) - 3600,
                    description: 'Legal review completed'
                },
                {
                    action: 'EXPORT',
                    actorOrg: 'LegalOrgMSP',
                    timestamp: Math.floor(Date.now() / 1000),
                    description: 'Evidence exported for court proceedings'
                }
            ]
        };

        // Generate PDF
        const pdfBuffer = await generateAuditReport(mockEvidence);

        // Set headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="ChainProof_Audit_${evidenceId}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);

        res.send(pdfBuffer);

    } catch (error) {
        console.error('Export error:', error);
        next(error);
    }
});

/**
 * GET /api/legal/evidence
 * Get all evidence that has been verified (ready for legal review)
 */
router.get('/evidence', async (req, res, next) => {
    try {
        const { status } = req.query;

        // TODO: Query Fabric chaincode
        // QueryContract:QueryEvidenceByStatus(status || 'VERIFIED')

        res.json({
            success: true,
            data: {
                evidence: [],
                count: 0,
                message: 'Evidence query pending chaincode integration'
            }
        });

    } catch (error) {
        next(error);
    }
});

export default router;
