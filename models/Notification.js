import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: ['mention', 'reply', 'resolve', 'system'],
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  link: {
    type: String, // E.g. URL to jump to the comment in the project
    default: null,
  },
  read: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Map _id to notificationId
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
