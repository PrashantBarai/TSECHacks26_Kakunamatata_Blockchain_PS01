/**
 * Fabric Network Service
 * 
 * Loads identities directly from local MSP files (no enrollment needed)
 * Uses fabric-network to connect to Hyperledger Fabric via Microfab
 */

const { Wallets, Gateway } = require('fabric-network');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');

// Connection state
let gateway = null;
let network = null;
let contracts = {};
let currentOrg = config.defaultOrg;

/**
 * Build connection profile for Microfab
 * Uses the gateway JSON files from _gateways directory
 */
function getConnectionProfile(orgName) {
    const org = config.orgs[orgName];
    if (!org) {
        throw new Error(`Unknown organization: ${orgName}`);
    }

    // Load connection profile from _gateways directory
    if (fs.existsSync(org.connectionProfilePath)) {
        const profile = JSON.parse(fs.readFileSync(org.connectionProfilePath, 'utf8'));

        // Add orderer to the profile (Microfab gateway files don't include it)
        profile.orderers = {
            'orderer-api.127-0-0-1.nip.io:7070': {
                url: 'grpc://orderer-api.127-0-0-1.nip.io:7070',
                grpcOptions: {
                    'grpc.ssl_target_name_override': 'orderer-api.127-0-0-1.nip.io'
                }
            }
        };

        // Add channel with orderer reference
        profile.channels = {
            [config.channelName]: {
                orderers: ['orderer-api.127-0-0-1.nip.io:7070'],
                peers: Object.keys(profile.peers).reduce((acc, peer) => {
                    acc[peer] = {
                        endorsingPeer: true,
                        chaincodeQuery: true,
                        ledgerQuery: true,
                        eventSource: true
                    };
                    return acc;
                }, {})
            }
        };

        logger.info(`Loaded connection profile from ${org.connectionProfilePath}`);
        return profile;
    }

    // Fallback: build connection profile dynamically
    logger.warn(`Connection profile not found at ${org.connectionProfilePath}, building dynamically`);
    return {
        name: `chainproof-network-${orgName}`,
        version: '1.0.0',
        client: {
            organization: orgName,
            connection: {
                timeout: {
                    peer: { endorser: '300' },
                    orderer: '300'
                }
            }
        },
        organizations: {
            [orgName]: {
                mspid: org.mspId,
                peers: [`${orgName.toLowerCase()}-peer`]
            }
        },
        peers: {
            [`${orgName.toLowerCase()}-peer`]: {
                url: org.peerEndpoint,
                grpcOptions: {
                    'ssl-target-name-override': `${orgName.toLowerCase()}peer`,
                    'grpc.keepalive_time_ms': 600000
                }
            }
        },
        orderers: {
            'orderer': {
                url: 'grpc://orderer-api.127-0-0-1.nip.io:7070',
                grpcOptions: {
                    'ssl-target-name-override': 'orderer'
                }
            }
        },
        channels: {
            [config.channelName]: {
                orderers: ['orderer'],
                peers: {
                    [`${orgName.toLowerCase()}-peer`]: {
                        endorsingPeer: true,
                        chaincodeQuery: true,
                        ledgerQuery: true,
                        eventSource: true
                    }
                }
            }
        }
    };
}

/**
 * Load identity from local wallet file (JSON)
 */
async function loadIdentityFromWallet(orgName) {
    const org = config.orgs[orgName];
    if (!org) {
        throw new Error(`Unknown organization: ${orgName}`);
    }

    const walletPath = org.walletPath;
    const identityName = org.identityName;
    const identityFile = path.join(walletPath, `${identityName}.id`);

    // Read identity from JSON file
    if (!fs.existsSync(identityFile)) {
        throw new Error(`Identity file not found: ${identityFile}`);
    }

    const identityContent = fs.readFileSync(identityFile, 'utf8');
    const identity = JSON.parse(identityContent);

    return identity;
}

/**
 * Initialize gateway connection
 */
async function initializeGateway(orgName = null) {
    if (orgName) {
        currentOrg = orgName;
    }

    const org = config.orgs[currentOrg];
    if (!org) {
        throw new Error(`Unknown organization: ${currentOrg}`);
    }

    logger.info(`Initializing Fabric Gateway for ${currentOrg}...`);

    try {
        // Create in-memory wallet with identity from local JSON file
        const wallet = await Wallets.newInMemoryWallet();
        const identity = await loadIdentityFromWallet(currentOrg);
        const identityLabel = `${currentOrg}-admin`;

        await wallet.put(identityLabel, identity);
        logger.info(`Loaded identity from wallet: ${org.walletPath}/${org.identityName}.id`);

        // Build connection profile
        const connectionProfile = getConnectionProfile(currentOrg);

        // Create gateway instance
        gateway = new Gateway();

        await gateway.connect(connectionProfile, {
            wallet,
            identity: identityLabel,
            discovery: { enabled: false, asLocalhost: false }
        });

        // Get network and contracts
        network = await gateway.getNetwork(config.channelName);

        contracts = {
            whistleblower: network.getContract(config.chaincodeName, 'WhistleblowerContract'),
            verifier: network.getContract(config.chaincodeName, 'VerifierContract'),
            legal: network.getContract(config.chaincodeName, 'LegalContract'),
            query: network.getContract(config.chaincodeName, 'QueryContract')
        };

        logger.info(`Connected to Fabric as ${currentOrg}`);
        return true;

    } catch (error) {
        logger.error(`Failed to connect to Fabric: ${error.message}`);
        throw error;
    }
}

/**
 * Switch organization context
 */
async function switchOrg(orgName) {
    await closeGateway();
    return await initializeGateway(orgName);
}

/**
 * Close gateway connection
 */
async function closeGateway() {
    if (gateway) {
        gateway.disconnect();
    }
    gateway = null;
    network = null;
    contracts = {};
    logger.info('Gateway connection closed');
}

/**
 * Get current organization
 */
function getCurrentOrg() {
    return currentOrg;
}

/**
 * Submit transaction (invoke)
 */
async function submitTransaction(contractName, functionName, ...args) {
    if (!contracts[contractName]) {
        throw new Error(`Contract not found: ${contractName}`);
    }

    logger.info(`Submitting: ${contractName}:${functionName}(${args.join(', ')})`);

    const result = await contracts[contractName].submitTransaction(functionName, ...args);

    return result.length > 0 ? JSON.parse(result.toString()) : null;
}

/**
 * Evaluate transaction (query)
 */
async function evaluateTransaction(contractName, functionName, ...args) {
    if (!contracts[contractName]) {
        throw new Error(`Contract not found: ${contractName}`);
    }

    logger.debug(`Evaluating: ${contractName}:${functionName}(${args.join(', ')})`);

    const result = await contracts[contractName].evaluateTransaction(functionName, ...args);

    return result.length > 0 ? JSON.parse(result.toString()) : null;
}

// ============================================================
// WHISTLEBLOWER CONTRACT FUNCTIONS
// ============================================================

async function submitEvidence(evidenceId, ipfsCid, fileHash, fileType, fileSize, category, publicKeyHash, signature) {
    return await submitTransaction('whistleblower', 'SubmitEvidence',
        evidenceId, ipfsCid, fileHash, fileType, String(fileSize), category, publicKeyHash, signature);
}

async function getNotifications(publicKeyHash) {
    return await evaluateTransaction('whistleblower', 'GetNotifications', publicKeyHash);
}

async function getReputation(publicKeyHash) {
    return await evaluateTransaction('whistleblower', 'GetReputation', publicKeyHash);
}

async function markNotificationRead(notificationId) {
    return await submitTransaction('whistleblower', 'MarkNotificationRead', notificationId);
}

async function updatePolygonAnchor(evidenceId, polygonTxHash) {
    return await submitTransaction('whistleblower', 'UpdatePolygonAnchor', evidenceId, polygonTxHash);
}

// ============================================================
// VERIFIER CONTRACT FUNCTIONS
// ============================================================

async function verifyIntegrity(evidenceId, computedHash, passed, rejectionComment) {
    return await submitTransaction('verifier', 'VerifyIntegrity',
        evidenceId, computedHash, String(passed), rejectionComment || '');
}

async function addVerificationNote(evidenceId, noteId, content, hashComparison) {
    return await submitTransaction('verifier', 'AddVerificationNote',
        evidenceId, noteId, content, hashComparison || '');
}

async function getVerificationNotes(evidenceId) {
    return await evaluateTransaction('verifier', 'GetVerificationNotes', evidenceId);
}

// ============================================================
// LEGAL CONTRACT FUNCTIONS
// ============================================================

async function reviewEvidence(evidenceId, complete) {
    return await submitTransaction('legal', 'ReviewEvidence', evidenceId, String(complete));
}

async function addLegalComment(evidenceId, commentId, content, courtReadiness, recommendation) {
    return await submitTransaction('legal', 'AddLegalComment',
        evidenceId, commentId, content, courtReadiness, recommendation);
}

async function getLegalComments(evidenceId) {
    return await evaluateTransaction('legal', 'GetLegalComments', evidenceId);
}

async function exportEvidence(evidenceId) {
    return await submitTransaction('legal', 'ExportEvidence', evidenceId);
}

// ============================================================
// QUERY CONTRACT FUNCTIONS
// ============================================================

async function getEvidence(evidenceId) {
    return await evaluateTransaction('query', 'GetEvidence', evidenceId);
}

async function getEvidenceHistory(evidenceId) {
    return await evaluateTransaction('query', 'GetEvidenceHistory', evidenceId);
}

async function queryEvidenceByStatus(status, pageSize, bookmark) {
    return await evaluateTransaction('query', 'QueryEvidenceByStatus', status, String(pageSize), bookmark || '');
}

async function queryEvidenceByCategory(category, pageSize, bookmark) {
    return await evaluateTransaction('query', 'QueryEvidenceByCategory', category, String(pageSize), bookmark || '');
}

module.exports = {
    initializeGateway,
    switchOrg,
    closeGateway,
    getCurrentOrg,
    loadIdentityFromMSP,
    submitTransaction,
    evaluateTransaction,
    // Whistleblower
    submitEvidence,
    getNotifications,
    getReputation,
    markNotificationRead,
    updatePolygonAnchor,
    // Verifier
    verifyIntegrity,
    addVerificationNote,
    getVerificationNotes,
    // Legal
    reviewEvidence,
    addLegalComment,
    getLegalComments,
    exportEvidence,
    // Query
    getEvidence,
    getEvidenceHistory,
    queryEvidenceByStatus,
    queryEvidenceByCategory
};
