import mongoose from 'mongoose';
import path from 'node:path';
import fs from 'node:fs';

export async function connectDb() {
  if (mongoose.connection.readyState >= 1) {
    return mongoose.connection;
  }

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('❌ Fatal Error: MONGODB_URI environment variable is not defined.');
    console.error('Please set MONGODB_URI in your Render environment variables or .env file.');
    throw new Error('MONGODB_URI is required to connect to the database.');
  }

  console.log('Connecting to MongoDB database...');
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      retryWrites: true,
    });
    console.log('✅ Connected to MongoDB successfully.');
    return mongoose.connection;
  } catch (error) {
    console.error('❌ Fatal: Failed to connect to MongoDB:', error.message);
    throw error;
  }
}

export async function disconnectDb() {
  if (mongoose.connection.readyState >= 1) {
    await mongoose.disconnect();
  }
}
