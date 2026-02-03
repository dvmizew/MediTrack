import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { query } from './database.js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback';

// Only initialize Google Strategy if credentials are available
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          
          if (!email) {
            return done(new Error('No email found in Google profile'), undefined);
          }

          // Check if user exists
          const existingUser = await query(
            'SELECT * FROM users WHERE google_id = $1 OR email = $2',
            [profile.id, email]
          );

          if (existingUser.rows.length > 0) {
            const user = existingUser.rows[0];
            
            // Update google_id if not set
            if (!user.google_id) {
              await query(
                'UPDATE users SET google_id = $1, mfa_enabled = true WHERE user_id = $2',
                [profile.id, user.user_id]
              );
            }
            
            return done(null, user);
          }

          // Create new user
          const newUser = await query(
            `INSERT INTO users (email, full_name, google_id, role, mfa_enabled) 
             VALUES ($1, $2, $3, 'pacient', true) 
             RETURNING *`,
            [email, profile.displayName, profile.id]
          );

          // Initialize patient profile
          await query(
            'INSERT INTO patient_profiles (patient_id) VALUES ($1)',
            [newUser.rows[0].user_id]
          );

          return done(null, newUser.rows[0]);
        } catch (error) {
          return done(error as Error, undefined);
        }
      }
    )
  );
}

export default passport;
