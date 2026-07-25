import User from '../models/User.js';
import generateToken from '../utils/generateToken.js';
import sendEmail from '../utils/sendEmail.js';
import crypto from 'crypto';

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const registerUser = async (req, res) => {
  const { username, email, password, fullName } = req.body;

  try {
    const emailExists = await User.findOne({ email });
    if (emailExists) {
      return res.status(400).json({ message: 'An account with this email address already exists.' });
    }

    const usernameExists = await User.findOne({ username });
    if (usernameExists) {
      return res.status(400).json({ message: 'Username is already taken. Please choose a different username.' });
    }

    const verificationToken = crypto.randomBytes(20).toString('hex');

    const user = await User.create({
      username,
      email,
      passwordHash: password,
      fullName: fullName || '',
      verificationToken,
    });

    if (user) {
      // Send Verification Email
      const verifyUrl = `${req.protocol}://${req.get('host')}/api/auth/verify/${verificationToken}`;
      
      const message = `
        <h1>Welcome to CodeSync, ${user.username}!</h1>
        <p>Please click the link below to verify your email address and activate your account:</p>
        <a href="${verifyUrl}" style="padding: 10px 20px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">Verify Email</a>
        <p>Or copy and paste this link into your browser: <br> ${verifyUrl}</p>
      `;

      try {
        await sendEmail({
          email: user.email,
          subject: 'CodeSync - Verify your Email',
          message,
        });

        res.status(201).json({ 
          message: 'Registration successful! Please check your email to verify your account before logging in.',
          requiresVerification: true 
        });
      } catch (emailError) {
        console.error('Email send failed:', emailError);
        res.status(500).json({ message: 'User registered, but failed to send verification email.' });
      }
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    if (error.code === 11000) {
      const keyPattern = error.keyPattern || error.keyValue || {};
      const field = Object.keys(keyPattern)[0];
      if (field === 'username') {
        return res.status(400).json({ message: 'Username is already taken. Please choose a different username.' });
      }
      if (field === 'email') {
        return res.status(400).json({ message: 'An account with this email address already exists.' });
      }
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req, res) => {
  const { email, username, loginId, password } = req.body;
  const identifier = (loginId || email || username || '').trim();

  try {
    if (!identifier) {
      return res.status(400).json({ message: 'Please enter your username or email address' });
    }

    // Query user by email OR username
    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { username: identifier },
      ],
    });

    if (user && (await user.matchPassword(password))) {
      if (user.isActive === false) {
        return res.status(403).json({ message: 'Your account has been suspended by the administrator.' });
      }
      
      // Block login if email is not verified (only for local provider)
      if (user.provider === 'local' && user.verificationToken) {
        return res.status(403).json({ message: 'Please verify your email address before logging in. Check your inbox!' });
      }

      generateToken(res, user._id);

      res.json({
        userId: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        avatarUrl: user.avatarUrl,
        provider: user.provider,
        isActive: user.isActive,
        starredProjects: user.starredProjects || [],
      });
    } else {
      res.status(401).json({ message: 'Invalid username/email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Logout user / clear cookie
// @route   POST /api/auth/logout
// @access  Public
export const logoutUser = (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('jwt', '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'strict',
    expires: new Date(0),
  });
  res.status(200).json({ message: 'Logged out successfully' });
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      res.json({
        userId: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        role: user.role,
        provider: user.provider,
        isActive: user.isActive,
        createdAt: user.createdAt,
        starredProjects: user.starredProjects || [],
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
export const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      // Check username uniqueness if updating to a new username
      if (req.body.username && req.body.username !== user.username) {
        const usernameExists = await User.findOne({ 
          username: req.body.username, 
          _id: { $ne: user._id } 
        });
        if (usernameExists) {
          return res.status(400).json({ message: 'Username is already taken. Please choose a different username.' });
        }
        user.username = req.body.username;
      }

      // Check email uniqueness if updating to a new email
      if (req.body.email && req.body.email !== user.email) {
        const emailExists = await User.findOne({ 
          email: req.body.email, 
          _id: { $ne: user._id } 
        });
        if (emailExists) {
          return res.status(400).json({ message: 'Email address is already in use by another account.' });
        }
        user.email = req.body.email;
      }

      if (req.body.fullName !== undefined) user.fullName = req.body.fullName;
      if (req.body.avatarUrl !== undefined) user.avatarUrl = req.body.avatarUrl;
      if (req.body.bio !== undefined) user.bio = req.body.bio;
      
      if (req.body.isActive !== undefined) {
        user.isActive = req.body.isActive;
      }

      if (req.body.password) {
        user.passwordHash = req.body.password;
      }

      const updatedUser = await user.save();

      res.json({
        userId: updatedUser._id,
        username: updatedUser.username,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        avatarUrl: updatedUser.avatarUrl,
        bio: updatedUser.bio,
        role: updatedUser.role,
        provider: updatedUser.provider,
        isActive: updatedUser.isActive,
        starredProjects: updatedUser.starredProjects || [],
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    if (error.code === 11000) {
      const keyPattern = error.keyPattern || error.keyValue || {};
      const field = Object.keys(keyPattern)[0];
      if (field === 'username') {
        return res.status(400).json({ message: 'Username is already taken. Please choose a different username.' });
      }
      if (field === 'email') {
        return res.status(400).json({ message: 'Email address is already in use by another account.' });
      }
      return res.status(400).json({ message: `A user record with this ${field || 'value'} already exists.` });
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify user email
// @route   GET /api/auth/verify/:token
// @access  Public
export const verifyEmail = async (req, res) => {
  try {
    const user = await User.findOne({ verificationToken: req.params.token });

    if (!user) {
      return res.status(400).send('<h1>Invalid or expired verification token.</h1>');
    }

    user.isEmailVerified = true;
    user.verificationToken = undefined; // Clear the token
    await user.save();

    // Redirect to frontend login with a success parameter
    const frontendUrl = process.env.FRONTEND_URL 
      ? process.env.FRONTEND_URL.split(',')[0].trim().replace(/\/$/, '') 
      : 'http://localhost:5173';
      
    res.redirect(`${frontendUrl}/login?verified=true`);
  } catch (error) {
    res.status(500).send('<h1>Server error during verification.</h1>');
  }
};

// @desc    Forgot Password - Send Reset Link
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'No user account found with that email address.' });
    }

    if (user.provider !== 'local') {
      return res.status(400).json({ message: `This account uses ${user.provider} authentication. Password reset is not available.` });
    }

    // Generate random 32-byte reset token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Hash token and set to resetPasswordToken field
    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Set expire timestamp (1 hour)
    user.resetPasswordExpire = Date.now() + 60 * 60 * 1000;

    await user.save();

    // Create reset URL pointing to frontend
    const frontendUrl = process.env.FRONTEND_URL 
      ? process.env.FRONTEND_URL.split(',')[0].trim().replace(/\/$/, '') 
      : 'http://localhost:5173';

    const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

    const message = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0f1115; color: #f8f9fa; border-radius: 12px;">
        <h2 style="color: #6366f1;">Password Reset Request</h2>
        <p>Hello ${user.username},</p>
        <p>You are receiving this email because you (or someone else) requested a password reset for your CodeSync account.</p>
        <p>Please click the button below to set a new password:</p>
        <div style="margin: 24px 0;">
          <a href="${resetUrl}" style="padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reset Password</a>
        </div>
        <p style="font-size: 13px; color: #9ca3af;">Or copy and paste this link into your browser:<br><a href="${resetUrl}" style="color: #818cf8;">${resetUrl}</a></p>
        <p style="font-size: 12px; color: #6b7280; margin-top: 24px;">If you did not request this, please ignore this email and your password will remain unchanged. This link is valid for 1 hour.</p>
      </div>
    `;

    try {
      await sendEmail({
        email: user.email,
        subject: 'CodeSync - Password Reset Request',
        message,
      });

      res.status(200).json({ message: 'Password reset link has been sent to your email.' });
    } catch (emailError) {
      console.error('Email send failed:', emailError);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();
      return res.status(500).json({ message: 'Failed to send password reset email. Please try again later.' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Reset Password
// @route   POST /api/auth/reset-password/:resetToken
// @access  Public
export const resetPassword = async (req, res) => {
  try {
    // Get hashed token
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.resetToken)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired password reset token.' });
    }

    if (!req.body.password) {
      return res.status(400).json({ message: 'Please provide a new password.' });
    }

    // Set new password (pre-save middleware will hash it)
    user.passwordHash = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    res.status(200).json({ message: 'Password reset successful! You can now log in with your new password.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

