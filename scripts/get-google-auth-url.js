/**
 * Script to get Google Drive authorization URL
 * Run: node scripts/get-google-auth-url.js
 * Then open the URL in your browser
 */

require('dotenv').config();
const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_DRIVE_CLIENT_ID,
    process.env.GOOGLE_DRIVE_CLIENT_SECRET,
    'http://localhost:3001/auth/google/callback'
);

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
});

console.log('\n========================================');
console.log('GOOGLE DRIVE AUTHORIZATION');
console.log('========================================\n');
console.log('1. Make sure your server is running on port 3001');
console.log('2. Open this URL in your browser:\n');
console.log(authUrl);
console.log('\n3. Login and authorize the application');
console.log('4. You will be redirected to a page showing your tokens');
console.log('5. Copy the tokens and add them to your .env file\n');
console.log('========================================\n');
