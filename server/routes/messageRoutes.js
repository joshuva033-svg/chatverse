import { Router } from 'express';
import Message from '../models/Message.js';
import StarredMessage from '../models/StarredMessage.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Delete message for current user (Delete for me)
router.post('/:messageId/delete-me', requireAuth, async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user.id;

  const message = await Message.findOne({ id: messageId });
  if (!message) return res.status(404).json({ message: 'Message not found.' });

  if (!message.deletedFor.includes(userId)) {
    message.deletedFor.push(userId);
    await message.save();
  }

  res.json({ message: 'Message deleted for you.' });
});

// Delete message for everyone
router.post('/:messageId/delete-everyone', requireAuth, async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user.id;

  const message = await Message.findOne({ id: messageId });
  if (!message) return res.status(404).json({ message: 'Message not found.' });

  // Only sender can delete for everyone
  if (message.senderId !== userId) {
    return res.status(403).json({ message: 'You can only delete your own messages for everyone.' });
  }

  // We can either delete the document or mark it as deleted for all.
  // Marking as deleted for all by adding all participants to deletedFor is complex.
  // Instead, we'll just delete the document from MongoDB for this implementation,
  // as "Delete for everyone" typically implies full removal.
  await Message.deleteOne({ id: messageId });

  res.json({ message: 'Message deleted for everyone.' });
});

// Star/Unstar a message
router.post('/:messageId/star', requireAuth, async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user.id;

  const existingStar = await StarredMessage.findOne({ userId, messageId });
  if (existingStar) {
    await StarredMessage.deleteOne({ _id: existingStar._id });
    return res.json({ starred: false, message: 'Message unstarred.' });
  }

  await StarredMessage.create({ userId, messageId });
  res.json({ starred: true, message: 'Message starred.' });
});

// Get starred messages for current user
router.get('/starred', requireAuth, async (req, res) => {
  const stars = await StarredMessage.find({ userId: req.user.id }).lean();
  const messageIds = stars.map(s => s.messageId);
  const messages = await Message.find({ id: { $in: messageIds } }).sort({ createdAt: -1 });
  res.json(messages);
});

export default router;
