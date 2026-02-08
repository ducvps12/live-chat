const mongoose = require('mongoose');

/**
 * MongoDB Image Schema
 * Stores images as base64 strings with metadata
 */
const imageSchema = new mongoose.Schema({
    filename: {
        type: String,
        required: true,
        index: true, // Index for fast file name search
    },
    base64: {
        type: String,
        required: true,
    },
    mimeType: {
        type: String,
        required: true,
    },
    size: {
        type: Number,
        required: true,
    },
    uploadedBy: {
        type: Number, // User ID from SQL Server
        required: true,
        index: true, // Index for user-based queries
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true, // Index for temporal queries
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

// Compound index for efficient user + date queries
imageSchema.index({ uploadedBy: 1, createdAt: -1 });

// Update the updatedAt timestamp before saving
imageSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

const Image = mongoose.model('Image', imageSchema);

module.exports = Image;
