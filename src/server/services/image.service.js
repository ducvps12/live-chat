const ImageModel = require('../models/Image.model');
const imageRepo = require('../repos/image.repo');
const AppError = require('../utils/AppError');

/**
 * Image Service
 * Coordinates MongoDB and SQL Server for hybrid image storage
 */

/**
 * Upload image to MongoDB and save metadata to SQL Server
 * @param {Buffer} buffer - Image file buffer
 * @param {string} filename - Original filename
 * @param {string} mimeType - MIME type (e.g., 'image/jpeg')
 * @param {number} userId - User ID who uploaded the image
 * @returns {Promise<{imageId, mongoId, url}>}
 */
const uploadImage = async (buffer, filename, mimeType, userId) => {
    try {
        // Convert buffer to base64
        const base64 = buffer.toString('base64');
        const size = buffer.length;

        // Save to MongoDB
        const mongoImage = new ImageModel({
            filename,
            base64,
            mimeType,
            size,
            uploadedBy: userId,
        });

        await mongoImage.save();

        // Save metadata to SQL Server
        const sqlImage = await imageRepo.createImage({
            filename,
            mongoDbId: mongoImage._id.toString(),
            userId,
            fileSize: size,
            mimeType,
        });

        // Return image URL (data URI format for immediate use)
        const dataUri = `data:${mimeType};base64,${base64}`;

        return {
            imageId: sqlImage.ImageId,
            mongoId: mongoImage._id.toString(),
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
        // Get metadata from SQL
        const metadata = await imageRepo.findById(imageId);
        if (!metadata) {
            throw new AppError('Image not found', 404);
        }

        // Get image data from MongoDB
        const mongoImage = await ImageModel.findById(metadata.MongoDbId);
        if (!mongoImage) {
            throw new AppError('Image data not found in MongoDB', 404);
        }

        // Return as data URI
        const dataUri = `data:${mongoImage.mimeType};base64,${mongoImage.base64}`;

        return {
            filename: mongoImage.filename,
            mimeType: mongoImage.mimeType,
            base64: mongoImage.base64,
            dataUri,
        };
    } catch (error) {
        console.error('Error getting image:', error);
        throw new AppError(`Failed to get image: ${error.message}`, 500);
    }
};

/**
 * Delete image from both MongoDB and SQL Server
 * @param {number} imageId - SQL image ID
 */
const deleteImage = async (imageId) => {
    try {
        // Get metadata to find MongoDB ID
        const metadata = await imageRepo.findById(imageId);
        if (!metadata) {
            throw new AppError('Image not found', 404);
        }

        // Delete from MongoDB
        await ImageModel.findByIdAndDelete(metadata.MongoDbId);

        // Delete from SQL Server
        await imageRepo.deleteById(imageId);
    } catch (error) {
        console.error('Error deleting image:', error);
        throw new AppError(`Failed to delete image: ${error.message}`, 500);
    }
};

/**
 * Search images by filename
 * @param {string} query - Search query
 * @returns {Promise<Array>}
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
 * @param {number} userId - User ID
 * @param {number} limit - Number of images to return
 * @returns {Promise<Array>}
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
