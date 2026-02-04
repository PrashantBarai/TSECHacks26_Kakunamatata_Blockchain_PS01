/**
 * Metadata Stripping Service
 * 
 * Strips EXIF, GPS, author data from files before upload
 * Uses exiftool-vendored for comprehensive metadata removal
 */

import { exiftool } from 'exiftool-vendored';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

/**
 * Strip all identifying metadata from a file
 * @param {Buffer} fileBuffer - Original file buffer
 * @param {string} fileName - Original filename
 * @returns {Promise<{buffer: Buffer, removedMetadata: Object}>}
 */
export async function stripMetadata(fileBuffer, fileName) {
    // Create temp directory for processing
    const tempDir = path.join(os.tmpdir(), 'chainproof-' + uuidv4());
    await fs.mkdir(tempDir, { recursive: true });

    const inputPath = path.join(tempDir, fileName);
    const outputPath = path.join(tempDir, 'stripped_' + fileName);

    try {
        // Write buffer to temp file
        await fs.writeFile(inputPath, fileBuffer);

        // Read original metadata
        const originalMetadata = await exiftool.read(inputPath);

        // Extract potentially identifying metadata
        const removedMetadata = {
            gps: {
                latitude: originalMetadata.GPSLatitude,
                longitude: originalMetadata.GPSLongitude,
                altitude: originalMetadata.GPSAltitude
            },
            camera: {
                make: originalMetadata.Make,
                model: originalMetadata.Model,
                serialNumber: originalMetadata.SerialNumber
            },
            author: {
                artist: originalMetadata.Artist,
                creator: originalMetadata.Creator,
                author: originalMetadata.Author,
                copyright: originalMetadata.Copyright
            },
            software: {
                software: originalMetadata.Software,
                hostComputer: originalMetadata.HostComputer
            },
            dates: {
                createDate: originalMetadata.CreateDate,
                modifyDate: originalMetadata.ModifyDate,
                dateTimeOriginal: originalMetadata.DateTimeOriginal
            }
        };

        // Strip all metadata (write to new file)
        await exiftool.write(inputPath, {
            // Remove GPS data
            GPSLatitude: null,
            GPSLongitude: null,
            GPSAltitude: null,
            GPSLatitudeRef: null,
            GPSLongitudeRef: null,

            // Remove author info
            Artist: null,
            Creator: null,
            Author: null,
            Copyright: null,

            // Remove device info
            Make: null,
            Model: null,
            SerialNumber: null,
            Software: null,
            HostComputer: null,

            // Remove date info (optional - keep if needed for evidence)
            // CreateDate: null,
            // ModifyDate: null,
        }, ['-overwrite_original']);

        // Read the stripped file
        const strippedBuffer = await fs.readFile(inputPath);

        // Log what was removed (for audit purposes)
        console.log('Metadata stripped:', {
            fileName,
            removedFields: Object.keys(removedMetadata).length,
            hadGPS: !!(originalMetadata.GPSLatitude || originalMetadata.GPSLongitude)
        });

        return {
            buffer: strippedBuffer,
            removedMetadata,
            hadIdentifyingData: !!(
                originalMetadata.GPSLatitude ||
                originalMetadata.Artist ||
                originalMetadata.Make ||
                originalMetadata.Author
            )
        };

    } finally {
        // Cleanup temp files
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch (e) {
            console.error('Failed to cleanup temp dir:', e);
        }
    }
}

/**
 * Get metadata from a file without stripping
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} fileName - Filename
 * @returns {Promise<Object>}
 */
export async function getMetadata(fileBuffer, fileName) {
    const tempPath = path.join(os.tmpdir(), `metadata-check-${uuidv4()}-${fileName}`);

    try {
        await fs.writeFile(tempPath, fileBuffer);
        const metadata = await exiftool.read(tempPath);
        return metadata;
    } finally {
        try {
            await fs.unlink(tempPath);
        } catch (e) {
            // Ignore cleanup errors
        }
    }
}

/**
 * Close exiftool process (call on server shutdown)
 */
export async function closeMetadataService() {
    await exiftool.end();
}

export default {
    stripMetadata,
    getMetadata,
    closeMetadataService
};
