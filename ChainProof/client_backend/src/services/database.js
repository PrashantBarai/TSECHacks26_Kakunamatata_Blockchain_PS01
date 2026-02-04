/**
 * MongoDB Database Connection
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chainproof';

export async function connectDatabase() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');
        return true;
    } catch (error) {
        console.error('MongoDB connection error:', error);
        return false;
    }
}

export async function disconnectDatabase() {
    await mongoose.disconnect();
}

export default {
    connectDatabase,
    disconnectDatabase
};
