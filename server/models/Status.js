import mongoose from 'mongoose';

const statusSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, required: true },
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    userAvatar: { type: String, default: '' },
    mediaUrl: { type: String, default: '' },
    mediaType: { type: String, enum: ['image', 'video', 'text'], default: 'image' },
    caption: { type: String, default: '' },
    backgroundColor: { type: String, default: 'from-purple-600 to-indigo-600' },
    views: [
      {
        userId: { type: String, required: true },
        userName: { type: String, default: '' },
        viewedAt: { type: Date, default: Date.now },
      },
    ],
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// Index for auto-expiring old statuses or easy 24-hour querying
statusSchema.index({ expiresAt: 1 });

const Status = mongoose.model('Status', statusSchema);

export default Status;
