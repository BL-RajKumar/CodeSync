import mongoose from 'mongoose';

const whiteboardSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    unique: true
  },
  elements: {
    type: Array,
    default: []
  },
  appState: {
    type: Object,
    default: {}
  }
}, { timestamps: true });

export default mongoose.model('Whiteboard', whiteboardSchema);
