import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, required: true },
    participants: [{ type: String, required: true }],
    lastMessage: { type: String, default: null },
    isGroup: { type: Boolean, default: false },
    name: { type: String, default: '' },
    createdBy: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;
