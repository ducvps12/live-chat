const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const authService = require('./auth.service');
require('dotenv').config();

const getOAuth2Client = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:4000/api/auth/google/callback'
  );
};

// Initiate Google OAuth - redirects user to Google login page
router.get('/google', (req, res) => {
  const oauth2Client = getOAuth2Client();

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ],
    prompt: 'consent'
  });

  res.redirect(authUrl);
});

// Google OAuth callback - handles the response from Google
router.get('/google/callback', async (req, res) => {
  const { code, error } = req.query;

  // Frontend URL to redirect to
  const frontendUrl = process.env.FRONTEND_PUBLIC_URL || 'http://localhost:3000';

  if (error) {
    return res.redirect(`${frontendUrl}/auth/login?error=google_auth_denied`);
  }

  if (!code) {
    return res.redirect(`${frontendUrl}/auth/login?error=no_code`);
  }

  try {
    const oauth2Client = getOAuth2Client();

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info from Google
    const oauth2 = google.oauth2({
      auth: oauth2Client,
      version: 'v2'
    });

    const { data: googleUser } = await oauth2.userinfo.get();

    if (!googleUser.email) {
      return res.redirect(`${frontendUrl}/auth/login?error=no_email`);
    }

    // Register or login user
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const agent = req.get('User-Agent') || 'unknown';

    const result = await authService.registerOrLoginWithGoogle({
      email: googleUser.email,
      displayName: googleUser.name || googleUser.email.split('@')[0],
      googleId: googleUser.id,
      avatarUrl: googleUser.picture,
      ip,
      agent
    });

    // Redirect to frontend with tokens
    const redirectUrl = new URL(`${frontendUrl}/auth/google/callback`);
    redirectUrl.searchParams.set('accessToken', result.accessToken);
    redirectUrl.searchParams.set('refreshToken', result.refreshToken);

    res.redirect(redirectUrl.toString());

  } catch (error) {
    console.error('Google OAuth error:', error);
    res.redirect(`${frontendUrl}/auth/login?error=google_auth_failed&message=${encodeURIComponent(error.message)}`);
  }
});

module.exports = router;
