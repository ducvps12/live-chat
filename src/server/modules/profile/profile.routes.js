const express = require('express');
const router = express.Router();
const multer = require('multer');
const profileController = require('./profile.controller');
const authenticate = require('../../middlewares/authenticate');
const validate = require('../../middlewares/validate');
const schemas = require('./profile.validate');

// Configure multer for memory storage (files stored in memory as Buffer)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept images only
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed'), false);
        }
        cb(null, true);
    },
});

router.get('/', authenticate, profileController.getProfile);
router.patch('/', authenticate, validate(schemas.updateProfile), profileController.updateProfile);
router.post('/avatar', authenticate, upload.single('avatar'), profileController.uploadAvatar);

module.exports = router;
