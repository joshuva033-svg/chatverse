import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import { connectDb, saveDbBackup, restoreDbBackup } from './db.js';
import User from './models/User.js';
import Conversation from './models/Conversation.js';
import Message from './models/Message.js';
import path from 'node:path';
import uploadRoutes from './routes/uploadRoutes.js';
import nodemailer from 'nodemailer';

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
const vercelOriginPattern = /^https?:\/\/[a-zA-Z0-9-]+\.vercel\.app$/;
const corsOptions = {
  origin: (origin, callback) => {
    if (
      !origin ||
      allowedOrigins.has(origin) ||
      localNetworkOriginPattern.test(origin) ||
      vercelOriginPattern.test(origin)
    ) {
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
    lastSeen: user.lastSeen || new Date(),
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
    lastSeen: participant.lastSeen || new Date(),
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
    isPinned: message.isPinned === true,
    deletedBy: message.deletedBy || [],
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



  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(409).json({ message: 'An account with that email already exists.' });
  }

  const user = await User.create({
    id: `user-${randomUUID()}`,
    name,
    email,
    passwordHash: bcrypt.hashSync(password, 10),
    avatar: (name || 'U').charAt(0).toUpperCase(),
  });

  await saveDbBackup();

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ user: serializeUser(user), token });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Please provide your email and password.' });
  }

  const user = await User.findOne({ email });
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }



  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ user: serializeUser(user), token });
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Please provide an email address.' });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).json({ message: 'No account exists with this email.' });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  user.resetCode = code;
  await user.save();
  await saveDbBackup();

  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (emailUser && emailPass) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: emailUser,
          pass: emailPass,
        },
      });

      const mailOptions = {
        from: `"Chat-Verse Security" <${emailUser}>`,
        to: email,
        subject: 'Your Password Recovery Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color: #06b6d4; text-align: center;">Chat-Verse Password Recovery</h2>
            <p>Hello,</p>
            <p>You requested a password reset for your account. Please use the following 6-digit verification code to reset your password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <span style="font-size: 24px; font-weight: bold; background: #f1f5f9; padding: 10px 30px; border-radius: 8px; border: 1px solid #cbd5e1; letter-spacing: 4px; color: #0f172a;">
                ${code}
              </span>
            </div>
            <p style="color: #64748b; font-size: 12px; text-align: center;">This code will expire once used. If you did not make this request, please ignore this email.</p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      return res.json({ message: 'A password recovery code has been sent to your email address.' });
    } catch (err) {
      console.error('[Nodemailer Error]', err);
      return res.json({
        message: 'Email failed to send. Using simulated code.',
        code,
        simulated: true,
      });
    }
  }

  res.json({
    message: 'Local simulation: recovery code generated.',
    code,
    simulated: true,
  });
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    return res.status(400).json({ message: 'Please provide all details (email, code, and new password).' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters.' });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  if (!user.resetCode || user.resetCode !== code) {
    return res.status(400).json({ message: 'Invalid or expired recovery code.' });
  }

  user.passwordHash = bcrypt.hashSync(newPassword, 10);
  user.resetCode = null;
  await user.save();
  await saveDbBackup();

  res.json({ message: 'Password reset successful! Please sign in with your new password.' });
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
  await saveDbBackup();

  res.json({ user: serializeUser(user) });
});

app.get('/api/conversations', authMiddleware, async (req, res) => {
  const conversations = await Conversation.find({ participants: req.user.id }).sort({ updatedAt: -1 });
  const enriched = [];

  for (const conversation of conversations) {
    const participants = await User.find({ id: { $in: conversation.participants } }).lean();
    const lastMessage = conversation.lastMessage ? await Message.findOne({ id: conversation.lastMessage }) : null;

    enriched.push({
      id: conversation.id,
      participants: participants.map((participant) => serialiseParticipant(participant)),
      lastMessage: lastMessage ? serializeMessage(lastMessage) : null,
      updatedAt: conversation.updatedAt,
      unreadCount: 0,
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
    isGroup: false,
    participants: { $all: [req.user.id, participantId] },
  });

  if (!conversation) {
    conversation = await Conversation.create({
      id: `conv-${randomUUID()}`,
      participants: [req.user.id, participantId],
      updatedAt: new Date(),
    });
    await saveDbBackup();
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

  await saveDbBackup();

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

  const messages = await Message.find({ conversationId: conversation.id, deletedBy: { $ne: req.user.id } }).sort({ createdAt: 1 });
  res.json(messages.map((message) => serializeMessage(message)));
});

app.delete('/api/conversations/:conversationId', authMiddleware, async (req, res) => {
  const { conversationId } = req.params;

  try {
    const conversation = await Conversation.findOne({ id: conversationId });

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found.' });
    }

    if (!conversation.participants.includes(req.user.id)) {
      return res.status(403).json({ message: 'You are not part of this conversation.' });
    }

    // Delete all messages in the conversation
    await Message.deleteMany({ conversationId });

    // Delete the conversation itself
    await Conversation.deleteOne({ id: conversationId });

    await saveDbBackup();

    // Notify all participants over socket that the conversation was deleted
    conversation.participants.forEach((pId) => {
      io.to(pId).emit('conversation_deleted', { conversationId });
    });

    res.json({ success: true, message: 'Conversation deleted successfully.' });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ message: 'Server error occurred while deleting conversation.' });
  }
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

      user.lastSeen = new Date();
      await user.save();

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

    await saveDbBackup();

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
    await saveDbBackup();

    if (messageIds.length > 0) {
      io.to(conversationId).emit('message_read', {
        conversationId,
        messageIds,
      });
    }
  });

  socket.on('delete_message', async ({ messageId, deleteType }, callback) => {
    if (!socket.userId || !messageId || !deleteType) {
      callback?.({ success: false, message: 'Invalid request' });
      return;
    }

    try {
      const message = await Message.findOne({ id: messageId });
      if (!message) {
        callback?.({ success: false, message: 'Message not found' });
        return;
      }

      const conversation = await Conversation.findOne({ id: message.conversationId });
      if (!conversation) {
        callback?.({ success: false, message: 'Conversation not found' });
        return;
      }

      if (deleteType === 'both') {
        if (message.senderId !== socket.userId) {
          callback?.({ success: false, message: 'Unauthorized' });
          return;
        }

        await Message.deleteOne({ id: messageId });

        if (conversation.lastMessage === messageId) {
          const remainingMsg = await Message.findOne({ conversationId: conversation.id }).sort({ createdAt: -1 });
          conversation.lastMessage = remainingMsg ? remainingMsg.id : null;
          await conversation.save();
        }

        conversation.participants.forEach((pId) => {
          io.to(pId).emit('message_deleted', {
            messageId,
            conversationId: conversation.id,
            deleteType: 'both',
          });
        });
      } else if (deleteType === 'me') {
        await Message.updateOne({ id: messageId }, { $addToSet: { deletedBy: socket.userId } });

        io.to(socket.userId).emit('message_deleted', {
          messageId,
          conversationId: conversation.id,
          deleteType: 'me',
          userId: socket.userId,
        });
      }

      await saveDbBackup();
      callback?.({ success: true });
    } catch (error) {
      console.error('Error deleting message:', error);
      callback?.({ success: false, message: 'Server error' });
    }
  });

  socket.on('toggle_pin_message', async ({ messageId }, callback) => {
    if (!socket.userId || !messageId) {
      callback?.({ success: false, message: 'Invalid request' });
      return;
    }

    try {
      const message = await Message.findOne({ id: messageId });
      if (!message) {
        callback?.({ success: false, message: 'Message not found' });
        return;
      }

      const conversation = await Conversation.findOne({ id: message.conversationId });
      if (!conversation) {
        callback?.({ success: false, message: 'Conversation not found' });
        return;
      }

      if (!conversation.participants.includes(socket.userId)) {
        callback?.({ success: false, message: 'Unauthorized' });
        return;
      }

      message.isPinned = !message.isPinned;
      await message.save();
      await saveDbBackup();

      conversation.participants.forEach((pId) => {
        io.to(pId).emit('message_pinned_update', {
          messageId,
          conversationId: conversation.id,
          isPinned: message.isPinned,
        });
      });

      callback?.({ success: true, isPinned: message.isPinned });
    } catch (error) {
      console.error('Error pinning message:', error);
      callback?.({ success: false, message: 'Server error' });
    }
  });

  socket.on('disconnect', async () => {
    if (socket.userId) {
      socketUsers.delete(socket.id);

      const stillConnected = [...socketUsers.values()].includes(socket.userId);
      const onlineUserIds = [...new Set([...socketUsers.values()])];

      if (!stillConnected) {
        const lastSeenTime = new Date();
        await User.updateOne({ id: socket.userId }, { lastSeen: lastSeenTime });
        await saveDbBackup();

        io.emit('presence_update', {
          onlineUserIds,
          userId: socket.userId,
          lastSeen: lastSeenTime.toISOString(),
        });
      } else {
        io.emit('presence_update', { onlineUserIds });
      }
    }
  });
});

connectDb()
  .then(async () => {
    if (!process.env.MONGODB_URI) {
      await restoreDbBackup();
    }
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
