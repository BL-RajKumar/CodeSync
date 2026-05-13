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
  owner: {
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
  timestamps: true,
});

const Project = mongoose.model('Project', projectSchema);
export default Project;
