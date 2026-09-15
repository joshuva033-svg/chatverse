import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import { connectDb } from './db.js';
import User from './models/User.js';
import Conversation from './models/Conversation.js';
import Message from './models/Message.js';
import path from 'node:path';
import uploadRoutes from './routes/uploadRoutes.js';

dotenv.config();

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'chat-verse-dev-secret';
const PORT = Number(process.env.PORT) || 5001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const allowedOrigins = new Set([
  CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://192.168.31.15:5173',
  'http://192.168.31.15:5174',
].filter(Boolean));

const localNetworkOriginPattern = /^https?:\/\/(?:localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+):\d+$/;
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin) || localNetworkOriginPattern.test(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy does not allow access from ${origin}`));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));
app.use('/api/upload', uploadRoutes);

const socketUsers = new Map();

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : req.cookies?.token;

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

function serializeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar || user.name?.slice(0, 1).toUpperCase() || 'U',
    avatarUrl: user.avatarUrl || null,
    status: user.status || 'Hey there! I am using Chat-Verse.',
    readReceipts: user.readReceipts !== false,
  };
}

function serialiseParticipant(participant) {
  return {
    id: participant.id,
    name: participant.name,
    email: participant.email,
    avatar: participant.avatar || participant.name?.slice(0, 1).toUpperCase() || 'U',
    avatarUrl: participant.avatarUrl || null,
    status: participant.status || 'Hey there! I am using Chat-Verse.',
  };
}

function serializeMessage(message) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    text: message.text,
    createdAt: message.createdAt,
    readAt: message.readAt,
    fileUrl: message.fileUrl,
    fileName: message.fileName,
    fileType: message.fileType,
    fileSize: message.fileSize,
    replyToMessageId: message.replyToMessageId || null,
  };
}

async function removeBlockedUsers() {
  return 0;
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Please provide name, email, and password.' });
  }

  const cleanName = name.toString().trim();
  const cleanEmail = email.toString().trim().toLowerCase();
  const cleanPassword = password.toString();

  if (cleanPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
  }

  const existingUser = await User.findOne({ email: cleanEmail });
  if (existingUser) {
    return res.status(409).json({ message: 'An account with that email already exists.' });
  }

  const user = await User.create({
    id: `user-${randomUUID()}`,
    name: cleanName,
    email: cleanEmail,
    passwordHash: bcrypt.hashSync(cleanPassword, 10),
    avatar: (cleanName || 'U').charAt(0).toUpperCase(),
  });

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '365d' });
  res.json({ user: serializeUser(user), token });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Please provide your email and password.' });
  }

  const cleanEmail = email.toString().trim().toLowerCase();
  const cleanPassword = password.toString();

  const user = await User.findOne({ email: cleanEmail });
  if (!user || !bcrypt.compareSync(cleanPassword, user.passwordHash)) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '365d' });
  res.json({ user: serializeUser(user), token });
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  const user = await User.findOne({ id: req.user.id });
  if (!user) {
    return res.status(401).json({ message: 'Authentication failed.' });
  }

  res.json({ user: serializeUser(user) });
});

app.get('/api/users', authMiddleware, async (req, res) => {
  const users = await User.find().sort({ name: 1 }).lean();
  res.json(users.filter((user) => user.id !== req.user.id).map((user) => serializeUser(user)));
});

app.get('/api/users/search', authMiddleware, async (req, res) => {
  const { query = '' } = req.query;
  const term = query.toString().trim().toLowerCase();

  const users = await User.find({ id: { $ne: req.user.id } }).lean();
  const results = users
    .filter((user) => !term || user.name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term))
    .slice(0, 8)
    .map((user) => serializeUser(user));

  res.json(results);
});

app.get('/api/users/:userId/profile', authMiddleware, async (req, res) => {
  const user = await User.findOne({ id: req.params.userId });

  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  res.json({ user: serializeUser(user) });
});

app.put('/api/users/me/profile', authMiddleware, async (req, res) => {
  const { name, avatar, readReceipts, status, avatarUrl } = req.body;
  const user = await User.findOne({ id: req.user.id });

  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  if (name) {
    user.name = name;
  }

  if (avatar !== undefined) {
    user.avatar = avatar;
  }

  if (readReceipts !== undefined) {
    user.readReceipts = readReceipts;
  }

  if (status !== undefined) {
    user.status = status;
  }

  if (avatarUrl !== undefined) {
    user.avatarUrl = avatarUrl;
  }

  await user.save();

  res.json({ user: serializeUser(user) });
});

app.get('/api/conversations', authMiddleware, async (req, res) => {
  const conversations = await Conversation.find({ participants: req.user.id }).sort({ updatedAt: -1 });
  const enriched = [];

  for (const conversation of conversations) {
    const participants = await User.find({ id: { $in: conversation.participants } }).lean();
    const lastMessage = conversation.lastMessage ? await Message.findOne({ id: conversation.lastMessage }) : null;
    const unreadCount = await Message.countDocuments({
      conversationId: conversation.id,
      senderId: { $ne: req.user.id },
      readAt: null,
    });

    enriched.push({
      id: conversation.id,
      participants: participants.map((participant) => serialiseParticipant(participant)),
      lastMessage: lastMessage ? serializeMessage(lastMessage) : null,
      updatedAt: conversation.updatedAt,
      unreadCount,
      isGroup: conversation.isGroup || false,
      name: conversation.name || '',
      createdBy: conversation.createdBy || '',
    });
  }

  res.json(enriched);
});

app.post('/api/conversations', authMiddleware, async (req, res) => {
  const { participantId } = req.body;

  if (!participantId || participantId === req.user.id) {
    return res.status(400).json({ message: 'Please select a valid participant.' });
  }

  const participant = await User.findOne({ id: participantId });
  if (!participant) {
    return res.status(404).json({ message: 'Participant not found.' });
  }

  let conversation = await Conversation.findOne({
    participants: { $all: [req.user.id, participantId] },
    $expr: { $eq: [{ $size: '$participants' }, 2] },
  });

  if (!conversation) {
    conversation = await Conversation.create({
      id: `conv-${randomUUID()}`,
      participants: [req.user.id, participantId],
      updatedAt: new Date(),
    });
  }

  const participants = await User.find({ id: { $in: conversation.participants } }).lean();
  res.status(conversation.createdAt ? 200 : 201).json({
    id: conversation.id,
    participants: participants.map((participant) => serialiseParticipant(participant)),
    lastMessage: null,
    updatedAt: conversation.updatedAt,
    unreadCount: 0,
    isGroup: false,
    name: '',
    createdBy: '',
  });
});

app.post('/api/conversations/group', authMiddleware, async (req, res) => {
  const { name, participantIds } = req.body;

  if (!name || !participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
    return res.status(400).json({ message: 'Group name and participants are required.' });
  }

  const allParticipants = [...new Set([...participantIds, req.user.id])];

  const conversation = await Conversation.create({
    id: `conv-${randomUUID()}`,
    participants: allParticipants,
    isGroup: true,
    name: name.trim(),
    createdBy: req.user.id,
    updatedAt: new Date(),
  });

  const participants = await User.find({ id: { $in: conversation.participants } }).lean();
  res.status(201).json({
    id: conversation.id,
    participants: participants.map((participant) => serialiseParticipant(participant)),
    lastMessage: null,
    updatedAt: conversation.updatedAt,
    unreadCount: 0,
    isGroup: true,
    name: conversation.name,
    createdBy: conversation.createdBy,
  });
});

app.get('/api/conversations/:conversationId/messages', authMiddleware, async (req, res) => {
  const conversation = await Conversation.findOne({ id: req.params.conversationId });

  if (!conversation) {
    return res.status(404).json({ message: 'Conversation not found.' });
  }

  if (!conversation.participants.includes(req.user.id)) {
    return res.status(403).json({ message: 'You are not part of this conversation.' });
  }

  const messages = await Message.find({ conversationId: conversation.id }).sort({ createdAt: 1 });
  res.json(messages.map((message) => serializeMessage(message)));
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: corsOptions,
});

io.on('connection', (socket) => {
  socket.on('authenticate', async ({ token }) => {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const user = await User.findOne({ id: payload.id });

      if (!user) {
        return;
      }

      socket.userId = user.id;
      socketUsers.set(socket.id, user.id);
      socket.join(user.id);
      io.emit('presence_update', { onlineUserIds: [...new Set([...socketUsers.values()])] });
    } catch (error) {
      console.error('Socket auth failed', error);
    }
  });

  socket.on('join_conversation', (conversationId) => {
    if (!conversationId) {
      return;
    }

    socket.join(conversationId);
  });

  socket.on('typing', ({ conversationId, isTyping }) => {
    if (!socket.userId || !conversationId) {
      return;
    }

    socket.to(conversationId).emit('typing_update', {
      conversationId,
      userId: socket.userId,
      isTyping,
    });
  });

  socket.on('send_message', async ({ conversationId, recipientId, text, fileUrl, fileName, fileType, fileSize, replyToMessageId }, callback) => {
    console.log('[Server] send_message received', {
      socketId: socket.id,
      userId: socket.userId,
      conversationId,
      recipientId,
      text,
      fileUrl,
      replyToMessageId,
    });

    if (!socket.userId || !conversationId || (!text?.trim() && !fileUrl)) {
      callback?.(null);
      return;
    }

    const conversation = await Conversation.findOne({ id: conversationId });
    if (!conversation) {
      callback?.(null);
      return;
    }

    if (!conversation.isGroup && !recipientId) {
      callback?.(null);
      return;
    }

    const message = await Message.create({
      id: `msg-${randomUUID()}`,
      conversationId,
      senderId: socket.userId,
      text: text?.trim() || '',
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      fileType: fileType || null,
      fileSize: fileSize || null,
      replyToMessageId: replyToMessageId || null,
      readAt: null,
    });

    console.log('[Server] message stored in DB', { messageId: message.id, conversationId, senderId: message.senderId });

    conversation.lastMessage = message.id;
    conversation.updatedAt = new Date();
    await conversation.save();

    console.log('[Server] broadcasting new_message to all participants');
    conversation.participants.forEach((pId) => {
      io.to(pId).emit('new_message', serializeMessage(message));
    });

    callback?.(serializeMessage(message));
  });

  socket.on('mark_read', async ({ conversationId }) => {
    if (!socket.userId || !conversationId) {
      return;
    }

    const conversation = await Conversation.findOne({ id: conversationId });
    if (!conversation) {
      return;
    }

    if (!conversation.isGroup) {
      const reader = await User.findOne({ id: socket.userId });
      if (reader && reader.readReceipts === false) {
        return;
      }
    }

    const unreadMessages = await Message.find({ conversationId, senderId: { $ne: socket.userId }, readAt: null });
    const messageIds = unreadMessages.map((message) => message.id);

    await Message.updateMany({ conversationId, senderId: { $ne: socket.userId }, readAt: null }, { readAt: new Date() });

    if (messageIds.length > 0) {
      io.to(conversationId).emit('message_read', {
        conversationId,
        messageIds,
      });
    }
  });

  socket.on('disconnect', () => {
    if (socket.userId) {
      socketUsers.delete(socket.id);
      io.emit('presence_update', { onlineUserIds: [...new Set([...socketUsers.values()])] });
    }
  });
});

connectDb()
  .then(async () => {
    const removedCount = await removeBlockedUsers();
    if (removedCount > 0) {
      console.log(`Removed ${removedCount} blocked test/demo users.`);
    }
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('DB connection failed', error);
    process.exit(1);
  });
