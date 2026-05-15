import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import User from '../models/User.js';

export default function configurePassport() {
  // Google OAuth
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID || 'dummy_id',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'dummy_secret',
        callbackURL: '/api/auth/google/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let user = await User.findOne({ email: profile.emails[0].value });

          if (user) {
            if (!user.avatarUrl) user.avatarUrl = profile.photos[0].value;
            // Optionally we could update the provider, but linking via email is sufficient
            await user.save();
            done(null, user);
          } else {
            // Create new user
            const newUser = {
              provider: 'google',
              fullName: profile.displayName,
              username: profile.displayName.replace(/\s+/g, '').toLowerCase() + Math.floor(Math.random() * 1000),
              email: profile.emails[0].value,
              avatarUrl: profile.photos[0].value,
            };
            user = await User.create(newUser);
            done(null, user);
          }
        } catch (error) {
          console.error(error);
          done(error, null);
        }
      }
    )
  );

  // GitHub OAuth
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID || 'dummy_id',
        clientSecret: process.env.GITHUB_CLIENT_SECRET || 'dummy_secret',
        callbackURL: '/api/auth/github/callback',
        scope: ['user:email'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let email = profile.emails && profile.emails[0] ? profile.emails[0].value : `${profile.username}@github.com`;
          
          let user = await User.findOne({ email: email });

          if (user) {
            if (!user.avatarUrl && profile.photos && profile.photos[0]) {
              user.avatarUrl = profile.photos[0].value;
            }
            await user.save();
            done(null, user);
          } else {
            const newUser = {
              provider: 'github',
              fullName: profile.displayName || profile.username,
              username: profile.username || profile.displayName.replace(/\s+/g, '').toLowerCase() + Math.floor(Math.random() * 1000),
              email: email,
              avatarUrl: profile.photos && profile.photos[0] ? profile.photos[0].value : '',
            };
            user = await User.create(newUser);
            done(null, user);
          }
        } catch (error) {
          console.error(error);
          done(error, null);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
}
