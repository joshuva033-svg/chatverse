import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import path from 'node:path';
import fs from 'node:fs';

let mongoServer;

export async function connectDb() {
  if (mongoose.connection.readyState >= 1) {
    return mongoose.connection;
  }

  const uri = process.env.MONGODB_URI;

  if (uri) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 4000 });
      console.log('Connected to MongoDB Atlas / Remote URI successfully.');
      return mongoose.connection;
    } catch (error) {
      console.warn('Could not connect to process.env.MONGODB_URI, falling back to persistent local database:', error.message);
    }
  }

  const dbPath = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath, { recursive: true });
  }

  mongoServer = await MongoMemoryServer.create({
    instance: {
      dbPath,
      storageEngine: 'wiredTiger',
    },
  });

  const memoryUri = mongoServer.getUri();
  await mongoose.connect(memoryUri);
  console.log('Connected to persistent local database at:', dbPath);
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
