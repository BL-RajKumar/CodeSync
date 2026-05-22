import mongoose from 'mongoose';

const snapshotSchema = new mongoose.Schema({
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
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
  },
  content: {
    type: String,
    default: '',
  },
  hash: {
    type: String,
    required: true,
  },
  parentSnapshotId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Snapshot',
    default: null,
  },
  branch: {
    type: String,
    default: 'main',
    trim: true,
  },
  tag: {
    type: String,
    trim: true,
    default: null,
  },
}, {
  timestamps: true, // Automatically handles createdAt and updatedAt
});

// Map _id to snapshotId in JSON responses for consistency
snapshotSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.snapshotId = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

const Snapshot = mongoose.model('Snapshot', snapshotSchema);
export default Snapshot;
