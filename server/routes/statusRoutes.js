import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import Status from '../models/Status.js';
import User from '../models/User.js';

const router = Router();

// Create / Post new Status
router.post('/', async (req, res) => {
  try {
    const { mediaUrl, mediaType, caption, backgroundColor } = req.body;
    const userId = req.userId;

    const user = await User.findOne({ id: userId });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (!mediaUrl && !caption && mediaType !== 'text') {
      return res.status(400).json({ message: 'Status must include media or text.' });
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 Hours from now

    const newStatus = await Status.create({
      id: randomUUID(),
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatarUrl || user.avatar || '',
      mediaUrl: mediaUrl || '',
      mediaType: mediaType || (mediaUrl?.match(/\.(mp4|webm|mov|mkv)$/i) ? 'video' : mediaUrl ? 'image' : 'text'),
      caption: caption || '',
      backgroundColor: backgroundColor || 'from-purple-600 to-indigo-600',
      views: [],
      expiresAt,
    });

    // Notify connected sockets via IO app ref if available
    const io = req.app.get('io');
    if (io) {
      io.emit('status_updated', { userId: user.id, userName: user.name });
    }

    return res.status(201).json(newStatus);
  } catch (error) {
    console.error('Create status error:', error);
    return res.status(500).json({ message: 'Failed to post status update.' });
  }
});

// Fetch active statuses (grouped by user) within last 24h
router.get('/', async (req, res) => {
  try {
    const currentUserId = req.userId;
    const now = new Date();

    const activeStatuses = await Status.find({ expiresAt: { $gt: now } }).sort({ createdAt: 1 });

    // Group statuses by userId
    const statusMap = new Map();

    for (const st of activeStatuses) {
      if (!statusMap.has(st.userId)) {
        statusMap.set(st.userId, {
          userId: st.userId,
          userName: st.userName,
          userAvatar: st.userAvatar,
          statuses: [],
          hasUnviewed: false,
          lastUpdated: st.createdAt,
        });
      }

      const group = statusMap.get(st.userId);
      const isViewedByMe = st.views.some((v) => v.userId === currentUserId);
      if (!isViewedByMe && st.userId !== currentUserId) {
        group.hasUnviewed = true;
      }
      group.lastUpdated = st.createdAt;
      group.statuses.push({
        id: st.id,
        userId: st.userId,
        userName: st.userName,
        userAvatar: st.userAvatar,
        mediaUrl: st.mediaUrl,
        mediaType: st.mediaType,
        caption: st.caption,
        backgroundColor: st.backgroundColor,
        createdAt: st.createdAt,
        views: st.views,
        isViewed: isViewedByMe,
      });
    }

    // Convert map values to array: Put current user's status group first if exists
    const result = Array.from(statusMap.values());
    result.sort((a, b) => {
      if (a.userId === currentUserId) return -1;
      if (b.userId === currentUserId) return 1;
      if (a.hasUnviewed && !b.hasUnviewed) return -1;
      if (!a.hasUnviewed && b.hasUnviewed) return 1;
      return new Date(b.lastUpdated) - new Date(a.lastUpdated);
    });

    return res.json(result);
  } catch (error) {
    console.error('Fetch statuses error:', error);
    return res.status(500).json({ message: 'Failed to fetch status updates.' });
  }
});

// Mark status item as viewed
router.post('/:id/view', async (req, res) => {
  try {
    const statusId = req.params.id;
    const currentUserId = req.userId;

    const user = await User.findOne({ id: currentUserId });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const statusItem = await Status.findOne({ id: statusId });
    if (!statusItem) {
      return res.status(404).json({ message: 'Status update not found.' });
    }

    const alreadyViewed = statusItem.views.some((v) => v.userId === currentUserId);
    if (!alreadyViewed) {
      statusItem.views.push({
        userId: user.id,
        userName: user.name,
        viewedAt: new Date(),
      });
      await statusItem.save();

      const io = req.app.get('io');
      if (io) {
        io.emit('status_viewed', { statusId, viewerId: user.id, ownerId: statusItem.userId });
      }
    }

    return res.json({ success: true, viewsCount: statusItem.views.length });
  } catch (error) {
    console.error('View status error:', error);
    return res.status(500).json({ message: 'Failed to record status view.' });
  }
});

// Delete status item
router.delete('/:id', async (req, res) => {
  try {
    const statusId = req.params.id;
    const currentUserId = req.userId;

    const statusItem = await Status.findOne({ id: statusId });
    if (!statusItem) {
      return res.status(404).json({ message: 'Status update not found.' });
    }

    if (statusItem.userId !== currentUserId) {
      return res.status(403).json({ message: 'You can only delete your own status updates.' });
    }

    await Status.deleteOne({ id: statusId });

    const io = req.app.get('io');
    if (io) {
      io.emit('status_updated', { userId: currentUserId });
    }

    return res.json({ success: true, message: 'Status deleted successfully.' });
  } catch (error) {
    console.error('Delete status error:', error);
    return res.status(500).json({ message: 'Failed to delete status update.' });
  }
});

export default router;
