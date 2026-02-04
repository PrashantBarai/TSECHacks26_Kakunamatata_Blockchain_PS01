/**
 * Configuration for Fabric Network
 * Uses connection profiles and MSP files extracted from Microfab
 */

const path = require('path');
require('dotenv').config();

// Base paths (relative to project root)
const projectRoot = path.resolve(__dirname, '../..');
const mspBasePath = path.join(projectRoot, '_msp');
const gatewaysBasePath = path.join(projectRoot, '_gateways');

const config = {
    // Server
    port: process.env.PORT || 5000,
    nodeEnv: process.env.NODE_ENV || 'development',

    // Fabric Network
    channelName: process.env.FABRIC_CHANNEL || 'chainproof-channel',
    chaincodeName: process.env.FABRIC_CHAINCODE || 'chainproof',

    // Base paths
    mspBasePath,
    gatewaysBasePath,
    walletsBasePath: path.join(projectRoot, '_wallets'),

    // Organizations with local paths
    orgs: {
        WhistleblowersOrg: {
            mspId: 'WhistleblowersOrgMSP',
            peerEndpoint: 'grpc://whistleblowersorgpeer-api.127-0-0-1.nip.io:7070',
            connectionProfilePath: path.join(gatewaysBasePath, 'whistleblowersorggateway.json'),
            // Direct wallet path
            walletPath: path.join(projectRoot, '_wallets', 'WhistleblowersOrg'),
            identityName: 'whistleblowersorgadmin'
        },
        VerifierOrg: {
            mspId: 'VerifierOrgMSP',
            peerEndpoint: 'grpc://verifierorgpeer-api.127-0-0-1.nip.io:7070',
            connectionProfilePath: path.join(gatewaysBasePath, 'verifierorggateway.json'),
            walletPath: path.join(projectRoot, '_wallets', 'VerifierOrg'),
            identityName: 'verifierorgadmin'
        },
        LegalOrg: {
            mspId: 'LegalOrgMSP',
            peerEndpoint: 'grpc://legalorgpeer-api.127-0-0-1.nip.io:7070',
            connectionProfilePath: path.join(gatewaysBasePath, 'legalorggateway.json'),
            walletPath: path.join(projectRoot, '_wallets', 'LegalOrg'),
            identityName: 'legalorgadmin'
        }
    },

    // Default organization
    defaultOrg: process.env.DEFAULT_ORG || 'WhistleblowersOrg',

    // CORS
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:7000',
    backendUrl: process.env.BACKEND_URL || 'http://localhost:4000'
};

module.exports = config;
