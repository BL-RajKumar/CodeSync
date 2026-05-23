import mongoose from 'mongoose';
import crypto from 'crypto';

const participantSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  username: String,
  avatarUrl: String,
  joinedAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: false });

const collaborationSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    unique: true,
    default: () => crypto.randomBytes(8).toString('hex'), // 16-char hex shareable ID
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
  },
  fileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File',
    required: true,
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['Active', 'Ended'],
    default: 'Active',
  },
  language: {
    type: String,
    default: 'plaintext',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  endedAt: {
    type: Date,
    default: null,
  },
  maxParticipants: {
    type: Number,
    default: 5,
  },
  isPasswordProtected: {
    type: Boolean,
    default: false,
  },
  sessionPassword: {
    type: String,
    default: '',
  },
  lastActiveAt: {
    type: Date,
    default: Date.now,
  },
  // Runtime tracking (not in the provided schema but needed for live state)
  participants: [participantSchema],
}, {
  timestamps: false, // We manage createdAt/endedAt manually per the schema
});

// Index for fast lookup by sessionId
collaborationSessionSchema.index({ sessionId: 1 });
// Index to find active sessions for a specific file
collaborationSessionSchema.index({ projectId: 1, fileId: 1, status: 1 });

collaborationSessionSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    // Never expose the password in JSON responses
    delete ret.sessionPassword;
    return ret;
  }
});

const CollaborationSession = mongoose.model('CollaborationSession', collaborationSessionSchema);
export default CollaborationSession;
