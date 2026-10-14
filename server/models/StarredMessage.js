import mongoose from 'mongoose';

const starredMessageSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    messageId: { type: String, required: true },
  },
  { timestamps: true },
);

// Ensure a user cannot star the same message multiple times
starredMessageSchema.index({ userId: 1, messageId: 1 }, { unique: true });

const StarredMessage = mongoose.model('StarredMessage', starredMessageSchema);

export default StarredMessage;
