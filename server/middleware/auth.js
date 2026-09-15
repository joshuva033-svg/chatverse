import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'chat-verse-dev-secret';

export function requireAuth(req, res, next) {
  const authorization = req.headers.authorization || req.cookies?.token;
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : authorization;

  if (!token) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Authentication failed.' });
  }
}

export function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '365d' });
}

export async function getAuthenticatedUser(token) {
  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return await User.findOne({ id: payload.id });
  } catch {
    return null;
  }
}
