import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import User from '../models/User.js';
import { requireAuth, generateToken } from '../middleware/auth.js';
import { serializeUser } from '../utils/serializers.js';

const router = Router();
const blockedPattern = /(test|demo|sample)/i;

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters.' });
  }

  if (blockedPattern.test(name) || blockedPattern.test(email)) {
    return res.status(400).json({ message: 'Test or demo accounts are not allowed.' });
  }

  const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
  if (existingUser) {
    return res.status(409).json({ message: 'An account with that email already exists.' });
  }

  const user = await User.create({
    id: `user-${randomUUID()}`,
    name: name.trim(),
    email: email.toLowerCase().trim(),
    passwordHash: bcrypt.hashSync(password, 10),
    avatar: name.trim().slice(0, 1).toUpperCase(),
    avatarUrl: null,
    isOnline: false,
    lastSeenAt: null,
  });

  const token = generateToken(user);
  res.json({ user: serializeUser(user), token });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  if (blockedPattern.test(user.name) || blockedPattern.test(user.email)) {
    await User.deleteOne({ id: user.id });
    return res.status(403).json({ message: 'This account is not allowed.' });
  }

  const token = generateToken(user);
  res.json({ user: serializeUser(user), token });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findOne({ id: req.user.id });
  if (!user) {
    return res.status(401).json({ message: 'Authentication failed.' });
  }

  res.json({ user: serializeUser(user) });
});

export default router;
