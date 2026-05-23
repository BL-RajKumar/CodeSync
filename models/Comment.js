import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
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
  snapshotId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Snapshot',
    default: null, // Null if commenting directly on live file (not standard, but optional)
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  parentCommentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null, // For threading: null means it's a top-level inline comment
  },
  lineNumber: {
    type: Number,
    required: true,
  },
  columnNumber: {
    type: Number,
    default: null, // Optional, for highlighting specific characters/columns
  },
  content: {
    type: String,
    required: true,
    trim: true,
  },
  resolved: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true, // Automatically handles createdAt and updatedAt
});

// Map _id to commentId in JSON responses for consistency
commentSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.commentId = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

const Comment = mongoose.model('Comment', commentSchema);
export default Comment;
