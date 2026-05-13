import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    default: '',
  },
  language: {
    type: String,
    required: true,
  },
  visibility: {
    type: String,
    enum: ['Public', 'Private'],
    default: 'Public',
  },
  templateId: {
    type: Number,
    default: null, // Can be used later when we have templates
  },
  isArchived: {
    type: Boolean,
    default: false,
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  starCount: {
    type: Number,
    default: 0,
  },
  forkCount: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt
});

// Map _id to projectId in JSON responses
projectSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.projectId = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

const Project = mongoose.model('Project', projectSchema);
export default Project;
