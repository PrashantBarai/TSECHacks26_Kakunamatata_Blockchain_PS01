/**
 * Authentication Routes for Verifier and Legal Organization Staff
 * 
 * Endpoints:
 * - POST /api/auth/register - Register new verifier/legal staff
 * - POST /api/auth/login - Login with name + aadhaar
 * - GET /api/auth/me/:publicKeyHash - Get current user info
 * - GET /api/auth/users/:org - List users by organization
 */

import express from 'express';
import User from '../models/User.js';

const router = express.Router();

/**
 * POST /api/auth/register
 * Register a new verifier or legal staff member
 */
router.post('/register', async (req, res) => {
    try {
        const { name, aadhaar, organization, role } = req.body;

        // Validate required fields
        if (!name || !aadhaar || !organization) {
            return res.status(400).json({
                success: false,
                error: 'Name, Aadhaar, and organization are required'
            });
        }

        // Validate organization
        if (!['VerifierOrg', 'LegalOrg'].includes(organization)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid organization. Must be VerifierOrg or LegalOrg'
            });
        }

        // Validate Aadhaar format (12 digits)
        const cleanAadhaar = aadhaar.replace(/\s/g, '');
        if (!/^\d{12}$/.test(cleanAadhaar)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid Aadhaar format. Must be 12 digits.'
            });
        }

        // Register user
        const user = await User.registerUser(name, cleanAadhaar, organization, role);

        console.log(`Registered new ${organization} user: ${name} (${user.publicKeyHash.substring(0, 12)}...)`);

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            data: {
                name: user.name,
                publicKeyHash: user.publicKeyHash,
                organization: user.organization,
                role: user.role,
                // Give user a memorable key (first 8 chars of hash)
                loginKey: user.publicKeyHash.substring(0, 8).toUpperCase()
            }
        });

    } catch (error) {
        console.error('Registration error:', error.message);
        res.status(error.message.includes('already') ? 409 : 500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/auth/login
 * Login with name + aadhaar
 */
router.post('/login', async (req, res) => {
    try {
        const { name, aadhaar } = req.body;

        if (!name || !aadhaar) {
            return res.status(400).json({
                success: false,
                error: 'Name and Aadhaar are required'
            });
        }

        const cleanAadhaar = aadhaar.replace(/\s/g, '');
        const result = await User.verifyCredentials(name, cleanAadhaar);

        if (!result.valid) {
            return res.status(401).json({
                success: false,
                error: result.error
            });
        }

        console.log(`User logged in: ${result.user.name} (${result.user.organization})`);

        res.json({
            success: true,
            message: 'Login successful',
            data: result.user.toSafeObject()
        });

    } catch (error) {
        console.error('Login error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Login failed'
        });
    }
});

/**
 * GET /api/auth/me/:publicKeyHash
 * Get current user info by public key hash
 */
router.get('/me/:publicKeyHash', async (req, res) => {
    try {
        const user = await User.findOne({ publicKeyHash: req.params.publicKeyHash });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.json({
            success: true,
            data: user.toSafeObject()
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/auth/users/:org
 * List all users for an organization (for admin purposes)
 */
router.get('/users/:org', async (req, res) => {
    try {
        const org = req.params.org;

        if (!['VerifierOrg', 'LegalOrg'].includes(org)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid organization'
            });
        }

        const users = await User.find({
            organization: org,
            status: 'active'
        }).select('-aadhaarHash');

        res.json({
            success: true,
            data: users.map(u => u.toSafeObject())
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/auth/verify/:publicKeyHash
 * Quick verification if a user exists and is valid
 */
router.get('/verify/:publicKeyHash', async (req, res) => {
    try {
        const user = await User.findOne({
            publicKeyHash: req.params.publicKeyHash,
            status: 'active'
        });

        res.json({
            success: true,
            valid: !!user,
            organization: user?.organization || null
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
