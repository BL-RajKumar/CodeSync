import jwt from 'jsonwebtoken';

const generateToken = (res, userId) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });

  // Set JWT as HTTP-only cookie
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('jwt', token, {
    httpOnly: true,
    secure: isProduction, 
    sameSite: isProduction ? 'none' : 'strict', // Cross-domain requires 'none'
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });
  
  return token;
};

export default generateToken;
