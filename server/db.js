import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import fs from 'node:fs';
import path from 'node:path';
import User from './models/User.js';
import Conversation from './models/Conversation.js';
import Message from './models/Message.js';

import { fileURLToPath } from 'node:url';

let mongoServer;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_FILE = path.join(__dirname, 'db_backup.json');

export async function connectDb() {
  if (mongoose.connection.readyState >= 1) {
    return mongoose.connection;
  }

  const uri = process.env.MONGODB_URI;

  if (uri) {
    await mongoose.connect(uri);
    return mongoose.connection;
  }

  mongoServer = await MongoMemoryServer.create();
  const memoryUri = mongoServer.getUri();
  await mongoose.connect(memoryUri);
  return mongoose.connection;
}

export async function disconnectDb() {
  if (mongoose.connection.readyState >= 1) {
    await mongoose.disconnect();
  }

  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
}

export async function saveDbBackup() {
  if (process.env.MONGODB_URI) return;

  try {
    const users = await User.find({}).lean();
    const conversations = await Conversation.find({}).lean();
    const messages = await Message.find({}).lean();

    const backupData = {
      users,
      conversations,
      messages,
    };

    fs.writeFileSync(BACKUP_FILE, JSON.stringify(backupData, null, 2), 'utf-8');
    console.log('[Backup] Database state saved to db_backup.json');
  } catch (error) {
    console.error('[Backup Error] Failed to write database backup:', error);
  }
}

export async function restoreDbBackup() {
  try {
    if (!fs.existsSync(BACKUP_FILE)) {
      console.log('[Backup] No local backup file found to restore.');
      return;
    }

    const rawData = fs.readFileSync(BACKUP_FILE, 'utf-8');
    const backupData = JSON.parse(rawData);

    await User.deleteMany({});
    await Conversation.deleteMany({});
    await Message.deleteMany({});

    if (backupData.users && backupData.users.length > 0) {
      await User.insertMany(backupData.users);
      console.log(`[Backup] Restored ${backupData.users.length} users.`);
    }

    if (backupData.conversations && backupData.conversations.length > 0) {
      await Conversation.insertMany(backupData.conversations);
      console.log(`[Backup] Restored ${backupData.conversations.length} conversations.`);
    }

    if (backupData.messages && backupData.messages.length > 0) {
      await Message.insertMany(backupData.messages);
      console.log(`[Backup] Restored ${backupData.messages.length} messages.`);
    }
  } catch (error) {
    console.error('[Backup Error] Failed to restore database backup:', error);
  }
}
