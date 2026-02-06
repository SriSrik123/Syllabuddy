import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { getGoogleAuthUrl, getGoogleTokens, getGoogleUserInfo } from '../services/googleAuth';
import { verifyFirebaseToken } from '../services/firebaseAdmin';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5174';

function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      res.status(400).json({ error: 'Email, password, and name are required' });
      return;
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = new User({
      email: email.toLowerCase(),
      passwordHash,
      name,
    });

    await user.save();

    const token = generateToken(user._id.toString());

    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        googleCalendarConnected: user.googleCalendarConnected,
      },
    });
  } catch (err: any) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // If user signed up with Google and has no password
    if (!user.passwordHash) {
      res.status(401).json({ error: 'This account uses Google Sign-In. Please sign in with Google.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = generateToken(user._id.toString());

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        googleCalendarConnected: user.googleCalendarConnected,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId).select('-passwordHash -googleTokens');
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({
      id: user._id,
      email: user.email,
      name: user.name,
      googleCalendarConnected: user.googleCalendarConnected,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/firebase-google - sign in with Firebase Google token
router.post('/firebase-google', async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      res.status(400).json({ error: 'Firebase ID token is required' });
      return;
    }

    // Verify the Firebase ID token
    const decodedToken = await verifyFirebaseToken(idToken);
    const { email, name, uid, picture } = decodedToken;

    if (!email) {
      res.status(400).json({ error: 'No email associated with this Google account' });
      return;
    }

    // Find or create user in our database
    let user = await User.findOne({
      $or: [
        { googleId: uid },
        { email: email.toLowerCase() },
      ],
    });

    if (user) {
      // Update Google ID if not set
      if (!user.googleId) {
        user.googleId = uid;
      }
      await user.save();
    } else {
      // Create new user
      user = new User({
        email: email.toLowerCase(),
        name: name || email.split('@')[0],
        googleId: uid,
        passwordHash: '',
      });
      await user.save();
    }

    const token = generateToken(user._id.toString());

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        googleCalendarConnected: user.googleCalendarConnected,
      },
    });
  } catch (err: any) {
    console.error('Firebase Google auth error:', err);
    res.status(401).json({ error: 'Invalid Firebase token' });
  }
});

// GET /api/auth/google - redirect to Google sign-in (legacy)
router.get('/google', (_req: Request, res: Response) => {
  try {
    const state = JSON.stringify({ action: 'signin' });
    const url = getGoogleAuthUrl(Buffer.from(state).toString('base64'));
    res.json({ url });
  } catch (err: any) {
    console.error('Google auth URL error:', err);
    res.status(500).json({ error: 'Google OAuth not configured' });
  }
});

// GET /api/auth/google/callback - handle Google OAuth callback
router.get('/google/callback', async (req: Request, res: Response) => {
  try {
    const { code } = req.query;

    if (!code) {
      res.redirect(`${CLIENT_URL}/login?error=no_code`);
      return;
    }

    // Exchange code for tokens
    const tokens = await getGoogleTokens(code as string);

    if (!tokens.access_token) {
      res.redirect(`${CLIENT_URL}/login?error=no_token`);
      return;
    }

    // Get user info from Google
    const googleUser = await getGoogleUserInfo(tokens.access_token);

    if (!googleUser.email) {
      res.redirect(`${CLIENT_URL}/login?error=no_email`);
      return;
    }

    // Find or create user
    let user = await User.findOne({
      $or: [
        { googleId: googleUser.id },
        { email: googleUser.email.toLowerCase() },
      ],
    });

    if (user) {
      // Update Google tokens
      user.googleId = googleUser.id || undefined;
      user.googleTokens = {
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token || user.googleTokens?.refreshToken || '',
        expiryDate: tokens.expiry_date || 0,
      };
      user.googleCalendarConnected = true;
      await user.save();
    } else {
      // Create new user
      user = new User({
        email: googleUser.email.toLowerCase(),
        name: googleUser.name || googleUser.email.split('@')[0],
        googleId: googleUser.id || undefined,
        passwordHash: '',
        googleTokens: {
          accessToken: tokens.access_token!,
          refreshToken: tokens.refresh_token || '',
          expiryDate: tokens.expiry_date || 0,
        },
        googleCalendarConnected: true,
      });
      await user.save();
    }

    const jwtToken = generateToken(user._id.toString());

    // Redirect to frontend with token
    res.redirect(`${CLIENT_URL}/auth/callback?token=${jwtToken}`);
  } catch (err: any) {
    console.error('Google callback error:', err);
    res.redirect(`${CLIENT_URL}/login?error=google_failed`);
  }
});

export default router;
