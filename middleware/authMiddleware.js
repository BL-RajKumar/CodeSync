import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import CollaborationSession from '../models/CollaborationSession.js';

const checkGuestSession = async (req) => {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) return false;

  try {
    const session = await CollaborationSession.findOne({ sessionId, status: 'Active' });
    if (!session) return false;

    // Validate password if protected
    if (session.isPasswordProtected) {
      const sessionPassword = req.headers['x-session-password'];
      if (!sessionPassword || session.sessionPassword !== sessionPassword) {
        return false;
      }
    }

    const guestUsername = req.headers['x-guest-username'] || 'Guest';
    const guestUserId = req.headers['x-guest-userid'];

    let parsedUserId;
    if (guestUserId && /^[0-9a-fA-F]{24}$/.test(guestUserId)) {
      parsedUserId = guestUserId;
    } else {
      // Deterministic valid ObjectId based on sessionId
      parsedUserId = session._id.toString();
    }

    // Block users that have been kicked from this session
    if (session.kickedParticipants && session.kickedParticipants.includes(parsedUserId)) {
      return false;
    }

    req.user = {
      _id: parsedUserId,
      username: guestUsername,
      isGuest: true,
      role: 'Guest'
    };
    return true;
  } catch (error) {
    console.error('Error verifying guest session:', error);
    return false;
  }
};

const protect = async (req, res, next) => {
  let token = req.cookies.jwt;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.userId).select('-passwordHash');

      if (req.user && req.user.isActive === false) {
        // Immediately clear the JWT cookie to force logout on the client side
        res.cookie('jwt', '', {
          httpOnly: true,
          expires: new Date(0),
        });
        return res.status(403).json({ message: 'Your account has been suspended by the administrator.' });
      }

      if (req.user) {
        return next();
      }
    } catch (error) {
      console.error('JWT verification error in protect middleware:', error);
      // Fall through to guest session check
    }
  }

  // Try to authenticate as active collaboration session guest
  const isGuest = await checkGuestSession(req);
  if (isGuest) {
    return next();
  }

  res.status(401).json({ message: 'Not authorized, token failed' });
};

const admin = (req, res, next) => {
  if (req.user && req.user.role === 'Admin') {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as an admin' });
  }
};

const optionalAuth = async (req, res, next) => {
  let token = req.cookies.jwt;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.userId).select('-password');
      if (req.user) {
        return next();
      }
    } catch (error) {
      console.error('JWT verification error in optionalAuth middleware:', error);
    }
  }

  const isGuest = await checkGuestSession(req);
  if (isGuest) {
    return next();
  }

  next();
};

export { protect, admin, optionalAuth };
