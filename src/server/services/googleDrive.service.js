const { google } = require('googleapis');
const path = require('path');
const env = require('../config/env');
const { format } = require('date-fns');

/**
 * Google Drive Service
 * Handles file uploads to Google Drive using OAuth 2.0
 */

class GoogleDriveService {
    constructor() {
        this.oauth2Client = new google.auth.OAuth2(
            env.googleDrive?.clientId,
            env.googleDrive?.clientSecret,
            env.googleDrive?.redirectUri || 'http://localhost:3001/auth/google/callback'
        );

        // For development: Set access token manually
        // In production, implement proper OAuth flow
        if (env.googleDrive?.accessToken) {
            this.oauth2Client.setCredentials({
                access_token: env.googleDrive.accessToken,
                refresh_token: env.googleDrive.refreshToken,
            });
        }

        this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
    }

    /**
     * Upload file to Google Drive
     * @param {Buffer} fileBuffer - File buffer
     * @param {string} fileName - File name
     * @param {string} mimeType - File MIME type
     * @param {string} userEmail - User email for filename
     * @returns {Promise<{fileId: string, webViewLink: string, webContentLink: string}>}
     */
    async uploadFile(fileBuffer, fileName, mimeType, userEmail) {
        try {
            // Format filename: YYYY-MM-DD_HH-mm-ss_email@domain.com.ext
            const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
            const fileExtension = path.extname(fileName);
            const formattedFileName = `${timestamp}_${userEmail}${fileExtension}`;

            const fileMetadata = {
                name: formattedFileName,
                parents: [env.googleDrive.folderId],
            };

            const media = {
                mimeType: mimeType,
                body: require('stream').Readable.from(fileBuffer),
            };

            const response = await this.drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: 'id, webViewLink, webContentLink',
            });

            // Make file publicly accessible
            await this.drive.permissions.create({
                fileId: response.data.id,
                requestBody: {
                    role: 'reader',
                    type: 'anyone',
                },
            });

            // Get the direct download link
            const file = await this.drive.files.get({
                fileId: response.data.id,
                fields: 'webViewLink, webContentLink, thumbnailLink',
            });

            return {
                fileId: response.data.id,
                webViewLink: file.data.webViewLink,
                webContentLink: file.data.webContentLink,
                // Direct image URL for embedding
                directUrl: `https://drive.google.com/uc?export=view&id=${response.data.id}`,
            };
        } catch (error) {
            console.error('Google Drive upload error:', error);
            throw new Error(`Failed to upload to Google Drive: ${error.message}`);
        }
    }

    /**
     * Delete file from Google Drive
     * @param {string} fileId - Google Drive file ID
     */
    async deleteFile(fileId) {
        try {
            await this.drive.files.delete({
                fileId: fileId,
            });
        } catch (error) {
            console.error('Google Drive delete error:', error);
            throw new Error(`Failed to delete from Google Drive: ${error.message}`);
        }
    }
}

module.exports = new GoogleDriveService();
