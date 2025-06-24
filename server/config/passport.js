

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import dotenv from 'dotenv';
import UserModel from '../models/usermodel.js';
import { query } from '../config/db.js';

dotenv.config();

// Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.NODE_ENV === 'production'
      ? `${process.env.SERVER_URL}${process.env.GOOGLE_CALLBACK_URL}`
      : `http://localhost:${process.env.PORT || 5000}${process.env.GOOGLE_CALLBACK_URL}`,
    scope: ['profile', 'email']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // 1. Try to find by Google ID
      let user = await UserModel.findByGoogleId(profile.id);
      if (user) return done(null, user);

      // 2. Try to find by email
      const email = profile.emails?.[0]?.value;
      user = await UserModel.findByEmail(email);
      if (user) {
        // Link Google account to existing local account
        // We need to update the user record to include the Google OAuth ID
        try {
          await query(
            `UPDATE users SET oauth_id = $1, oauth_provider = $2 WHERE id = $3`,
            [profile.id, 'google', user.id]
          );
          // Refresh user data after update
          user = await UserModel.findById(user.id);
          return done(null, user);
        } catch (updateError) {
          console.error('Error linking Google account:', updateError);
          return done(updateError, null);
        }
      }

      // 3. Otherwise, create new user
      const newUser = {
        oauth_id: profile.id,
        email: email,
        name: profile.displayName,
        oauth_provider: 'google',
      };

      const createdUser = await UserModel.createGoogleUser(newUser);
      return done(null, createdUser);

    } catch (error) {
      console.error('Error in Google Strategy:', error);
      return done(error, null);
    }
  }
));

// Serialize user for session storage
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await UserModel.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;