import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  relatedId: {
    type: String, // String type to support custom slugs (sessionId) and standard database ObjectIds polymorphically
    default: null,
  },
  relatedType: {
    type: String,
    default: null, // E.g., 'CollaborationSession', 'Comment', 'Snapshot'
  },
  isRead: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true, // Automatically provides createdAt and updatedAt
});

// Map _id to notificationId in JSON responses
notificationSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.notificationId = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
