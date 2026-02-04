/**
 * Extract identities from Microfab and save to wallet
 * 
 * Microfab provides pre-enrolled identities via its REST API
 * No CA enrollment needed - just extract and save to wallet
 */

const { Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');
const https = require('http');
const config = require('./config');
const logger = require('./utils/logger');

const MICROFAB_API = 'http://localhost:7070/ak/api/v1/components';

/**
 * Fetch components from Microfab API
 */
async function fetchMicrofabComponents() {
    return new Promise((resolve, reject) => {
        https.get(MICROFAB_API, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

/**
 * Get or create wallet
 */
async function getWallet() {
    const walletPath = config.walletPath;
    if (!fs.existsSync(walletPath)) {
        fs.mkdirSync(walletPath, { recursive: true });
    }
    return await Wallets.newFileSystemWallet(walletPath);
}

/**
 * Extract identity from Microfab and save to wallet
 */
async function extractIdentity(components, displayName, orgName, mspId) {
    const wallet = await getWallet();
    const identityLabel = `${orgName}-admin`;

    // Check if already exists
    const existing = await wallet.get(identityLabel);
    if (existing) {
        logger.info(`✓ ${orgName} admin identity already in wallet`);
        return true;
    }

    // Find the identity in components
    const identity = components.find(c =>
        c.type === 'identity' &&
        c.display_name === displayName
    );

    if (!identity) {
        logger.error(`✗ Identity not found: ${displayName}`);
        return false;
    }

    try {
        // Decode base64 cert and key
        const cert = Buffer.from(identity.cert, 'base64').toString('utf8');
        const key = Buffer.from(identity.private_key, 'base64').toString('utf8');

        // Create X.509 identity
        const x509Identity = {
            credentials: {
                certificate: cert,
                privateKey: key
            },
            mspId: mspId,
            type: 'X.509'
        };

        await wallet.put(identityLabel, x509Identity);
        logger.info(`✓ Extracted and saved ${orgName} admin identity`);
        return true;

    } catch (error) {
        logger.error(`✗ Failed to extract ${orgName}: ${error.message}`);
        return false;
    }
}

/**
 * Main enrollment function
 */
async function enrollAllAdmins() {
    logger.info('╔═══════════════════════════════════════════════════════════╗');
    logger.info('║     Extracting Identities from Microfab                   ║');
    logger.info('╚═══════════════════════════════════════════════════════════╝');

    try {
        // Fetch all components from Microfab
        logger.info('Fetching components from Microfab...');
        const components = await fetchMicrofabComponents();
        logger.info(`Found ${components.length} components`);

        // Extract each org's admin identity
        const orgs = [
            { displayName: 'WhistleblowersOrg Admin', orgName: 'WhistleblowersOrg', mspId: 'WhistleblowersOrgMSP' },
            { displayName: 'VerifierOrg Admin', orgName: 'VerifierOrg', mspId: 'VerifierOrgMSP' },
            { displayName: 'LegalOrg Admin', orgName: 'LegalOrg', mspId: 'LegalOrgMSP' }
        ];

        for (const org of orgs) {
            await extractIdentity(components, org.displayName, org.orgName, org.mspId);
        }

        logger.info('');
        logger.info('╔═══════════════════════════════════════════════════════════╗');
        logger.info('║              Identity Extraction Complete                  ║');
        logger.info('╚═══════════════════════════════════════════════════════════╝');

        // List wallet contents
        const wallet = await getWallet();
        const identities = await wallet.list();
        logger.info(`Wallet contains: ${identities.join(', ')}`);

    } catch (error) {
        logger.error(`Failed to fetch from Microfab: ${error.message}`);
        logger.error('Make sure Microfab is running on http://localhost:7070');
        process.exit(1);
    }
}

enrollAllAdmins();
