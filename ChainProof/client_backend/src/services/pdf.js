/**
 * PDF Audit Report Generator
 * 
 * Generates court-ready PDF audit reports for evidence
 */

import PDFDocument from 'pdfkit';
import { createHash } from 'crypto';

/**
 * Generate a professional audit report PDF
 * @param {Object} evidence - Evidence data from chaincode
 * @param {Object} options - Additional options
 * @returns {Promise<Buffer>} PDF file as buffer
 */
export async function generateAuditReport(evidence, options = {}) {
    return new Promise((resolve, reject) => {
        try {
            const chunks = [];
            const doc = new PDFDocument({
                size: 'A4',
                margin: 50,
                info: {
                    Title: `ChainProof Audit Report - ${evidence.evidenceId}`,
                    Author: 'ChainProof Whistleblowing Platform',
                    Subject: 'Cryptographic Evidence Audit Report',
                    CreationDate: new Date()
                }
            });

            doc.on('data', chunks.push.bind(chunks));
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(chunks);
                resolve(pdfBuffer);
            });
            doc.on('error', reject);

            // Header
            doc.fontSize(24)
                .font('Helvetica-Bold')
                .fillColor('#1a365d')
                .text('CHAINPROOF', { align: 'center' });

            doc.fontSize(14)
                .font('Helvetica')
                .fillColor('#4a5568')
                .text('Cryptographic Evidence Audit Report', { align: 'center' });

            doc.moveDown();

            // Horizontal line
            doc.strokeColor('#e2e8f0')
                .lineWidth(2)
                .moveTo(50, doc.y)
                .lineTo(545, doc.y)
                .stroke();

            doc.moveDown();

            // Document Classification
            doc.fontSize(10)
                .font('Helvetica-Bold')
                .fillColor('#c53030')
                .text('CONFIDENTIAL - FOR LEGAL USE ONLY', { align: 'center' });

            doc.moveDown(2);

            // Evidence Summary Section
            drawSectionHeader(doc, 'EVIDENCE SUMMARY');

            drawInfoRow(doc, 'Evidence ID:', evidence.evidenceId);
            drawInfoRow(doc, 'IPFS CID:', evidence.ipfsCid);
            drawInfoRow(doc, 'File Hash (SHA-256):', evidence.fileHash);
            drawInfoRow(doc, 'File Type:', evidence.fileType || 'Unknown');
            drawInfoRow(doc, 'Category:', evidence.category || 'Not specified');
            drawInfoRow(doc, 'Status:', evidence.status);
            drawInfoRow(doc, 'Integrity Status:', evidence.integrityStatus);

            doc.moveDown();

            // Timeline Section
            drawSectionHeader(doc, 'TIMELINE');

            drawInfoRow(doc, 'Submitted:', formatTimestamp(evidence.submittedAt));
            if (evidence.verifiedAt) {
                drawInfoRow(doc, 'Verified:', formatTimestamp(evidence.verifiedAt));
            }
            if (evidence.reviewedAt) {
                drawInfoRow(doc, 'Reviewed:', formatTimestamp(evidence.reviewedAt));
            }
            if (evidence.exportedAt) {
                drawInfoRow(doc, 'Exported:', formatTimestamp(evidence.exportedAt));
            }

            doc.moveDown();

            // Blockchain Anchoring Section
            if (evidence.polygonTxHash) {
                drawSectionHeader(doc, 'PUBLIC BLOCKCHAIN ANCHOR');

                drawInfoRow(doc, 'Polygon/Sepolia TX:', evidence.polygonTxHash);
                drawInfoRow(doc, 'Anchored At:', formatTimestamp(evidence.polygonAnchorAt));

                doc.fontSize(9)
                    .fillColor('#718096')
                    .text('This transaction can be independently verified on the public blockchain.', { align: 'left' });

                doc.moveDown();
            }

            // Chain of Custody Section
            doc.addPage();
            drawSectionHeader(doc, 'CHAIN OF CUSTODY LOG');

            doc.fontSize(9)
                .fillColor('#4a5568')
                .text('The following is an immutable record of all actions taken on this evidence:', { align: 'left' });

            doc.moveDown();

            // Custody log table
            if (evidence.custodyLog && evidence.custodyLog.length > 0) {
                for (const entry of evidence.custodyLog) {
                    drawCustodyEntry(doc, entry);
                }
            } else {
                doc.text('No custody log entries found.');
            }

            doc.moveDown(2);

            // Cryptographic Verification Section
            drawSectionHeader(doc, 'CRYPTOGRAPHIC VERIFICATION');

            // Generate hash of this report
            const reportData = JSON.stringify({
                evidenceId: evidence.evidenceId,
                fileHash: evidence.fileHash,
                custodyLog: evidence.custodyLog,
                exportedAt: new Date().toISOString()
            });
            const reportHash = createHash('sha256').update(reportData).digest('hex');

            doc.fontSize(9)
                .fillColor('#4a5568')
                .text('This report can be verified using the following cryptographic hashes:');

            doc.moveDown();

            drawInfoRow(doc, 'Report Hash:', reportHash);
            drawInfoRow(doc, 'Original File Hash:', evidence.fileHash);

            doc.moveDown(2);

            // Legal Disclaimer
            doc.fontSize(8)
                .fillColor('#718096')
                .text('LEGAL DISCLAIMER', { align: 'center', underline: true });

            doc.moveDown(0.5);

            doc.text(
                'This document has been generated by the ChainProof decentralized whistleblowing platform. ' +
                'All data contained herein is stored on an immutable distributed ledger (Hyperledger Fabric) ' +
                'and anchored to public blockchain networks for independent verification. ' +
                'The cryptographic hashes provided can be used to verify the authenticity and integrity ' +
                'of the evidence file. This report does not constitute legal advice.',
                { align: 'justify', lineGap: 2 }
            );

            doc.moveDown(2);

            // Footer with generation timestamp
            doc.fontSize(8)
                .fillColor('#a0aec0')
                .text(`Generated: ${new Date().toISOString()}`, { align: 'center' });
            doc.text('ChainProof - Secure Disclosure Network', { align: 'center' });

            doc.end();

        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Draw section header
 */
function drawSectionHeader(doc, title) {
    doc.fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#2d3748')
        .text(title);

    doc.strokeColor('#cbd5e0')
        .lineWidth(1)
        .moveTo(50, doc.y + 2)
        .lineTo(300, doc.y + 2)
        .stroke();

    doc.moveDown(0.5);
    doc.font('Helvetica');
}

/**
 * Draw info row with label and value
 */
function drawInfoRow(doc, label, value) {
    doc.fontSize(10)
        .fillColor('#4a5568');

    const startX = 50;
    const valueX = 180;

    doc.font('Helvetica-Bold')
        .text(label, startX, doc.y, { continued: false });

    doc.font('Helvetica')
        .fillColor('#2d3748')
        .text(value || 'N/A', valueX, doc.y - doc.currentLineHeight());

    doc.moveDown(0.3);
}

/**
 * Draw custody log entry
 */
function drawCustodyEntry(doc, entry) {
    const boxY = doc.y;

    // Time and action on same line
    doc.fontSize(9)
        .font('Helvetica-Bold')
        .fillColor('#2d3748')
        .text(`[${formatTimestamp(entry.timestamp)}] ${entry.action}`, 60);

    // Organization
    doc.font('Helvetica')
        .fillColor('#718096')
        .text(`Organization: ${entry.actorOrg}`, 70);

    // Description
    doc.fillColor('#4a5568')
        .text(entry.description, 70, doc.y, { width: 460 });

    doc.moveDown(0.5);

    // Separator line
    doc.strokeColor('#e2e8f0')
        .lineWidth(0.5)
        .moveTo(60, doc.y)
        .lineTo(535, doc.y)
        .stroke();

    doc.moveDown(0.5);
}

/**
 * Format Unix timestamp to readable date
 */
function formatTimestamp(timestamp) {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp * 1000);
    return date.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
}

export default {
    generateAuditReport
};
