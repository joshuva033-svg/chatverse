import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, required: true },
    conversationId: { type: String, required: true },
    senderId: { type: String, required: true },
    text: { type: String, trim: true, default: '' },
    fileUrl: { type: String, default: null },
    fileName: { type: String, default: null },
    fileType: { type: String, default: null },
    fileSize: { type: Number, default: null },
    replyToMessageId: { type: String, default: null },
    readAt: { type: Date, default: null },
    isPinned: { type: Boolean, default: false },
    deletedBy: [{ type: String, default: [] }],
  },
  { timestamps: true },
);

const Message = mongoose.model('Message', messageSchema);

export default Message;
