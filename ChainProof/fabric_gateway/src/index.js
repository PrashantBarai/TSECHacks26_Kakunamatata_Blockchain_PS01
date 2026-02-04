/**
 * Fabric Gateway Service - Main Entry Point
 * 
 * Connects to Hyperledger Fabric network and exposes REST API
 * for chaincode invocation
 * 
 * Port: 5000
 */

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const chaincodeRoutes = require('./routes/chaincode');
const { initializeGateway, closeGateway } = require('./services/fabric');
const config = require('./config');
const logger = require('./utils/logger');

const app = express();
const PORT = config.port;

// Middleware
app.use(cors({
    origin: [config.frontendUrl, config.backendUrl],
    credentials: true
}));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
    logger.debug(`${req.method} ${req.path}`);
    next();
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'ChainProof Fabric Gateway',
        timestamp: new Date().toISOString(),
        fabric: {
            channel: config.channelName,
            chaincode: config.chaincodeName
        }
    });
});

// Chaincode routes
app.use('/api/fabric', chaincodeRoutes);

// Error handling
app.use((err, req, res, next) => {
    logger.error(`Error: ${err.message}`, { stack: err.stack });
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal Server Error'
    });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    logger.info('Shutting down...');
    await closeGateway();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('Shutting down...');
    await closeGateway();
    process.exit(0);
});

// Start server
const startServer = async () => {
    try {
        // Initialize Fabric Gateway connection
        logger.info('Connecting to Fabric network...');
        await initializeGateway();

        app.listen(PORT, () => {
            logger.info(`
╔═══════════════════════════════════════════════════════════╗
║         ChainProof Fabric Gateway Service                 ║
╠═══════════════════════════════════════════════════════════╣
║  Port:      ${PORT}                                           ║
║  Channel:   ${config.channelName.padEnd(42)}║
║  Chaincode: ${config.chaincodeName.padEnd(42)}║
║  Org:       ${config.defaultOrg.padEnd(42)}║
╚═══════════════════════════════════════════════════════════╝
            `);
        });
    } catch (error) {
        logger.error(`Failed to start Fabric Gateway: ${error.message}`);
        process.exit(1);
    }
};

startServer();

module.exports = app;
