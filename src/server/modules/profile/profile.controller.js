const profileService = require('./profile.service');
const asyncHandler = require('../../utils/asyncHandler');

const getProfile = asyncHandler(async (req, res) => {
    const profile = await profileService.getProfile(req.user.UserKey);
    res.status(200).json({ status: 'success', data: profile });
});

const updateProfile = asyncHandler(async (req, res) => {
    const profile = await profileService.updateProfile(req.user.UserKey, req.body);
    res.status(200).json({ status: 'success', data: profile });
});

const uploadAvatar = asyncHandler(async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ status: 'error', message: 'No file provided' });
    }

    const result = await profileService.uploadAvatar(req.user.UserKey, req.file);
    res.status(200).json({ status: 'success', data: result });
});

module.exports = {
    getProfile,
    updateProfile,
    uploadAvatar
};
