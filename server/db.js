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
    console.log('Connecting to process.env.MONGODB_URI database...');
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 30000,
        connectTimeoutMS: 30000,
        retryWrites: true,
      });
      console.log('✅ Connected to MongoDB Atlas / Remote URI database successfully.');
      return mongoose.connection;
    } catch (error) {
      console.error('❌ Fatal: Failed to connect to process.env.MONGODB_URI:', error.message);
      throw error;
    }
  }

  // Only fall back to local MongoMemoryServer if NO MONGODB_URI environment variable is configured
  console.log('No MONGODB_URI provided. Initializing local persistent database...');
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
  console.log('Connected to local persistent database at:', dbPath);
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
