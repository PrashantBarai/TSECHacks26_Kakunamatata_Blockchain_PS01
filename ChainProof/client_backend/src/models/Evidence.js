import mongoose from 'mongoose';

const evidenceSchema = new mongoose.Schema({
    evidenceId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    transactionHash: {
        type: String,
        required: false
    },
    ipfsCid: {
        type: String,
        required: true
    },
    submittedBy: {
        type: String, // Public Key Hash (Anonymous ID)
        required: true
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    organization: {
        type: String,
        default: 'WhistleblowersOrg' // Origin organization
    },
    targetLegalRole: {
        type: String,
        default: null
    },
    status: {
        type: String,
        enum: ['SUBMITTED', 'VERIFIED', 'REJECTED', 'UNDER_REVIEW', 'REVIEWED', 'EXPORTED'],
        default: 'SUBMITTED'
    },
    description: {
        type: String, // Mirror of on-chain description for easier querying
        default: ''
    },
    comments: [{
        text: String,
        createdAt: { type: Date, default: Date.now },
        author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

export default mongoose.model('Evidence', evidenceSchema);
