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

    // Organizations with local paths
    orgs: {
        WhistleblowersOrg: {
            mspId: 'WhistleblowersOrgMSP',
            peerEndpoint: 'grpc://whistleblowersorgpeer-api.127-0-0-1.nip.io:7070',
            // Connection profile from _gateways
            connectionProfilePath: path.join(gatewaysBasePath, 'whistleblowersorggateway.json'),
            // MSP credentials
            certPath: path.join(mspBasePath, 'WhistleblowersOrg/whistleblowersorgadmin/msp/signcerts/cert.pem'),
            keyPath: path.join(mspBasePath, 'WhistleblowersOrg/whistleblowersorgadmin/msp/keystore/cert_sk')
        },
        VerifierOrg: {
            mspId: 'VerifierOrgMSP',
            peerEndpoint: 'grpc://verifierorgpeer-api.127-0-0-1.nip.io:7070',
            connectionProfilePath: path.join(gatewaysBasePath, 'verifierorggateway.json'),
            certPath: path.join(mspBasePath, 'VerifierOrg/verifierorgadmin/msp/signcerts/cert.pem'),
            keyPath: path.join(mspBasePath, 'VerifierOrg/verifierorgadmin/msp/keystore/cert_sk')
        },
        LegalOrg: {
            mspId: 'LegalOrgMSP',
            peerEndpoint: 'grpc://legalorgpeer-api.127-0-0-1.nip.io:7070',
            connectionProfilePath: path.join(gatewaysBasePath, 'legalorggateway.json'),
            certPath: path.join(mspBasePath, 'LegalOrg/legalorgadmin/msp/signcerts/cert.pem'),
            keyPath: path.join(mspBasePath, 'LegalOrg/legalorgadmin/msp/keystore/cert_sk')
        }
    },

    // Default organization
    defaultOrg: process.env.DEFAULT_ORG || 'WhistleblowersOrg',

    // CORS
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:7000',
    backendUrl: process.env.BACKEND_URL || 'http://localhost:4000'
};

module.exports = config;
