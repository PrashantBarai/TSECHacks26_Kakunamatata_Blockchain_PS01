/**
 * ChainProof Backend - Main Entry Point
 * 
 * Express server for whistleblowing platform with:
 * - Pinata IPFS integration
 * - Metadata stripping
 * - Fabric chaincode invocation
 * - Sepolia anchoring
 * - PDF audit report generation
 * - Verifier/Legal authentication
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import evidenceRoutes from './routes/evidence.js';
import verifyRoutes from './routes/verify.js';
import legalRoutes from './routes/legal.js';
import authRoutes from './routes/auth.js';
import { connectDatabase } from './services/database.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:7000',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'ChainProof Backend',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// API Routes
app.use('/api/evidence', evidenceRoutes);
app.use('/api/verify', verifyRoutes);
app.use('/api/legal', legalRoutes);
app.use('/api/auth', authRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    console.error(err.stack);

    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// Start server with database connection
async function startServer() {
    // Connect to MongoDB
    const dbConnected = await connectDatabase();
    if (!dbConnected) {
        console.warn('Warning: MongoDB not connected. Auth features may not work.');
    }

    app.listen(PORT, () => {
        console.log(`
╔═══════════════════════════════════════════════════════════╗
║           ChainProof Backend Server Started               ║
╠═══════════════════════════════════════════════════════════╣
║  Port:        ${PORT}                                          ║
║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(40)}║
║  Frontend:    ${(process.env.FRONTEND_URL || 'http://localhost:7000').padEnd(40)}║
║  MongoDB:     ${dbConnected ? 'Connected'.padEnd(40) : 'Not Connected'.padEnd(40)}║
╚═══════════════════════════════════════════════════════════╝
    `);
    });
}

startServer();

export default app;
