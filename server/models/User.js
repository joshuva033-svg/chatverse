import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    avatar: { type: String, default: '' },
    avatarUrl: { type: String, default: null },
    status: { type: String, default: 'Hey there! I am using Chat-Verse.' },
    readReceipts: { type: Boolean, default: true },
    resetCode: { type: String, default: null },
    lastSeen: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

const User = mongoose.model('User', userSchema);

export default User;
