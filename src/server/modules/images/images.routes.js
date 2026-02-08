const express = require('express');
const router = express.Router();
const imageService = require('../../services/image.service');
const asyncHandler = require('../../utils/asyncHandler');

/**
 * Get image by ID
 * GET /api/images/:imageId
 */
router.get('/:imageId', asyncHandler(async (req, res) => {
    const { imageId } = req.params;

    const image = await imageService.getImageById(parseInt(imageId));

    // Return image as data URI
    res.json({
        status: 'success',
        data: {
            dataUri: image.dataUri,
            filename: image.filename,
            mimeType: image.mimeType,
        }
    });
}));

module.exports = router;
