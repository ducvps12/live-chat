const userRepo = require('../auth/repos/user.repo');
const AppError = require('../../utils/AppError');

const getProfile = async (userKey) => {
    const user = await userRepo.findById(userKey);
    if (!user) {
        throw new AppError('User not found', 404);
    }

    // Don't return sensitive fields
    const { PasswordHash, EmailVerificationToken, EmailVerificationExpiry, ...profileData } = user;
    return profileData;
};

const updateProfile = async (userKey, data) => {
    // Validate that at least one field is provided
    if (!data.firstName && !data.lastName && !data.language && !data.timezone) {
        throw new AppError('At least one field must be provided', 400);
    }

    await userRepo.updateProfile(userKey, data);

    // Return updated profile
    return await getProfile(userKey);
};

const uploadAvatar = async (userKey, file) => {
    const imageService = require('../../services/image.service');

    if (!file) {
        throw new AppError('No file provided', 400);
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
        throw new AppError('Invalid file type. Only images are allowed', 400);
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
        throw new AppError('File too large. Maximum size is 5MB', 400);
    }

    // Get user for metadata
    const user = await userRepo.findById(userKey);
    if (!user) {
        throw new AppError('User not found', 404);
    }

    try {
        // Upload image to MongoDB + SQL
        const { format } = require('date-fns');
        const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
        const filename = `${timestamp}_${user.Email}_${file.originalname}`;

        const result = await imageService.uploadImage(
            file.buffer,
            filename,
            file.mimetype,
            userKey
        );

        // Update user avatar with data URL
        await userRepo.updateAvatar(userKey, result.url);

        return {
            avatarUrl: result.url,
            imageId: result.imageId,
            filename: result.filename,
            storage: 'mongodb-sql'
        };
    } catch (error) {
        console.error('Avatar upload error:', error);
        throw new AppError(`Failed to upload avatar: ${error.message}`, 500);
    }
};

module.exports = {
    getProfile,
    updateProfile,
    uploadAvatar
};
