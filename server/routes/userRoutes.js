import { Router } from 'express';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { serializeUser } from '../utils/serializers.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const users = await User.find({ id: { $ne: req.user.id } }).sort({ name: 1 }).lean();
  res.json(users.map(serializeUser));
});

router.get('/search', requireAuth, async (req, res) => {
  const query = (req.query.query || '').toString().trim().toLowerCase();
  const users = await User.find({ id: { $ne: req.user.id } }).lean();
  const filtered = users
    .filter((user) => !query || user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query))
    .slice(0, 12)
    .map(serializeUser);
  res.json(filtered);
});

router.get('/:userId/profile', requireAuth, async (req, res) => {
  const user = await User.findOne({ id: req.params.userId });
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  res.json({ user: serializeUser(user) });
});

router.put('/me/profile', requireAuth, async (req, res) => {
  const { name, avatar, avatarUrl } = req.body;
  const user = await User.findOne({ id: req.user.id });

  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  if (name) {
    user.name = name.trim();
  }

  if (avatar !== undefined) {
    user.avatar = avatar?.trim() || user.avatar;
  }

  if (avatarUrl) {
    user.avatarUrl = avatarUrl;
  }

  await user.save();
  res.json({ user: serializeUser(user) });
});

export default router;
