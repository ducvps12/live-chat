/**
 * Script to generate Google OAuth tokens
 * Run: node scripts/generate-google-tokens.js
 */

const { google } = require('googleapis');
const readline = require('readline');
require('dotenv').config();

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_DRIVE_CLIENT_ID,
    process.env.GOOGLE_DRIVE_CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob' // Use OOB for manual code entry - no redirect URI needed
);

// Generate authorization URL
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Force to get refresh token
});

console.log('\n=== GOOGLE DRIVE OAUTH SETUP ===\n');
console.log('1. Open this URL in your browser:\n');
console.log(authUrl);
console.log('\n2. Login and authorize the application');
console.log('3. Google will show you an authorization code');
console.log('4. Copy that code\n');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

rl.question('Paste the authorization code here: ', async (code) => {
    try {
        const { tokens } = await oauth2Client.getToken(code);

        console.log('\n=== SUCCESS ===\n');
        console.log('Add these to your .env file:\n');
        console.log(`GOOGLE_DRIVE_ACCESS_TOKEN=${tokens.access_token}`);
        console.log(`GOOGLE_DRIVE_REFRESH_TOKEN=${tokens.refresh_token}`);
        console.log('\n');
    } catch (error) {
        console.error('Error getting tokens:', error.message);
    }

    rl.close();
});
