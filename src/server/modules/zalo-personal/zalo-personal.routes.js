/**
 * Zalo Personal Routes
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const zaloPersonalController = require('./zalo-personal.controller');
const zaloCrmController = require('./zalo-crm.controller');
const zaloAttachmentController = require('./zalo-attachment.controller');
const authenticate = require('../../middlewares/authenticate');

// Multer config for image upload (memory storage)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Only allow images
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    }
});

// All routes require authentication
router.use(authenticate);

// Generate QR code for login
router.post('/qr', zaloPersonalController.generateQR);
router.post('/qr/:workspaceId', zaloPersonalController.generateQR);

// Check login session status
router.get('/status/:sessionId', zaloPersonalController.checkStatus);

// Refresh QR code
router.post('/refresh/:sessionId', zaloPersonalController.refreshQR);

// Get connected accounts
router.get('/accounts/:workspaceId', zaloPersonalController.getAccounts);

// Check account connection status
router.get('/check/:workspaceId/:accountId', zaloPersonalController.checkConnection);

// Check workspace Zalo connection
router.get('/connection/:workspaceId', zaloAttachmentController.checkConnection);

// Update account (nickname)
router.patch('/accounts/:workspaceId/:accountId', zaloPersonalController.updateAccount);

// Disconnect account
router.delete('/accounts/:workspaceId/:accountId', zaloPersonalController.disconnectAccount);

// Image/Attachment Upload
router.post('/send-image', upload.single('image'), zaloAttachmentController.sendImage);

// Cookie Import Session (BotzaloNDQ pattern)
// POST /api/zalo-personal/import-session/:workspaceId
// Body: { cookie: J2TEAM JSON, imei?: string, userAgent?: string }
router.post('/import-session/:workspaceId', zaloPersonalController.importCookieSession);

// CRM Features (Templates, Leads, Auto-Reply)
router.use('/', zaloCrmController);

module.exports = router;
