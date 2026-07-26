import { Router } from 'express';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { serializeConversation, serializeMessage } from '../utils/serializers.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const conversations = await Conversation.find({ participants: req.user.id })
    .sort({ updatedAt: -1 })
    .lean();

  const enriched = await Promise.all(
    conversations.map(async (conversation) => {
      const participants = await User.find({ id: { $in: conversation.participants } }).lean();
      const lastMessage = conversation.lastMessage ? await Message.findOne({ id: conversation.lastMessage }) : null;

      return {
        ...serializeConversation(conversation, lastMessage ? serializeMessage(lastMessage) : null),
        participants: participants.map((participant) => ({
          id: participant.id,
          name: participant.name,
          email: participant.email,
          avatar: participant.avatar || participant.name?.slice(0, 1).toUpperCase(),
          avatarUrl: participant.avatarUrl || null,
          isOnline: Boolean(participant.isOnline),
          lastSeenAt: participant.lastSeenAt || null,
        })),
      };
    }),
  );

  res.json(enriched);
});

router.post('/', requireAuth, async (req, res) => {
  const { participantId } = req.body;

  if (!participantId || participantId === req.user.id) {
    return res.status(400).json({ message: 'Please select a valid participant.' });
  }

  const participant = await User.findOne({ id: participantId });
  if (!participant) {
    return res.status(404).json({ message: 'Participant not found.' });
  }

  let conversation = await Conversation.findOne({
    isGroup: false,
    participants: { $all: [req.user.id, participantId] },
  });

  if (!conversation) {
    conversation = await Conversation.create({
      id: `conv-${crypto.randomUUID()}`,
      participants: [req.user.id, participantId],
      updatedAt: new Date(),
    });
  }

  const participants = await User.find({ id: { $in: conversation.participants } }).lean();

  res.status(conversation.createdAt ? 200 : 201).json({
    id: conversation.id,
    participants: participants.map((participant) => ({
      id: participant.id,
      name: participant.name,
      email: participant.email,
      avatar: participant.avatar || participant.name?.slice(0, 1).toUpperCase(),
      avatarUrl: participant.avatarUrl || null,
      isOnline: Boolean(participant.isOnline),
      lastSeenAt: participant.lastSeenAt || null,
    })),
    lastMessage: null,
    updatedAt: conversation.updatedAt,
    unreadCount: 0,
  });
});

router.get('/:conversationId/messages', requireAuth, async (req, res) => {
  const conversation = await Conversation.findOne({ id: req.params.conversationId });
  if (!conversation) {
    return res.status(404).json({ message: 'Conversation not found.' });
  }

  if (!conversation.participants.includes(req.user.id)) {
    return res.status(403).json({ message: 'You are not part of this conversation.' });
  }

  const search = (req.query.search || '').toString().trim();
  const query = { conversationId: conversation.id };
  if (search) {
    query.text = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  }

  const messages = await Message.find(query).sort({ createdAt: 1 }).lean();
  res.json(messages.map(serializeMessage));
});

export default router;
