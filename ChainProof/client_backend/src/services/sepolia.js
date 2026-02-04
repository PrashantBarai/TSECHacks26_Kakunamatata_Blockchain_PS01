/**
 * Sepolia Blockchain Service
 * 
 * Handles anchoring evidence hashes to Sepolia testnet
 * using the ChainProofAnchor smart contract
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

// ChainProofAnchor contract ABI (only the functions we need)
const ANCHOR_ABI = [
    'function anchorHash(bytes32 evidenceId, bytes32 fileHash) external',
    'function getAnchor(bytes32 evidenceId) external view returns (bytes32 fileHash, uint256 timestamp, address submitter)',
    'function verifyHash(bytes32 evidenceId, bytes32 fileHashToVerify) external view returns (bool valid, bytes32 storedHash, uint256 anchorTimestamp)',
    'function isAnchored(bytes32 evidenceId) external view returns (bool)',
    'event HashAnchored(bytes32 indexed evidenceId, bytes32 indexed fileHash, uint256 timestamp, address submitter)'
];

let provider = null;
let signer = null;
let contract = null;

/**
 * Initialize Sepolia connection
 */
function initializeSepolia() {
    if (!process.env.SEPOLIA_RPC_URL) {
        console.warn('Warning: SEPOLIA_RPC_URL not configured');
        return false;
    }

    if (!process.env.ANCHOR_CONTRACT_ADDRESS) {
        console.warn('Warning: ANCHOR_CONTRACT_ADDRESS not configured - deploy contract first');
        return false;
    }

    try {
        provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);

        if (process.env.DEPLOYER_PRIVATE_KEY) {
            signer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
            contract = new ethers.Contract(process.env.ANCHOR_CONTRACT_ADDRESS, ANCHOR_ABI, signer);
        } else {
            // Read-only mode
            contract = new ethers.Contract(process.env.ANCHOR_CONTRACT_ADDRESS, ANCHOR_ABI, provider);
        }

        console.log('Sepolia connection initialized');
        return true;
    } catch (error) {
        console.error('Failed to initialize Sepolia:', error);
        return false;
    }
}

/**
 * Convert string to bytes32
 * @param {string} str - String to convert
 * @returns {string} bytes32 hex string
 */
function stringToBytes32(str) {
    return ethers.keccak256(ethers.toUtf8Bytes(str));
}

/**
 * Anchor evidence hash to Sepolia
 * @param {string} evidenceId - Evidence ID string
 * @param {string} fileHash - SHA256 hash of file
 * @returns {Promise<{txHash: string, blockNumber: number, timestamp: number}>}
 */
export async function anchorToSepolia(evidenceId, fileHash) {
    if (!contract || !signer) {
        initializeSepolia();
    }

    if (!signer) {
        throw new Error('Sepolia not configured for write operations - add DEPLOYER_PRIVATE_KEY');
    }

    const evidenceIdBytes = stringToBytes32(evidenceId);
    const fileHashBytes = fileHash.startsWith('0x') ? fileHash : '0x' + fileHash;

    // Pad to bytes32 if needed
    const paddedFileHash = ethers.zeroPadValue(fileHashBytes, 32);

    console.log(`Anchoring evidence ${evidenceId} to Sepolia...`);

    const tx = await contract.anchorHash(evidenceIdBytes, paddedFileHash);
    const receipt = await tx.wait();

    console.log(`Anchored! TX: ${receipt.hash}`);

    return {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        timestamp: Date.now(),
        explorerUrl: `https://sepolia.etherscan.io/tx/${receipt.hash}`
    };
}

/**
 * Get anchor details from Sepolia
 * @param {string} evidenceId - Evidence ID
 * @returns {Promise<{fileHash: string, timestamp: number, submitter: string}>}
 */
export async function getAnchor(evidenceId) {
    if (!contract) {
        initializeSepolia();
    }

    if (!contract) {
        throw new Error('Sepolia not configured');
    }

    const evidenceIdBytes = stringToBytes32(evidenceId);

    try {
        const [fileHash, timestamp, submitter] = await contract.getAnchor(evidenceIdBytes);

        return {
            fileHash: fileHash,
            timestamp: Number(timestamp),
            submitter: submitter,
            anchoredAt: new Date(Number(timestamp) * 1000).toISOString()
        };
    } catch (error) {
        if (error.message.includes('Evidence not found')) {
            return null;
        }
        throw error;
    }
}

/**
 * Verify hash against Sepolia anchor
 * @param {string} evidenceId - Evidence ID
 * @param {string} fileHash - Hash to verify
 * @returns {Promise<{valid: boolean, storedHash: string, anchorTimestamp: number}>}
 */
export async function verifyAnchor(evidenceId, fileHash) {
    if (!contract) {
        initializeSepolia();
    }

    if (!contract) {
        throw new Error('Sepolia not configured');
    }

    const evidenceIdBytes = stringToBytes32(evidenceId);
    const fileHashBytes = fileHash.startsWith('0x') ? fileHash : '0x' + fileHash;
    const paddedFileHash = ethers.zeroPadValue(fileHashBytes, 32);

    const [valid, storedHash, anchorTimestamp] = await contract.verifyHash(evidenceIdBytes, paddedFileHash);

    return {
        valid,
        storedHash,
        anchorTimestamp: Number(anchorTimestamp),
        anchoredAt: new Date(Number(anchorTimestamp) * 1000).toISOString()
    };
}

/**
 * Check if evidence is anchored
 * @param {string} evidenceId - Evidence ID
 * @returns {Promise<boolean>}
 */
export async function isAnchored(evidenceId) {
    if (!contract) {
        initializeSepolia();
    }

    if (!contract) {
        return false;
    }

    const evidenceIdBytes = stringToBytes32(evidenceId);
    return await contract.isAnchored(evidenceIdBytes);
}

// Initialize on module load
initializeSepolia();

export default {
    anchorToSepolia,
    getAnchor,
    verifyAnchor,
    isAnchored
};
