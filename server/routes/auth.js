




import express from 'express';
import userController from "../controllers/userController.js";
import {
    googleAuth,
    getCurrentUser,
    logout,
    refreshToken
  } from '../controllers/oauthController.js';
import { authenticateToken } from '../middleware/auth.js';
import passport from '../config/passport.js';
import { generateToken, generateRefreshToken } from '../utils/helper.js';
  
const router = express.Router();

router.post("/register", userController.register);
router.post("/login", userController.login);
router.post("/change-password", userController.changePassword);


// Google OAuth routes
router.get('/google', googleAuth);
router.get('/google/callback', 
  passport.authenticate('google', { 
    session: false, 
    failureRedirect: `${process.env.CLIENT_URL}/login?oauth=fail`, 
  }), 
  (req, res) => { 
    // This only runs if authentication was successful 
    const user = req.user; 

    // Generate JWTs 
    const accessToken = generateToken(user.id, user.role); 
    const refreshToken = generateRefreshToken(user.id, user.role); 
    
    // Set HTTP-only cookies for security
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });
    
    // Also set accessible cookies for client-side auth (less secure but needed for SPA)
    res.cookie('clientAccessToken', accessToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    res.cookie('clientRefreshToken', refreshToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });
    
    // Redirect to OAuth success page for token handling
    return res.redirect(`${process.env.CLIENT_URL}/oauth/success`);
  }
);

// User authentication routes
router.get('/user', authenticateToken, getCurrentUser);
router.post('/logout', authenticateToken, logout);
router.post('/refresh', refreshToken);

// User profile route
router.get('/profile', authenticateToken, userController.getProfile);

// JWT protected route example
router.get('/protected', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'This is a protected route',
    user: req.user
  });
});

export default router;
