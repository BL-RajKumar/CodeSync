import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  path: {
    type: String,
    required: true,
    trim: true,
    // Path should ideally include the filename, e.g., /src/components/App.jsx
  },
  language: {
    type: String,
    default: 'plaintext',
  },
  content: {
    type: String,
    default: '',
  },
  size: {
    type: Number,
    default: 0,
  },
  createdById: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  lastEditedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true, // Automatically handles createdAt and updatedAt
});

// Ensure uniqueness of a file path within a specific project (excluding deleted files)
fileSchema.index({ projectId: 1, path: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });

// Map _id to fileId in JSON responses for consistency
fileSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.fileId = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

const File = mongoose.model('File', fileSchema);
export default File;
