const imageRepo = require('../repos/image.repo');
const AppError = require('../utils/AppError');
const { getPool } = require('../infra/mysql/mysql');

/**
 * Image Service
 * Uses MySQL for image storage (base64 data stored in MySQL)
 */

/**
 * Upload image and save to MySQL
 * @param {Buffer} buffer - Image file buffer
 * @param {string} filename - Original filename
 * @param {string} mimeType - MIME type (e.g., 'image/jpeg')
 * @param {number} userId - User ID who uploaded the image
 * @returns {Promise<{imageId, url}>}
 */
const uploadImage = async (buffer, filename, mimeType, userId) => {
    try {
        const base64 = buffer.toString('base64');
        const size = buffer.length;

        // Save metadata to MySQL
        const sqlImage = await imageRepo.createImage({
            filename,
            mongoDbId: null, // No longer using MongoDB
            userId,
            fileSize: size,
            mimeType,
        });

        // Store base64 data in MySQL (iam_ImageData table or inline)
        const pool = getPool();
        try {
            await pool.execute(
                'UPDATE iam_Images SET Base64Data = ? WHERE ImageKey = ?',
                [base64, sqlImage.ImageKey || sqlImage.imageKey]
            );
        } catch (e) {
            // Base64Data column may not exist yet — ignore gracefully
            console.warn('[ImageService] Could not save base64 data:', e.message);
        }

        const dataUri = `data:${mimeType};base64,${base64}`;

        return {
            imageId: sqlImage.ImageId || sqlImage.imageId,
            url: dataUri,
            filename,
        };
    } catch (error) {
        console.error('Error uploading image:', error);
        throw new AppError(`Failed to upload image: ${error.message}`, 500);
    }
};

/**
 * Get image by SQL image ID
 * @param {number} imageId - SQL image ID
 * @returns {Promise<{filename, mimeType, base64, dataUri}>}
 */
const getImageById = async (imageId) => {
    try {
        const metadata = await imageRepo.findById(imageId);
        if (!metadata) {
            throw new AppError('Image not found', 404);
        }

        // Try to get base64 data from MySQL
        const pool = getPool();
        let base64 = null;
        try {
            const [rows] = await pool.execute(
                'SELECT Base64Data FROM iam_Images WHERE ImageId = ?',
                [imageId]
            );
            base64 = rows[0]?.Base64Data;
        } catch (e) {
            // Column may not exist
        }

        if (!base64) {
            throw new AppError('Image data not found', 404);
        }

        const dataUri = `data:${metadata.MimeType};base64,${base64}`;

        return {
            filename: metadata.Filename,
            mimeType: metadata.MimeType,
            base64,
            dataUri,
        };
    } catch (error) {
        if (error instanceof AppError) throw error;
        console.error('Error getting image:', error);
        throw new AppError(`Failed to get image: ${error.message}`, 500);
    }
};

/**
 * Delete image from MySQL
 * @param {number} imageId - SQL image ID
 */
const deleteImage = async (imageId) => {
    try {
        const metadata = await imageRepo.findById(imageId);
        if (!metadata) {
            throw new AppError('Image not found', 404);
        }

        await imageRepo.deleteById(imageId);
    } catch (error) {
        if (error instanceof AppError) throw error;
        console.error('Error deleting image:', error);
        throw new AppError(`Failed to delete image: ${error.message}`, 500);
    }
};

/**
 * Search images by filename
 */
const searchImages = async (query) => {
    try {
        const results = await imageRepo.searchByFilename(query);
        return results;
    } catch (error) {
        console.error('Error searching images:', error);
        throw new AppError(`Failed to search images: ${error.message}`, 500);
    }
};

/**
 * Get user's images
 */
const getUserImages = async (userId, limit = 50) => {
    try {
        const images = await imageRepo.findByUserId(userId, limit);
        return images;
    } catch (error) {
        console.error('Error getting user images:', error);
        throw new AppError(`Failed to get user images: ${error.message}`, 500);
    }
};

module.exports = {
    uploadImage,
    getImageById,
    deleteImage,
    searchImages,
    getUserImages,
};
