/**
 * User Model for Verifier and Legal Organization Staff
 * 
 * Stores verified users who can login and receive evidence assignments
 */

import mongoose from 'mongoose';
import crypto from 'crypto';

const userSchema = new mongoose.Schema({
    // User's display name
    name: {
        type: String,
        required: true,
        trim: true
    },

    // SHA-256 hash of Aadhaar number (never store raw Aadhaar)
    aadhaarHash: {
        type: String,
        required: true,
        unique: true
    },

    // Unique public key hash derived from name + aadhaar
    // This is used for evidence assignment and login
    publicKeyHash: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    // Organization: VerifierOrg or LegalOrg
    organization: {
        type: String,
        required: true,
        enum: ['VerifierOrg', 'LegalOrg']
    },

    // Role within Legal Organization (e.g. Judge, Advocate)
    legalRole: {
        type: String,
        enum: ['Judge', 'Advocate', 'Clerk', 'Notary', 'Prosecutor', 'Police', 'Other'],
        required: function () { return this.organization === 'LegalOrg'; }
    },

    // Staff role within org
    role: {
        type: String,
        default: 'member',
        enum: ['admin', 'senior', 'member']
    },

    // Account status
    status: {
        type: String,
        default: 'active',
        enum: ['active', 'suspended', 'pending']
    },

    // Stats
    evidenceAssigned: {
        type: Number,
        default: 0
    },
    evidenceProcessed: {
        type: Number,
        default: 0
    },

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLoginAt: {
        type: Date
    }
});

// Static method to generate hashes from name + aadhaar
userSchema.statics.generateHashes = function (name, aadhaar) {
    // Normalize inputs
    const normalizedName = name.toLowerCase().trim();
    const normalizedAadhaar = aadhaar.replace(/\s/g, '').trim();

    // Hash aadhaar separately (for security)
    const aadhaarHash = crypto
        .createHash('sha256')
        .update(normalizedAadhaar)
        .digest('hex');

    // Generate public key hash from combination
    // This creates a unique identifier tied to both name and aadhaar
    const publicKeyHash = crypto
        .createHash('sha256')
        .update(normalizedName + ':' + normalizedAadhaar + ':chainproof')
        .digest('hex');

    return { aadhaarHash, publicKeyHash };
};

// Static method to verify login credentials
userSchema.statics.verifyCredentials = async function (name, aadhaar) {
    const { aadhaarHash, publicKeyHash } = this.generateHashes(name, aadhaar);

    const user = await this.findOne({ publicKeyHash });

    if (!user) {
        return { valid: false, error: 'User not found' };
    }

    if (user.aadhaarHash !== aadhaarHash) {
        return { valid: false, error: 'Invalid credentials' };
    }

    if (user.status !== 'active') {
        return { valid: false, error: 'Account is ' + user.status };
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    return { valid: true, user };
};

// Static method to register new user
userSchema.statics.registerUser = async function (name, aadhaar, organization, role = 'member', legalRole = null) {
    const { aadhaarHash, publicKeyHash } = this.generateHashes(name, aadhaar);

    // Check if already exists
    const existing = await this.findOne({
        $or: [{ publicKeyHash }, { aadhaarHash }]
    });

    if (existing) {
        throw new Error('User with this Aadhaar already registered');
    }

    const user = new this({
        name,
        aadhaarHash,
        publicKeyHash,
        organization,
        role,
        legalRole
    });

    await user.save();

    return {
        name: user.name,
        publicKeyHash: user.publicKeyHash,
        organization: user.organization,
        role: user.role
    };
};

// Method to get safe user data (no sensitive fields)
userSchema.methods.toSafeObject = function () {
    return {
        id: this._id,
        name: this.name,
        publicKeyHash: this.publicKeyHash,
        organization: this.organization,
        role: this.role,
        legalRole: this.legalRole,
        status: this.status,
        evidenceAssigned: this.evidenceAssigned,
        evidenceProcessed: this.evidenceProcessed,
        createdAt: this.createdAt,
        lastLoginAt: this.lastLoginAt
    };
};

const User = mongoose.model('User', userSchema);

export default User;
