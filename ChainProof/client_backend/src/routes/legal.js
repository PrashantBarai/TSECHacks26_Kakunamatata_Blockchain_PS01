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
 * GET /api/legal/report/:evidenceId
 * Download court report as PDF
 */
router.get('/report/:evidenceId', async (req, res, next) => {
    try {
        const { evidenceId } = req.params;

        // In a real system, we would fetch the export data from the blockchain 
        // to ensure it matches the audit trail.
        // For now, we generate a report based on the evidence ID.

        // Mock data for PDF generation (in production, fetch from Chaincode)
        const mockEvidence = {
            evidenceId,
            ipfsCid: 'QmMockCid-' + evidenceId.substring(4),
            fileHash: 'sha256-' + evidenceId.substring(4),
            fileType: 'application/pdf',
            category: 'verified-evidence',
            status: 'EXPORTED',
            integrityStatus: 'VALIDATED',
            submittedAt: Math.floor(Date.now() / 1000) - 86400,
            verifiedAt: Math.floor(Date.now() / 1000) - 43200,
            reviewedAt: Math.floor(Date.now() / 1000) - 3600,
            exportedAt: Math.floor(Date.now() / 1000),
            polygonTxHash: '0x' + 'b'.repeat(64),
            custodyLog: [
                {
                    action: 'SUBMIT',
                    actorOrg: 'WhistleblowersOrgMSP',
                    timestamp: Math.floor(Date.now() / 1000) - 86400,
                    description: 'Evidence submitted'
                },
                {
                    action: 'VERIFY',
                    actorOrg: 'VerifierOrgMSP',
                    timestamp: Math.floor(Date.now() / 1000) - 43200,
                    description: 'Verification complete'
                },
                {
                    action: 'REVIEW',
                    actorOrg: 'LegalOrgMSP',
                    timestamp: Math.floor(Date.now() / 1000) - 3600,
                    description: 'Legal review completed'
                }
            ]
        };

        const pdfBuffer = await generateAuditReport(mockEvidence);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="ChainProof_Report_${evidenceId}.pdf"`);
        res.send(pdfBuffer);

    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/legal/export
 * Trigger blockchain status update for export
 */
router.post('/export', async (req, res, next) => {
    try {
        const { evidenceId } = req.body;
        // This route is mostly a placeholder now as the frontend 
        // calls the Fabric Gateway directly for the status update.
        res.json({ success: true, evidenceId });
    } catch (error) {
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
