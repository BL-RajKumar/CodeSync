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
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
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
        // If email fails, we should probably delete the user or handle it, but for now just inform them
        console.error('Email send failed:', emailError);
        res.status(500).json({ message: 'User registered, but failed to send verification email.' });
      }
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      if (user.isActive === false) {
        return res.status(403).json({ message: 'Your account has been suspended by the administrator.' });
      }
      
      // Block login if email is not verified (only for local provider)
      // We check if `user.verificationToken` exists. If it exists, they haven't verified yet.
      // Legacy users created before this feature won't have a token, so they won't be locked out.
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
      res.status(401).json({ message: 'Invalid email or password' });
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
      user.username = req.body.username || user.username;
      user.email = req.body.email || user.email;
      user.fullName = req.body.fullName || user.fullName;
      user.avatarUrl = req.body.avatarUrl || user.avatarUrl;
      user.bio = req.body.bio || user.bio;
      
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
