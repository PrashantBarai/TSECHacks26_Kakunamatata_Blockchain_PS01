/**
 * API Service - Backend and Fabric Gateway Communication
 * 
 * Routes:
 * - Backend (port 4000): IPFS, metadata stripping, PDF, Sepolia
 * - Fabric Gateway (port 5000): Chaincode transactions
 */

const BACKEND_URL = import.meta.env.VITE_API_URL || '';
const FABRIC_URL = import.meta.env.VITE_FABRIC_URL || 'http://localhost:5000';

// =============================================================================
// BACKEND API (IPFS, Metadata, PDF, Sepolia)
// =============================================================================

/**
 * Submit evidence - sends file to backend for processing
 * Backend strips metadata, uploads to IPFS, anchors to Sepolia
 * @param {FormData} formData 
 * @returns {Promise<Object>}
 */
export async function submitEvidenceToBackend(formData) {
    const response = await fetch(`${BACKEND_URL}/api/evidence/submit`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Submission failed');
    }

    return response.json();
}

export async function getEvidenceFromBackend(evidenceId) {
    const response = await fetch(`${BACKEND_URL}/api/evidence/${evidenceId}`);
    return response.json();
}

/**
 * Get all assignments from backend
 */
export async function getAssignments() {
    const response = await fetch(`${BACKEND_URL}/api/evidence/assignments`);
    return response.json();
}
/**
 * Manual assignment of evidence
 */
export async function assignEvidence(evidenceId, userId = null, targetOrg = null) {
    const response = await fetch(`${BACKEND_URL}/api/evidence/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evidenceId, userId, targetOrg })
    });
    return response.json();
}

/**
 * Assign evidence to a specific legal role
 */
export async function assignLegalRole(evidenceId, legalRole) {
    const response = await fetch(`${BACKEND_URL}/api/evidence/assign/legal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evidenceId, legalRole })
    });
    return response.json();
}

/**
 * Export evidence as PDF
 */
export async function exportEvidencePDF(evidenceId) {
    const response = await fetch(`${BACKEND_URL}/api/legal/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evidenceId })
    });

    if (!response.ok) {
        throw new Error('Export failed');
    }

    return response.blob();
}

/**
 * Compute SHA-256 hash of a blob (for integrity check)
 */
export async function computeHash(blob) {
    const arrayBuffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

/**
 * Fetch a file from IPFS as a blob
 */
export async function fetchFileBlob(cid) {
    const response = await fetch(`${BACKEND_URL}/api/evidence/proxy/${cid}`);
    if (!response.ok) throw new Error('Failed to fetch file from IPFS');
    return response.blob();
}

// =============================================================================
// FABRIC GATEWAY API (Chaincode Transactions)
// =============================================================================

/**
 * Submit evidence to blockchain
 */
export async function submitEvidenceToChaincode(data) {
    const response = await fetch(`${FABRIC_URL}/api/fabric/evidence/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Blockchain submission failed');
    }

    return response.json();
}

/**
 * Get evidence from blockchain
 */
export async function getEvidenceFromChaincode(evidenceId) {
    const response = await fetch(`${FABRIC_URL}/api/fabric/evidence/${evidenceId}`);
    return response.json();
}

/**
 * Get evidence history (audit trail)
 */
export async function getEvidenceHistory(evidenceId) {
    const response = await fetch(`${FABRIC_URL}/api/fabric/evidence/${evidenceId}/history`);
    return response.json();
}

/**
 * Get notifications from blockchain
 */
export async function getNotifications(publicKeyHash) {
    const response = await fetch(`${FABRIC_URL}/api/fabric/notifications/${publicKeyHash}`);
    return response.json();
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(notificationId) {
    const response = await fetch(`${FABRIC_URL}/api/fabric/notifications/${notificationId}/read`, {
        method: 'POST'
    });
    return response.json();
}

/**
 * Get reputation from blockchain
 */
export async function getReputation(publicKeyHash) {
    const response = await fetch(`${FABRIC_URL}/api/fabric/reputation/${publicKeyHash}`);
    return response.json();
}

/**
 * Verify evidence integrity (for verifiers)
 */
export async function verifyIntegrity(evidenceId, computedHash, passed, rejectionComment) {
    const response = await fetch(`${FABRIC_URL}/api/fabric/verify/${evidenceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ computedHash, passed, rejectionComment })
    });
    return response.json();
}

/**
 * Review evidence (for legal)
 */
export async function reviewEvidence(evidenceId, complete, verdict) {
    const response = await fetch(`${FABRIC_URL}/api/fabric/legal/${evidenceId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ complete, verdict })
    });
    return response.json();
}

/**
 * Export evidence from blockchain
 */
export async function exportEvidenceFromChaincode(evidenceId) {
    const response = await fetch(`${FABRIC_URL}/api/fabric/legal/${evidenceId}/export`, {
        method: 'POST'
    });
    return response.json();
}

/**
 * Query evidence by status
 */
export async function queryByStatus(status, pageSize = 10) {
    const response = await fetch(`${FABRIC_URL}/api/fabric/query/status/${status}?pageSize=${pageSize}`);
    return response.json();
}

// Alias for dashboard compatibility
export const queryEvidenceByStatus = queryByStatus;

/**
 * Query evidence by category
 */
export async function queryByCategory(category, pageSize = 10) {
    const response = await fetch(`${FABRIC_URL}/api/fabric/query/category/${category}?pageSize=${pageSize}`);
    return response.json();
}

/**
 * Add legal comment to evidence
 */
export async function addLegalComment(evidenceId, commentId, content, courtReadiness, recommendation) {
    const response = await fetch(`${FABRIC_URL}/api/fabric/legal/${evidenceId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId, content, courtReadiness, recommendation })
    });
    return response.json();
}

/**
 * Export evidence (wrapper for chaincode export)
 */
export async function exportEvidence(evidenceId) {
    return exportEvidenceFromChaincode(evidenceId);
}

/**
 * Get evidence (alias for chaincode getter)
 */
export async function getEvidence(evidenceId) {
    return getEvidenceFromChaincode(evidenceId);
}

// =============================================================================
// COMBINED FLOW: Submit evidence end-to-end
// =============================================================================

/**
 * Full evidence submission flow:
 * 1. Send file to backend (strip metadata, upload to IPFS, anchor to Sepolia)
 * 2. Submit to blockchain via Fabric Gateway
 * 3. Return combined result
 */
export async function submitEvidenceFull(formData) {
    // Step 1: Backend processing
    console.log('Step 1: Processing file via backend...');
    const backendResult = await submitEvidenceToBackend(formData);

    if (!backendResult.success) {
        throw new Error(backendResult.error || 'Backend processing failed');
    }

    const { evidenceId, ipfsCid, fileHash, fileType, fileSize, category } = backendResult.data;
    const publicKeyHash = formData.get('publicKeyHash');
    const signature = formData.get('signature');

    // Step 2: Submit to blockchain
    console.log('Step 2: Submitting to blockchain...');
    try {
        const chaincodeResult = await submitEvidenceToChaincode({
            evidenceId,
            ipfsCid,
            fileHash,
            fileType,
            fileSize: fileSize?.toString() || '0',
            category: category || 'other',
            description: formData.get('description'),
            publicKeyHash,
            signature
        });

        return {
            success: true,
            data: {
                ...backendResult.data,
                blockchainTx: chaincodeResult.data
            }
        };
    } catch (chaincodeError) {
        console.warn('Blockchain submission failed:', chaincodeError.message);
        // Return backend result even if blockchain fails
        return {
            success: true,
            data: {
                ...backendResult.data,
                blockchainWarning: chaincodeError.message
            }
        };
    }
}

// =============================================================================
// AUTH API
// =============================================================================

/**
 * Get user profile (including stats)
 */
export async function getUserProfile(publicKeyHash) {
    const response = await fetch(`${BACKEND_URL}/api/auth/me/${publicKeyHash}`);
    return response.json();
}

export default {
    // Backend
    submitEvidenceToBackend,
    getEvidenceFromBackend,
    getAssignments,
    assignEvidence,
    assignLegalRole,
    exportEvidencePDF,
    getUserProfile,
    // Fabric Gateway
    submitEvidenceToChaincode,
    getEvidenceFromChaincode,
    getEvidenceHistory,
    getNotifications,
    markNotificationRead,
    getReputation,
    verifyIntegrity,
    reviewEvidence,
    exportEvidenceFromChaincode,
    queryByStatus,
    queryEvidenceByStatus,
    queryByCategory,
    addLegalComment,
    exportEvidence,
    getEvidence,
    fetchFileBlob,
    computeHash,
    // Combined
    submitEvidenceFull
};
