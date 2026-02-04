/**
 * IPFS Service - Pinata Integration
 * 
 * Handles file upload to IPFS via Pinata
 */

import dotenv from 'dotenv';
dotenv.config();

const PINATA_API_URL = 'https://api.pinata.cloud';

/**
 * Upload a file buffer to Pinata IPFS
 * @param {Buffer} fileBuffer - The file buffer to upload
 * @param {string} fileName - Original filename
 * @param {Object} metadata - Additional metadata to pin
 * @returns {Promise<{cid: string, size: number}>}
 */
export async function uploadToIPFS(fileBuffer, fileName, metadata = {}) {
    const formData = new FormData();

    // Create a Blob from the buffer
    const blob = new Blob([fileBuffer], { type: 'application/octet-stream' });
    formData.append('file', blob, fileName);

    // Add pinata metadata
    const pinataMetadata = JSON.stringify({
        name: fileName,
        keyvalues: {
            ...metadata,
            uploadedAt: new Date().toISOString()
        }
    });
    formData.append('pinataMetadata', pinataMetadata);

    const response = await fetch(`${PINATA_API_URL}/pinning/pinFileToIPFS`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.PINATA_JWT}`
        },
        body: formData
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Pinata upload failed: ${error}`);
    }

    const result = await response.json();

    return {
        cid: result.IpfsHash,
        size: result.PinSize,
        timestamp: result.Timestamp
    };
}

/**
 * Get file from IPFS via Pinata gateway
 * @param {string} cid - IPFS Content Identifier
 * @returns {Promise<Buffer>}
 */
export async function getFromIPFS(cid) {
    const response = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`);

    if (!response.ok) {
        throw new Error(`Failed to fetch from IPFS: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer);
}

/**
 * Check if a CID exists on Pinata
 * @param {string} cid - IPFS CID to check
 * @returns {Promise<boolean>}
 */
export async function checkIPFSExists(cid) {
    try {
        const response = await fetch(`${PINATA_API_URL}/data/pinList?hashContains=${cid}`, {
            headers: {
                'Authorization': `Bearer ${process.env.PINATA_JWT}`
            }
        });

        const result = await response.json();
        return result.count > 0;
    } catch (error) {
        console.error('Error checking IPFS:', error);
        return false;
    }
}

export default {
    uploadToIPFS,
    getFromIPFS,
    checkIPFSExists
};
