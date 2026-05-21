import express from 'express';
import {
  addComment,
  updateComment,
  deleteComment,
  toggleResolve,
  getFileComments,
  getProjectComments,
} from '../controllers/commentController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require auth
router.use(protect);

// Create a comment or reply
router.route('/').post(addComment);

// Get all comments for a specific file (optionally filtered by snapshotId)
router.route('/file/:fileId').get(getFileComments);

// Get all comments for a project (UC36 - centralized view)
router.route('/project/:projectId').get(getProjectComments);

// Update or delete a specific comment
router.route('/:id').put(updateComment).delete(deleteComment);

// Resolve / Unresolve a comment
router.route('/:id/resolve').put(toggleResolve);

export default router;
