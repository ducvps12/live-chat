const fs = require('fs');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');

// Configure storage
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueId = crypto.randomBytes(8).toString('hex');
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${uniqueId}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new AppError('File type not allowed', 400), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    }
});

/**
 * POST /api/embed/upload
 * Upload file for chat
 */
const uploadFile = asyncHandler(async (req, res) => {
    if (!req.file) {
        throw new AppError('No file uploaded', 400);
    }

    const { siteKey, visitorId } = req.body;

    if (!siteKey || !visitorId) {
        // Clean up file if validation fails
        fs.unlinkSync(req.file.path);
        throw new AppError('siteKey and visitorId are required', 400);
    }

    const file = req.file;
    const isImage = file.mimetype.startsWith('image/');

    // Build public URL
    const baseUrl = process.env.BACKEND_PUBLIC_URL || 'http://localhost:4000';
    const fileUrl = `${baseUrl}/uploads/${file.filename}`;

    res.status(200).json({
        status: 'success',
        data: {
            name: file.originalname,
            filename: file.filename,
            mimeType: file.mimetype,
            size: file.size,
            type: isImage ? 'image' : 'file',
            url: fileUrl
        }
    });
});

/**
 * Middleware for single file upload
 */
const uploadMiddleware = upload.single('file');

module.exports = {
    uploadFile,
    uploadMiddleware
};
