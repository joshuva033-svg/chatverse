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
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
      });
      console.log('✅ Connected to MongoDB Atlas cloud database successfully.');
      return mongoose.connection;
    } catch (error) {
      console.error('❌ MONGODB_URI connection failed:', error.message);
      if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
        console.error('⚠️ WARNING: Running on production/Render without a valid MONGODB_URI. User data will reset when Render sleeps unless a valid MONGODB_URI is provided in Render dashboard!');
      }
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
