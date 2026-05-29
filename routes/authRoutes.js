import express from 'express';
import passport from 'passport';
import {
  registerUser,
  loginUser,
  logoutUser,
  getUserProfile,
  updateUserProfile,
  verifyEmail,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validateRegister, validateLogin } from '../middleware/validationMiddleware.js';
import generateToken from '../utils/generateToken.js';

const router = express.Router();


router.post('/register', validateRegister, registerUser);

router.post('/login', validateLogin, loginUser);

router.post('/logout', logoutUser);

router.route('/profile').get(protect, getUserProfile).put(protect, updateUserProfile);

router.get('/verify/:token', verifyEmail);

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.FRONTEND_URL}/login` }),
  (req, res) => {
    // Successful authentication
    generateToken(res, req.user._id);
    // Redirect to frontend dashboard or profile
    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  }
);

router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));

router.get(
  '/github/callback',
  passport.authenticate('github', { session: false, failureRedirect: `${process.env.FRONTEND_URL}/login` }),
  (req, res) => {
    // Successful authentication
    generateToken(res, req.user._id);
    // Redirect to frontend dashboard
    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  }
);

export default router;
